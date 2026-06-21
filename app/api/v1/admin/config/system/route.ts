import { z } from "zod";
import { defineRoute } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireSystemAdmin } from "@/shared/iam";
import { AdminService } from "@/modules/admin";

const body = z.object({
  publicUrl: z.string().url().optional(),
  adminAllowedOrigins: z.array(z.string().trim().min(1)).optional(),

  argon2TimeCost: z.number().int().min(1).optional(),
  argon2MemoryKb: z.number().int().min(1024).optional(),
  argon2Parallelism: z.number().int().min(1).optional(),

  emailVerificationEnabled: z.boolean().optional(),
  twoFactorEnabled: z.boolean().optional(),

  smtpEnabled: z.boolean().optional(),
  smtpHost: z.string().optional(),
  smtpPort: z.number().int().min(1).max(65535).optional(),
  smtpSecure: z.boolean().optional(),
  smtpUser: z.string().optional(),
  smtpPassword: z.string().optional(),
  smtpFrom: z.string().optional(),
  smtpReplyTo: z.string().optional(),

  filesEnabled: z.boolean().optional(),
  s3EndpointInternal: z.string().optional(),
  s3EndpointExternal: z.string().optional(),
  s3Region: z.string().trim().min(1).optional(),
  s3Bucket: z.string().optional(),
  s3AccessKey: z.string().optional(),
  s3SecretKey: z.string().optional(),
  s3ForcePathStyle: z.boolean().optional(),
  fileMaxSizeBytes: z.number().int().min(1).optional(),
  filePresignTtlSeconds: z.number().int().min(1).optional(),
  fileShareTokenTtlSeconds: z.number().int().min(1).optional(),

  functionsEnabled: z.boolean().optional(),
  fnDefaultMemoryMb: z.number().int().min(1).optional(),
  fnDefaultTimeoutMs: z.number().int().min(1).optional(),
  fnFetchWhitelist: z.array(z.string().trim().min(1)).optional(),

  realtimeEnabled: z.boolean().optional(),
  realtimeKeepaliveSeconds: z.number().int().min(1).optional(),
  realtimeReplayWindowSeconds: z.number().int().min(1).optional(),

  uniidDatabasesDir: z.string().trim().min(1).optional(),
  defaultMainRecordLimit: z.number().int().min(1).optional(),
  defaultMainStorageBytes: z.number().int().min(1).optional(),

  quotaRpsDefault: z.number().int().min(1).optional(),
  quotaDailyApiDefault: z.number().int().min(1).optional(),
  quotaMonthlyStorageBytesDefault: z.number().int().min(1).optional(),
  quotaMonthlyEgressBytesDefault: z.number().int().min(1).optional(),
  quotaFnInvocationsDailyDefault: z.number().int().min(1).optional()
});

export const PUT = withCors(
  "admin-only",
  defineRoute({
    schema: { body },
    handler: async ({ body }) => {
      const ctx = await requireSystemAdmin();
      const config = await AdminService.setSystemConfig(ctx.user.id, body);
      return { config };
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));
