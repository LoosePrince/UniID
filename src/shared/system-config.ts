import { z } from "zod";
import { prisma } from "@/shared/prisma";

export const SYSTEM_CONFIG_KEY = "system";

const DEFAULT_QUOTA_CONFIG_KEY = "default_quota";
const AUTH_SECURITY_CONFIG_KEY = "auth_security";

const systemConfigSchema = z.object({
  publicUrl: z.string().url().default("http://localhost:3000"),
  adminAllowedOrigins: z.array(z.string().trim().min(1)).default([]),

  argon2TimeCost: z.number().int().min(1).default(3),
  argon2MemoryKb: z.number().int().min(1024).default(65_536),
  argon2Parallelism: z.number().int().min(1).default(1),

  emailVerificationEnabled: z.boolean().default(true),
  twoFactorEnabled: z.boolean().default(true),
  registrationEnabled: z.boolean().default(true),
  registrationEmailVerificationRequired: z.boolean().default(false),

  smtpEnabled: z.boolean().default(false),
  smtpHost: z.string().trim().default(""),
  smtpPort: z.number().int().min(1).max(65535).default(587),
  smtpSecure: z.boolean().default(false),
  smtpUser: z.string().trim().default(""),
  smtpPassword: z.string().default(""),
  smtpFrom: z.string().trim().default(""),
  smtpReplyTo: z.string().trim().default(""),

  filesEnabled: z.boolean().default(true),
  s3EndpointInternal: z.string().trim().default(""),
  s3EndpointExternal: z.string().trim().default(""),
  s3Region: z.string().trim().min(1).default("us-east-1"),
  s3Bucket: z.string().trim().default(""),
  s3AccessKey: z.string().trim().default(""),
  s3SecretKey: z.string().default(""),
  s3ForcePathStyle: z.boolean().default(true),
  fileMaxSizeBytes: z.number().int().min(1).default(104_857_600),
  filePresignTtlSeconds: z.number().int().min(1).default(300),
  fileShareTokenTtlSeconds: z.number().int().min(1).default(604_800),

  functionsEnabled: z.boolean().default(true),
  fnDefaultMemoryMb: z.number().int().min(1).default(64),
  fnDefaultTimeoutMs: z.number().int().min(1).default(5_000),
  fnFetchWhitelist: z.array(z.string().trim().min(1)).default([]),

  realtimeEnabled: z.boolean().default(true),
  realtimeKeepaliveSeconds: z.number().int().min(1).default(25),
  realtimeReplayWindowSeconds: z.number().int().min(1).default(60),

  uniidDatabasesDir: z.string().trim().min(1).default("./data/app-databases"),
  defaultMainRecordLimit: z.number().int().min(1).default(1_000),
  defaultMainStorageBytes: z.number().int().min(1).default(5_242_880),

  quotaRpsDefault: z.number().int().min(1).default(60),
  quotaDailyApiDefault: z.number().int().min(1).default(1_000_000),
  quotaMonthlyStorageBytesDefault: z.number().int().min(1).default(10_737_418_240),
  quotaMonthlyEgressBytesDefault: z.number().int().min(1).default(53_687_091_200),
  quotaFnInvocationsDailyDefault: z.number().int().min(1).default(100_000)
});

export type SystemConfig = z.infer<typeof systemConfigSchema>;

export const DEFAULT_SYSTEM_CONFIG: SystemConfig = normalizeSystemConfig({});

export function normalizeSystemConfig(value: unknown): SystemConfig {
  const raw = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const parsed = systemConfigSchema.safeParse({
    ...raw,
    adminAllowedOrigins: normalizeStringList(raw.adminAllowedOrigins),
    fnFetchWhitelist: normalizeStringList(raw.fnFetchWhitelist)
  });
  const config = parsed.success ? parsed.data : systemConfigSchema.parse({});
  return {
    ...config,
    adminAllowedOrigins: config.adminAllowedOrigins.length > 0
      ? unique(config.adminAllowedOrigins)
      : [config.publicUrl],
    fnFetchWhitelist: unique(config.fnFetchWhitelist)
  };
}

export async function getSystemConfig(): Promise<SystemConfig> {
  const rows = await prisma.globalConfig.findMany({
    where: { key: { in: [SYSTEM_CONFIG_KEY, DEFAULT_QUOTA_CONFIG_KEY, AUTH_SECURITY_CONFIG_KEY] } }
  });
  const byKey = Object.fromEntries(rows.map((row) => [row.key, safeParse(row.value)]));
  const rawSystem = asRecord(byKey[SYSTEM_CONFIG_KEY]);
  const merged = { ...rawSystem };

  const legacyQuota = asRecord(byKey[DEFAULT_QUOTA_CONFIG_KEY]);
  if (!has(rawSystem, "quotaRpsDefault") && typeof legacyQuota.rpsLimit === "number") {
    merged.quotaRpsDefault = legacyQuota.rpsLimit;
  }
  if (!has(rawSystem, "quotaDailyApiDefault") && typeof legacyQuota.dailyApiCalls === "number") {
    merged.quotaDailyApiDefault = legacyQuota.dailyApiCalls;
  }
  if (!has(rawSystem, "quotaMonthlyStorageBytesDefault") && typeof legacyQuota.monthlyStorageBytes === "number") {
    merged.quotaMonthlyStorageBytesDefault = legacyQuota.monthlyStorageBytes;
  }
  if (!has(rawSystem, "quotaFnInvocationsDailyDefault") && typeof legacyQuota.fnInvocationsDaily === "number") {
    merged.quotaFnInvocationsDailyDefault = legacyQuota.fnInvocationsDaily;
  }

  const legacyAuth = asRecord(byKey[AUTH_SECURITY_CONFIG_KEY]);
  if (!has(rawSystem, "emailVerificationEnabled") && typeof legacyAuth.emailVerificationEnabled === "boolean") {
    merged.emailVerificationEnabled = legacyAuth.emailVerificationEnabled;
  }
  if (!has(rawSystem, "twoFactorEnabled") && typeof legacyAuth.twoFactorEnabled === "boolean") {
    merged.twoFactorEnabled = legacyAuth.twoFactorEnabled;
  }

  return normalizeSystemConfig(merged);
}

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function has(obj: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function normalizeStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function unique(items: string[]): string[] {
  return Array.from(new Set(items));
}
