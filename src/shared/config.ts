import { z } from "zod";

const numberFromString = z
  .string()
  .transform((v) => Number(v))
  .pipe(z.number().int().nonnegative());

const optionalNumberFromString = z
  .string()
  .transform((v) => (v.trim().length === 0 ? undefined : Number(v)))
  .pipe(z.number().int().nonnegative().optional());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AUTH_JWT_SECRET: z.string().min(32, "AUTH_JWT_SECRET must be at least 32 chars"),
  SESSION_COOKIE_SECRET: z.string().min(32, "SESSION_COOKIE_SECRET must be at least 32 chars"),
  PUBLIC_URL: z.string().url().default("http://localhost:3000"),
  ADMIN_ALLOWED_ORIGINS: z.string().optional().default(""),

  ARGON2_TIME_COST: numberFromString.default("3"),
  ARGON2_MEMORY_KB: numberFromString.default("65536"),
  ARGON2_PARALLELISM: numberFromString.default("1"),

  S3_ENDPOINT_INTERNAL: z.string().optional(),
  S3_ENDPOINT_EXTERNAL: z.string().optional(),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: z.string().default("true").transform((v) => v === "true"),

  FILE_MAX_SIZE_BYTES: numberFromString.default("104857600"),
  FILE_PRESIGN_TTL_SECONDS: numberFromString.default("300"),
  FILE_SHARE_TOKEN_TTL_SECONDS: numberFromString.default("604800"),

  FN_DEFAULT_MEMORY_MB: numberFromString.default("64"),
  FN_DEFAULT_TIMEOUT_MS: numberFromString.default("5000"),
  FN_FETCH_WHITELIST: z.string().default(""),

  REALTIME_KEEPALIVE_SECONDS: numberFromString.default("25"),
  REALTIME_REPLAY_WINDOW_SECONDS: numberFromString.default("60"),

  QUOTA_RPS_DEFAULT: numberFromString.default("60"),
  QUOTA_DAILY_API_DEFAULT: numberFromString.default("1000000"),
  QUOTA_MONTHLY_STORAGE_BYTES_DEFAULT: numberFromString.default("10737418240"),
  QUOTA_MONTHLY_EGRESS_BYTES_DEFAULT: numberFromString.default("53687091200"),
  QUOTA_FN_INVOCATIONS_DAILY_DEFAULT: numberFromString.default("100000"),

  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  LOG_PRETTY: z.string().default("false").transform((v) => v === "true")
});

function parseEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    // Print all issues at once, then crash early.
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    console.error(`[config] Invalid environment configuration:\n${issues}`);
    throw new Error("Invalid environment configuration");
  }
  return parsed.data;
}

export type AppConfig = z.infer<typeof envSchema> & {
  adminAllowedOrigins: string[];
  fetchWhitelistHosts: string[];
};

let cached: AppConfig | undefined;

export function config(): AppConfig {
  if (cached) return cached;
  const env = parseEnv();
  cached = {
    ...env,
    adminAllowedOrigins: env.ADMIN_ALLOWED_ORIGINS
      ? env.ADMIN_ALLOWED_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean)
      : [env.PUBLIC_URL],
    fetchWhitelistHosts: env.FN_FETCH_WHITELIST
      ? env.FN_FETCH_WHITELIST.split(",").map((s) => s.trim()).filter(Boolean)
      : []
  };
  return cached;
}
