import { z } from "zod";

/** Standard pagination query params — used on every list endpoint */
export const paginationSchema = z.object({
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/** Validates a UUID path param */
export const uuidParam = z.string().uuid("Must be a valid UUID");

/** Generic paginated envelope shape */
export const paginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    data:  z.array(itemSchema),
    total: z.number().int(),
    page:  z.number().int(),
    limit: z.number().int(),
  });
