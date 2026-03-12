import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { Prisma } from "@logiqo/db";
import { getPresignedDownloadUrl, uploadDocument } from "../../lib/s3.js";
import { lookupByUdi } from "../../lib/gudid-client.js";

// ── Validation schemas ────────────────────────────────────────────────────────

const searchQuerySchema = z.object({
  q:            z.string().optional(),
  category:     z.string().uuid().optional(),
  manufacturer: z.string().optional(),          // manufacturer slug
  status:       z.enum(["approved", "recalled", "pending", "withdrawn"]).optional(),
  page:         z.coerce.number().min(1).default(1),
  limit:        z.coerce.number().min(1).max(100).default(20),
});

const createDeviceBodySchema = z.object({
  sku:                 z.string().min(1).max(100).trim(),
  name:                z.string().min(2).max(300).trim(),
  description:         z.string().max(5000).trim().optional(),
  modelNumber:         z.string().max(100).trim().optional(),
  manufacturerId:      z.string().uuid("Invalid manufacturer ID"),
  categoryId:          z.string().uuid("Invalid category ID"),
  regulatoryStatus:    z.enum(["approved", "recalled", "pending", "withdrawn"]).default("pending"),
  materialComposition: z.record(z.unknown()).optional(),
  dimensionsMm:        z.record(z.unknown()).optional(),
  sterilizationMethod: z.string().max(200).trim().optional(),
  fdA510kNumber:       z.string().max(100).trim().optional(),
  ceMmarkNumber:       z.string().max(100).trim().optional(),
});

// ── Constants ─────────────────────────────────────────────────────────────────

const SEARCH_TTL   = 300;  // 5 min
const DETAIL_TTL   = 600;  // 10 min
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
]);

const VALID_DOCUMENT_TYPES = new Set([
  "ifu",
  "image",
  "technical_spec",
  "safety_notice",
]);

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Stable cache key for a search query — sort keys so param order doesn't matter. */
function searchCacheKey(params: Record<string, unknown>): string {
  const sorted = Object.keys(params)
    .sort()
    .reduce<Record<string, unknown>>((acc, k) => { acc[k] = params[k]; return acc; }, {});
  return `device_search:${JSON.stringify(sorted)}`;
}

/**
 * Build a pg_tsvector expression for the devices table.
 * Matches the expression used by the GIN index (devices_fts_gin_idx).
 */
const ftsVector = Prisma.sql`
  to_tsvector('english',
    d.name || ' ' || d.sku || ' ' ||
    COALESCE(d."modelNumber", '') || ' ' ||
    COALESCE(d.description, '')
  )
`;

/** Sanitise a filename to safe S3-key characters. */
function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

// ── Plugin ────────────────────────────────────────────────────────────────────

export const devicesRoutes: FastifyPluginAsync = async (fastify) => {
  // All device routes require authentication
  fastify.addHook("preHandler", fastify.authenticate);

  // ── GET /devices/gudid-lookup — UDI barcode → GUDID device info ─────────────
  fastify.get<{ Querystring: { udi: string } }>("/gudid-lookup", async (request, reply) => {
    const udi = String((request.query as any).udi ?? "").trim();
    if (!udi) return reply.code(400).send({ message: "udi query parameter is required" });

    const device = await lookupByUdi(udi);
    if (!device) return reply.code(404).send({ message: "UDI not found in GUDID" });

    return device;
  });

  // ── GET /devices/meta — filter metadata (manufacturers + categories) ──────────
  fastify.get("/meta", async () => {
    const cacheKey = "device_meta";
    const cached = await fastify.redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as unknown;

    const [manufacturers, categories] = await Promise.all([
      fastify.db.manufacturer.findMany({
        select:  { id: true, name: true, slug: true },
        orderBy: { name: "asc" },
      }),
      fastify.db.deviceCategory.findMany({
        select:  { id: true, name: true, code: true, parentId: true },
        orderBy: { name: "asc" },
      }),
    ]);

    const result = { manufacturers, categories };
    await fastify.redis.setex(cacheKey, SEARCH_TTL, JSON.stringify(result));
    return result;
  });

  // ── GET /devices — full-text search (pg_tsvector) + Redis cache ───────────────
  //
  // When `q` is present:
  //   1. $queryRaw with plainto_tsquery hits the GIN index (devices_fts_gin_idx).
  //      Returns ordered [{ id, rank }].
  //   2. Prisma fetches full rows by those IDs (in: []).
  //   3. Rows re-sorted to match ts_rank_cd order.
  // Without `q`: Prisma filter + createdAt desc (standard index scan).
  //
  fastify.get("/", async (request) => {
    const query  = searchQuerySchema.parse(request.query);
    const { q, category, manufacturer, status, page, limit } = query;
    const offset = (page - 1) * limit;

    // ── Cache check ────────────────────────────────────────────────────────────
    const cacheKey = searchCacheKey({ q, category, manufacturer, status, page, limit });
    const cached   = await fastify.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as unknown;
    }

    let devices: any[];
    let total: number;

    const trimmedQ = q?.trim();

    if (trimmedQ) {
      // ── Full-text path via pg_tsvector ─────────────────────────────────────
      // Build safe parameterised filter conditions with Prisma.sql
      const conditions: Prisma.Sql[] = [
        Prisma.sql`d."isActive" = true`,
        Prisma.sql`d."approvalStatus" = 'approved'`,
      ];
      if (category) conditions.push(Prisma.sql`d."categoryId" = ${category}::uuid`);
      if (status)   conditions.push(Prisma.sql`d."regulatoryStatus" = ${status}`);

      const manufacturerFilter: Prisma.Sql = manufacturer
        ? Prisma.sql`JOIN manufacturers mfr ON mfr.id = d."manufacturerId" AND mfr.slug = ${manufacturer}`
        : Prisma.sql``;

      const whereClause  = Prisma.join(conditions, " AND ");
      const tsQuery      = Prisma.sql`plainto_tsquery('english', ${trimmedQ})`;

      type RankedRow = { id: string; rank: number };

      // Step 1 — ranked IDs from GIN index
      const rankedRows = await fastify.db.$queryRaw<RankedRow[]>`
        SELECT d.id::text,
               ts_rank_cd(${ftsVector}, ${tsQuery}) AS rank
        FROM   devices d
        ${manufacturerFilter}
        WHERE  ${whereClause}
          AND  ${ftsVector} @@ ${tsQuery}
        ORDER  BY rank DESC
        LIMIT  ${limit}
        OFFSET ${offset}
      `;

      // Step 1b — total count (separate query, no LIMIT/OFFSET)
      type CountRow = { count: bigint };
      const countRows = await fastify.db.$queryRaw<CountRow[]>`
        SELECT COUNT(*) AS count
        FROM   devices d
        ${manufacturerFilter}
        WHERE  ${whereClause}
          AND  ${ftsVector} @@ ${tsQuery}
      `;
      total = Number(countRows[0]?.count ?? 0);

      if (rankedRows.length === 0) {
        devices = [];
      } else {
        // Step 2 — full rows via Prisma ORM
        const ids     = rankedRows.map(r => r.id);
        const rankMap = new Map(rankedRows.map((r, i) => [r.id, i]));

        const rows = await fastify.db.device.findMany({
          where: { id: { in: ids } },
          select: {
            id:              true,
            sku:             true,
            name:            true,
            description:     true,
            modelNumber:     true,
            version:         true,
            regulatoryStatus: true,
            approvalStatus:  true,
            sterilizationMethod: true,
            viewCount:       true,
            createdAt:       true,
            manufacturer: { select: { id: true, name: true, slug: true } },
            category:     { select: { id: true, name: true, code: true } },
            _count:       { select: { annotations: true } },
          },
        });

        // Step 3 — re-order to match ts_rank_cd output
        rows.sort((a, b) => (rankMap.get(a.id) ?? 999) - (rankMap.get(b.id) ?? 999));
        devices = rows;
      }
    } else {
      // ── Non-FTS path: Prisma filter + sort by createdAt ───────────────────
      const where: Record<string, unknown> = {
        isActive:       true,
        approvalStatus: "approved",
      };
      if (category)     where.categoryId       = category;
      if (manufacturer) where.manufacturer     = { slug: manufacturer };
      if (status)       where.regulatoryStatus = status;

      [devices, total] = await Promise.all([
        fastify.db.device.findMany({
          where:   where as any,
          select: {
            id:              true,
            sku:             true,
            name:            true,
            description:     true,
            modelNumber:     true,
            version:         true,
            regulatoryStatus: true,
            approvalStatus:  true,
            sterilizationMethod: true,
            viewCount:       true,
            createdAt:       true,
            manufacturer: { select: { id: true, name: true, slug: true } },
            category:     { select: { id: true, name: true, code: true } },
            _count:       { select: { annotations: true } },
          },
          skip:    offset,
          take:    limit,
          orderBy: { createdAt: "desc" },
        }),
        fastify.db.device.count({ where: where as any }),
      ]);
    }

    await fastify.audit(request, {
      action:       "devices.searched",
      resourceType: "device",
      newValues:    { query: q, category, manufacturer, status },
    });

    const result = { data: devices, total, page, limit };
    await fastify.redis.setex(cacheKey, SEARCH_TTL, JSON.stringify(result));
    return result;
  });

  // ── POST /devices — system admin: add device to index ────────────────────────
  fastify.post(
    "/",
    { preHandler: fastify.requireRole("system_admin") },
    async (request, reply) => {
      const body = createDeviceBodySchema.parse(request.body);

      const device = await fastify.db.device.create({
        data: {
          sku:                 body.sku,
          name:                body.name,
          description:         body.description,
          modelNumber:         body.modelNumber,
          manufacturerId:      body.manufacturerId,
          categoryId:          body.categoryId,
          regulatoryStatus:    body.regulatoryStatus,
          materialComposition: body.materialComposition as any,
          dimensionsMm:        body.dimensionsMm as any,
          sterilizationMethod: body.sterilizationMethod,
          fdA510kNumber:       body.fdA510kNumber,
          ceMmarkNumber:       body.ceMmarkNumber,
          approvalStatus:      "pending",
          isActive:            true,
        },
        include: {
          manufacturer: { select: { id: true, name: true, slug: true } },
          category:     { select: { id: true, name: true } },
        },
      });

      // Bust meta cache (device count may now differ)
      await fastify.redis.del("device_meta");

      await fastify.audit(request, {
        action:       "device.created",
        resourceType: "device",
        resourceId:   device.id,
        newValues:    { sku: body.sku, name: body.name },
      });

      return reply.code(201).send(device);
    }
  );

  // ── GET /devices/:id — device detail with Redis cache + non-blocking viewCount
  fastify.get<{ Params: { id: string } }>(
    "/:id",
    async (request, reply) => {
      const { id } = request.params;
      const cacheKey = `device:${id}`;

      // ── Redis cache check ────────────────────────────────────────────────────
      const cached = await fastify.redis.get(cacheKey);
      let device: any;

      if (cached) {
        device = JSON.parse(cached);
      } else {
        device = await fastify.db.device.findUnique({
          where: { id, isActive: true },
          include: {
            manufacturer: true,
            category: {
              include: {
                parent: { select: { id: true, name: true, code: true } },
              },
            },
            documents: {
              where:  { isCurrent: true },
              select: {
                id:            true,
                title:         true,
                documentType:  true,
                version:       true,
                mimeType:      true,
                fileSizeBytes: true,
              },
            },
            _count: { select: { annotations: true } },
          },
        });

        if (!device) return reply.code(404).send({ message: "Device not found" });

        // Serialise BigInt fileSizeBytes before caching (JSON.stringify can't handle BigInt)
        device = JSON.parse(JSON.stringify(device, (_key, value) =>
          typeof value === "bigint" ? Number(value) : value
        ));

        await fastify.redis.setex(cacheKey, DETAIL_TTL, JSON.stringify(device));
      }

      if (!device) return reply.code(404).send({ message: "Device not found" });

      // ── Non-blocking viewCount increment (fire and forget) ───────────────────
      // Defers the DB write until after the current event-loop tick so the HTTP
      // response is not held up by the UPDATE query.  The counter in the cached
      // response will lag by up to DETAIL_TTL seconds — intentional trade-off.
      setImmediate(() => {
        fastify.db.device
          .update({ where: { id }, data: { viewCount: { increment: 1 } } })
          .catch((err: unknown) => {
            fastify.log.warn({ err, deviceId: id }, "viewCount increment failed");
          });
      });

      // ── Related devices: same category, different manufacturer, top-viewed ────
      const relatedDevices = await fastify.db.device.findMany({
        where: {
          categoryId:     device.category.id,
          manufacturerId: { not: device.manufacturer.id },
          isActive:       true,
          approvalStatus: "approved",
          id:             { not: id },
        },
        select: {
          id:               true,
          name:             true,
          sku:              true,
          regulatoryStatus: true,
          viewCount:        true,
          manufacturer: { select: { id: true, name: true, slug: true } },
        },
        orderBy: { viewCount: "desc" },
        take:    4,
      });

      await fastify.audit(request, {
        action:       "device.viewed",
        resourceType: "device",
        resourceId:   device.id,
      });

      return { ...device, relatedDevices };
    }
  );

  // ── POST /devices/:id/documents — upload a document (admin roles only) ────────
  //
  // Accepts multipart/form-data with:
  //   file         — the binary (PDF, PNG, JPEG; max 10 MB)
  //   documentType — ifu | image | technical_spec | safety_notice  (default: ifu)
  //   title        — human-readable label (defaults to original filename)
  //   version      — optional version string (e.g. "v3.2")
  //
  // The file is streamed to S3 (KMS-encrypted) and then a DeviceDocument row is
  // created. The s3Key is never returned to callers — only the documentId.
  //
  fastify.post<{ Params: { id: string } }>(
    "/:id/documents",
    { preHandler: fastify.requireRole("hospital_safety_officer", "system_admin") },
    async (request, reply) => {
      const { id } = request.params;

      // Verify device exists
      const device = await fastify.db.device.findUnique({
        where:  { id, isActive: true },
        select: { id: true },
      });
      if (!device) return reply.code(404).send({ message: "Device not found" });

      // Resolve Auth0 sub → internal user UUID (same pattern as approvedById fix)
      const uploader = await fastify.db.user.findUnique({
        where:  { auth0UserId: request.user.sub },
        select: { id: true },
      });
      if (!uploader) return reply.code(403).send({ message: "Uploader user record not found" });

      // ── Parse multipart body ────────────────────────────────────────────────
      let fileBuffer:    Buffer | undefined;
      let fileName:      string | undefined;
      let mimeType:      string | undefined;
      let documentType   = "ifu";
      let title:         string | undefined;
      let version:       string | undefined;

      for await (const part of request.parts()) {
        if (part.type === "file") {
          if (!ALLOWED_MIME_TYPES.has(part.mimetype)) {
            return reply.code(400).send({
              message: "Invalid file type. Allowed: PDF, PNG, JPEG.",
            });
          }

          fileBuffer = await part.toBuffer();
          fileName   = part.filename;
          mimeType   = part.mimetype;

          if (fileBuffer.length > MAX_FILE_SIZE) {
            return reply.code(400).send({ message: "File exceeds 10 MB limit." });
          }
        } else {
          // Form text fields
          if (part.fieldname === "documentType") documentType = String(part.value);
          if (part.fieldname === "title")        title        = String(part.value);
          if (part.fieldname === "version")      version      = String(part.value);
        }
      }

      if (!fileBuffer || !fileName || !mimeType) {
        return reply.code(400).send({ message: "No file was uploaded." });
      }

      if (!VALID_DOCUMENT_TYPES.has(documentType)) {
        return reply.code(400).send({
          message: `Invalid documentType. Must be one of: ${[...VALID_DOCUMENT_TYPES].join(", ")}.`,
        });
      }

      // ── Upload to S3 ────────────────────────────────────────────────────────
      const s3Key = `documents/${id}/${Date.now()}-${sanitizeFilename(fileName)}`;

      try {
        await uploadDocument(s3Key, fileBuffer, mimeType);
      } catch (err) {
        fastify.log.error({ err, deviceId: id }, "S3 upload failed");
        return reply.code(502).send({ message: "Failed to upload document to storage." });
      }

      // ── Persist DeviceDocument ───────────────────────────────────────────────
      let doc: any;
      try {
        doc = await fastify.db.deviceDocument.create({
          data: {
            deviceId:     id,
            documentType,
            title:        title ?? fileName,
            s3Key,
            mimeType,
            fileSizeBytes: BigInt(fileBuffer.length),
            version:       version ?? null,
            uploadedById: uploader.id,
            isCurrent:    true,
          },
          select: {
            id:           true,
            documentType: true,
            title:        true,
            mimeType:     true,
            version:      true,
          },
        });
      } catch (err) {
        // DB write failed — attempt to roll back the S3 object so we don't leak orphaned files
        fastify.log.error({ err, s3Key }, "DeviceDocument create failed — rolling back S3 object");
        try {
          const { deleteDocument } = await import("../../lib/s3.js");
          await deleteDocument(s3Key);
        } catch (s3Err) {
          fastify.log.error({ s3Err, s3Key }, "S3 rollback also failed");
        }
        throw err; // Let Fastify's default error handler return 500
      }

      await fastify.audit(request, {
        action:       "document.uploaded",
        resourceType: "device_document",
        resourceId:   doc.id,
        newValues:    {
          deviceId:     id,
          documentType: doc.documentType,
          title:        doc.title,
          fileName,
          mimeType,
          fileSizeBytes: fileBuffer.length,
          s3Key,
        },
      });

      return reply.code(201).send({
        documentId:    doc.id,
        fileName,
        documentType:  doc.documentType,
        title:         doc.title,
        mimeType:      doc.mimeType,
        fileSizeBytes: fileBuffer.length,
        version:       doc.version,
      });
    }
  );

  // ── GET /devices/:id/documents — list current documents (no s3Key exposed) ───
  fastify.get<{ Params: { id: string } }>(
    "/:id/documents",
    async (request, reply) => {
      const { id } = request.params;

      const device = await fastify.db.device.findUnique({
        where:  { id, isActive: true },
        select: { id: true },
      });
      if (!device) return reply.code(404).send({ message: "Device not found" });

      const documents = await fastify.db.deviceDocument.findMany({
        where:   { deviceId: id, isCurrent: true },
        select: {
          id:            true,
          documentType:  true,
          title:         true,
          mimeType:      true,
          fileSizeBytes: true,
          version:       true,
          createdAt:     true,
          uploadedBy:    { select: { id: true, fullName: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      // Serialise BigInt before JSON response
      const data = documents.map(doc => ({
        ...doc,
        fileSizeBytes: doc.fileSizeBytes !== null ? Number(doc.fileSizeBytes) : null,
      }));

      return { data };
    }
  );

  // ── GET /devices/:id/annotations — device-scoped annotation listing ──────────
  //
  // Query params:
  //   severity   — filter by severity level
  //   visibility — filter by visibility scope (tenant | platform)
  //   sortBy     — recent (default) | endorsed | severity
  //   page, limit — pagination
  //
  // RLS: tenant users see tenant + platform annotations for this device.
  //      Individual users (no tenantId) see platform-only annotations.
  //
  fastify.get<{ Params: { id: string } }>(
    "/:id/annotations",
    async (request, reply) => {
      const { id }   = request.params;
      const tenantId = request.user.tenantId;

      const device = await fastify.db.device.findUnique({
        where:  { id, isActive: true },
        select: { id: true },
      });
      if (!device) return reply.code(404).send({ message: "Device not found" });

      const rawQuery = request.query as Record<string, string>;
      const query = {
        severity:   rawQuery.severity   as any || undefined,
        visibility: rawQuery.visibility as any || undefined,
        sortBy:     (rawQuery.sortBy ?? "recent") as "recent" | "endorsed" | "severity",
        page:       Math.max(1, Number(rawQuery.page)  || 1),
        limit:      Math.min(100, Math.max(1, Number(rawQuery.limit) || 20)),
      };

      const where: any = {
        deviceId: id,
        status:   "published",
      };

      // Tenant RLS: show tenant-scoped + platform, or platform-only
      if (tenantId) {
        where.OR = [
          { visibility: "platform" },
          { visibility: "tenant", tenantId },
        ];
      } else {
        where.visibility = "platform";
      }

      if (query.severity)   where.severity   = query.severity;
      if (query.visibility) where.visibility = query.visibility;

      // Resolve the requesting user's internal ID for userHasEndorsed check
      const dbUser = await fastify.db.user.findUnique({
        where:  { auth0UserId: request.user.sub },
        select: { id: true },
      });

      // Use explicit select (not include) so that authorId is never loaded
      // into the Node.js heap for anonymized annotations.
      const [annotations, total] = await Promise.all([
        fastify.db.annotation.findMany({
          where,
          select: {
            id:               true,
            deviceId:         true,
            tenantId:         true,
            annotationType:   true,
            severity:         true,
            title:            true,
            body:             true,
            procedureType:    true,
            procedureDate:    true,
            patientCount:     true,
            visibility:       true,
            status:           true,
            publishedAt:      true,
            isPublished:      true,
            isAnonymized:     true,
            version:          true,
            parentId:         true,
            endorsementCount: true,
            flagCount:        true,
            createdAt:        true,
            // authorId intentionally omitted — UUID never loaded for anonymized rows
            author: {
              select: { id: true, fullName: true, specialty: true, verificationTier: true },
            },
            _count: { select: { comments: true } },
            tags: {
              select: {
                annotationId: true,
                tagId:        true,
                tag: { select: { id: true, name: true, slug: true, category: true } },
              },
            },
          },
        }),
        fastify.db.annotation.count({ where }),
      ]);

      // Sort in memory
      type AnnotationWithIncludes = typeof annotations[0];
      let sorted: AnnotationWithIncludes[];

      const SEVERITY_ORDER: Record<string, number> = {
        critical: 4, high: 3, medium: 2, low: 1,
      };

      switch (query.sortBy) {
        case "endorsed":
          sorted = [...annotations].sort((a, b) => b.endorsementCount - a.endorsementCount);
          break;
        case "severity":
          sorted = [...annotations].sort((a, b) =>
            (SEVERITY_ORDER[b.severity ?? "low"] ?? 0) -
            (SEVERITY_ORDER[a.severity ?? "low"] ?? 0)
          );
          break;
        case "recent":
        default:
          sorted = [...annotations].sort(
            (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
          );
      }

      // Paginate — get the page slice first so we can batch-resolve endorsements
      const offset         = (query.page - 1) * query.limit;
      const pageAnnotations = sorted.slice(offset, offset + query.limit);
      const pageIds         = pageAnnotations.map(a => a.id);

      // Batch-resolve userHasEndorsed: single query for the page, not one per row.
      const endorsedSet = new Set<string>();
      if (dbUser && pageIds.length > 0) {
        const endorsements = await fastify.db.annotationEndorsement.findMany({
          where:  { userId: dbUser.id, annotationId: { in: pageIds } },
          select: { annotationId: true },
        });
        for (const e of endorsements) endorsedSet.add(e.annotationId);
      }

      // Serialize — authorId is NOT on the annotation object (excluded from select),
      // so the UUID never appears in the response body for anonymized rows.
      const pageSlice = pageAnnotations.map(a => ({
        id:               a.id,
        deviceId:         a.deviceId,
        tenantId:         a.tenantId,
        annotationType:   a.annotationType,
        severity:         a.severity,
        title:            a.title,
        body:             a.body,
        procedureType:    a.procedureType,
        procedureDate:    a.procedureDate ? a.procedureDate.toISOString().split("T")[0] : null,
        patientCount:     a.patientCount,
        visibility:       a.visibility,
        status:           a.status,
        publishedAt:      a.publishedAt?.toISOString() ?? null,
        version:          a.version,
        parentId:         a.parentId,
        endorsementCount: a.endorsementCount,
        flagCount:        a.flagCount,
        commentCount:     a._count.comments,
        userHasEndorsed:  endorsedSet.has(a.id),
        // Anonymized rows: return no id field — author UUID stripped entirely
        author:           a.isAnonymized
          ? { fullName: "Anonymous", specialty: null, verificationTier: 0 }
          : a.author,
        tags:             a.tags,
        createdAt:        a.createdAt.toISOString(),
      }));

      await fastify.audit(request, {
        action:       "device.annotations.listed",
        resourceType: "annotation",
        resourceId:   id,
        newValues:    { severity: query.severity, sortBy: query.sortBy, page: query.page },
      });

      return { data: pageSlice, total, page: query.page, limit: query.limit };
    }
  );

  // ── GET /devices/:id/documents/:documentId/url — pre-signed download URL ─────
  fastify.get<{ Params: { id: string; documentId: string } }>(
    "/:id/documents/:documentId/url",
    async (request, reply) => {
      const doc = await fastify.db.deviceDocument.findFirst({
        where: {
          id:       request.params.documentId,
          deviceId: request.params.id,
        },
        select: { id: true, s3Key: true, title: true },
      });

      if (!doc) return reply.code(404).send({ message: "Document not found" });

      const url       = await getPresignedDownloadUrl(doc.s3Key);
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      await fastify.audit(request, {
        action:       "document.downloaded",
        resourceType: "device_document",
        resourceId:   doc.id,
        newValues:    { documentTitle: doc.title },
      });

      return { url, expiresAt };
    }
  );
};
