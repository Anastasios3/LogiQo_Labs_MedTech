-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "planTier" TEXT NOT NULL DEFAULT 'standard',
    "baaSignedAt" TIMESTAMP(3),
    "baaDocumentS3" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "auth0UserId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "specialty" TEXT,
    "npiNumber" TEXT,
    "isVerifiedClinician" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manufacturers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "countryOfOrigin" TEXT,
    "fdaEstablishmentId" TEXT,
    "contactEmail" TEXT,
    "websiteUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manufacturers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "parentId" UUID,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sku" TEXT NOT NULL,
    "manufacturerId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "modelNumber" TEXT,
    "version" TEXT,
    "fdA510kNumber" TEXT,
    "ceMmarkNumber" TEXT,
    "regulatoryStatus" TEXT NOT NULL DEFAULT 'approved',
    "materialComposition" JSONB,
    "dimensionsMm" JSONB,
    "compatibilityMatrix" JSONB,
    "extractionTooling" JSONB,
    "sterilizationMethod" TEXT,
    "approvalStatus" TEXT NOT NULL DEFAULT 'pending',
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "deviceId" UUID NOT NULL,
    "documentType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "fileSizeBytes" BIGINT,
    "mimeType" TEXT,
    "version" TEXT,
    "uploadedById" UUID,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "annotations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "deviceId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "annotationType" TEXT NOT NULL,
    "severity" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "structuredData" JSONB,
    "procedureType" TEXT,
    "procedureDate" DATE,
    "patientCount" INTEGER,
    "visibility" TEXT NOT NULL DEFAULT 'tenant',
    "isAnonymized" BOOLEAN NOT NULL DEFAULT false,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "parentId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "annotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "annotation_endorsements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "annotationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "annotation_endorsements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "alertType" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "fullText" TEXT,
    "severity" TEXT NOT NULL,
    "affectedSkus" TEXT[],
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "sourceUrl" TEXT,
    "rawPayload" JSONB,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_device_links" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "alertId" UUID NOT NULL,
    "deviceId" UUID NOT NULL,
    "matchMethod" TEXT NOT NULL,
    "matchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_device_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_alert_acknowledgements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "alertId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "acknowledgedById" UUID NOT NULL,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "tenant_alert_acknowledgements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sops" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "contentS3Key" TEXT NOT NULL,
    "category" TEXT,
    "effectiveDate" DATE,
    "reviewDate" DATE,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdById" UUID NOT NULL,
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID,
    "tenantId" UUID,
    "userEmail" TEXT,
    "userRole" TEXT,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "oldValues" JSONB,
    "newValues" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "requestId" TEXT,
    "sessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_auth0UserId_key" ON "users"("auth0UserId");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenantId_email_key" ON "users"("tenantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "manufacturers_slug_key" ON "manufacturers"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "device_categories_code_key" ON "device_categories"("code");

-- CreateIndex
CREATE UNIQUE INDEX "devices_sku_manufacturerId_key" ON "devices"("sku", "manufacturerId");

-- CreateIndex
CREATE UNIQUE INDEX "annotation_endorsements_annotationId_userId_key" ON "annotation_endorsements"("annotationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "alert_device_links_alertId_deviceId_key" ON "alert_device_links"("alertId", "deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_alert_acknowledgements_alertId_tenantId_key" ON "tenant_alert_acknowledgements"("alertId", "tenantId");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_createdAt_idx" ON "audit_logs"("tenantId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_resourceType_resourceId_idx" ON "audit_logs"("resourceType", "resourceId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_categories" ADD CONSTRAINT "device_categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "device_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "manufacturers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "device_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_documents" ADD CONSTRAINT "device_documents_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_documents" ADD CONSTRAINT "device_documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annotations" ADD CONSTRAINT "annotations_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annotations" ADD CONSTRAINT "annotations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annotations" ADD CONSTRAINT "annotations_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annotations" ADD CONSTRAINT "annotations_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annotations" ADD CONSTRAINT "annotations_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "annotations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annotation_endorsements" ADD CONSTRAINT "annotation_endorsements_annotationId_fkey" FOREIGN KEY ("annotationId") REFERENCES "annotations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annotation_endorsements" ADD CONSTRAINT "annotation_endorsements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_device_links" ADD CONSTRAINT "alert_device_links_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "alerts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_device_links" ADD CONSTRAINT "alert_device_links_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_alert_acknowledgements" ADD CONSTRAINT "tenant_alert_acknowledgements_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "alerts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_alert_acknowledgements" ADD CONSTRAINT "tenant_alert_acknowledgements_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_alert_acknowledgements" ADD CONSTRAINT "tenant_alert_acknowledgements_acknowledgedById_fkey" FOREIGN KEY ("acknowledgedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sops" ADD CONSTRAINT "sops_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sops" ADD CONSTRAINT "sops_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sops" ADD CONSTRAINT "sops_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
