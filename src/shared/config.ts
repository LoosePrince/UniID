import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  AUTH_JWT_SECRET: z.string().min(32, "AUTH_JWT_SECRET must be at least 32 chars"),
  SESSION_COOKIE_SECRET: z.string().min(32, "SESSION_COOKIE_SECRET must be at least 32 chars"),
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

export type AppConfig = z.infer<typeof envSchema>;

let cached: AppConfig | undefined;

export function config(): AppConfig {
  if (cached) return cached;
  cached = parseEnv();
  return cached;
}
