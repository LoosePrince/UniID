import { prisma } from "@/shared/prisma";

export interface AuthSecurityConfig {
  emailVerificationEnabled: boolean;
  twoFactorEnabled: boolean;
}

export const AUTH_SECURITY_CONFIG_KEY = "auth_security";

export const DEFAULT_AUTH_SECURITY_CONFIG: AuthSecurityConfig = {
  emailVerificationEnabled: true,
  twoFactorEnabled: true
};

export async function getAuthSecurityConfig(): Promise<AuthSecurityConfig> {
  const row = await prisma.globalConfig.findUnique({
    where: { key: AUTH_SECURITY_CONFIG_KEY },
    select: { value: true }
  });
  if (!row) return { ...DEFAULT_AUTH_SECURITY_CONFIG };
  try {
    return normalizeAuthSecurityConfig(JSON.parse(row.value));
  } catch {
    return { ...DEFAULT_AUTH_SECURITY_CONFIG };
  }
}

export function normalizeAuthSecurityConfig(value: unknown): AuthSecurityConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...DEFAULT_AUTH_SECURITY_CONFIG };
  }
  const input = value as Partial<Record<keyof AuthSecurityConfig, unknown>>;
  return {
    emailVerificationEnabled:
      typeof input.emailVerificationEnabled === "boolean"
        ? input.emailVerificationEnabled
        : DEFAULT_AUTH_SECURITY_CONFIG.emailVerificationEnabled,
    twoFactorEnabled:
      typeof input.twoFactorEnabled === "boolean"
        ? input.twoFactorEnabled
        : DEFAULT_AUTH_SECURITY_CONFIG.twoFactorEnabled
  };
}
