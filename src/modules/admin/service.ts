/**
 * AdminService — 系统级管理操作（仅 role=admin 可调）。
 *
 * 公开接口：
 *   - listUsers / updateUser / deleteUser / disableUser / enableUser / setRole / resetPassword
 *   - listApps（跨所有应用）
 *   - getGlobalConfig / setGlobalConfig
 *   - getDefaultQuota / setDefaultQuota
 */
import { prisma } from "@/shared/prisma";
import { hashPassword } from "@/shared/iam";
import { ApiError } from "@/shared/errors";
import { AuditService } from "@/shared/audit";
import { config } from "@/shared/config";
import {
  AUTH_SECURITY_CONFIG_KEY,
  type AuthSecurityConfig,
  normalizeAuthSecurityConfig
} from "@/modules/auth/security-config";

const now = () => Math.floor(Date.now() / 1000);

export class AdminService {
  static async listUsers(filter?: { search?: string; limit?: number }) {
    const take = Math.min(filter?.limit ?? 50, 200);
    return prisma.user.findMany({
      where: filter?.search
        ? {
            OR: [
              { username: { contains: filter.search } },
              { email: { contains: filter.search } }
            ]
          }
        : undefined,
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        locale: true,
        role: true,
        deletedAt: true,
        createdAt: true,
        _count: { select: { appSessions: true, appsOwned: true, recordsOwned: true, filesOwned: true } }
      }
    });
  }

  static async updateUser(
    actorId: string,
    userId: string,
    patch: { username?: string; email?: string | null; displayName?: string | null; locale?: string }
  ) {
    const before = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true, email: true, displayName: true, locale: true }
    });
    if (!before) throw new ApiError("AUTH_SESSION_NOT_FOUND", { message: "error.detail.userNotFound" });

    const data: { username?: string; email?: string | null; displayName?: string | null; locale?: string; updatedAt: number } = {
      updatedAt: now()
    };
    if (patch.username !== undefined) data.username = patch.username;
    if (patch.email !== undefined) data.email = patch.email;
    if (patch.displayName !== undefined) data.displayName = patch.displayName;
    if (patch.locale !== undefined) data.locale = patch.locale;

    try {
      const after = await prisma.user.update({ where: { id: userId }, data });
      AuditService.log({
        userId: actorId,
        action: "admin.user.update",
        resourceType: "user",
        resourceId: userId,
        before,
        after: {
          username: after.username,
          email: after.email,
          displayName: after.displayName,
          locale: after.locale
        }
      });
      return after;
    } catch {
      throw new ApiError("AUTH_INVALID_CREDENTIALS", { message: "error.detail.usernameEmailTaken" });
    }
  }

  static async deleteUser(actorId: string, userId: string) {
    if (actorId === userId) throw new ApiError("APP_FORBIDDEN", { message: "error.detail.cannotDeleteSelf" });
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        _count: {
          select: {
            appsOwned: true,
            appSessions: true,
            authorizations: true,
            recordsOwned: true,
            filesOwned: true
          }
        }
      }
    });
    if (!user) throw new ApiError("AUTH_SESSION_NOT_FOUND", { message: "error.detail.userNotFound" });

    const hasAssets =
      user._count.appsOwned > 0 ||
      user._count.appSessions > 0 ||
      user._count.authorizations > 0 ||
      user._count.recordsOwned > 0 ||
      user._count.filesOwned > 0;
    if (hasAssets) {
      throw new ApiError("APP_FORBIDDEN", { message: "error.detail.userHasAssets" });
    }

    await prisma.user.delete({ where: { id: userId } });
    AuditService.log({
      userId: actorId,
      action: "admin.user.delete",
      resourceType: "user",
      resourceId: userId,
      before: { username: user.username }
    });
  }

  static async disableUser(actorId: string, userId: string) {
    if (actorId === userId) throw new ApiError("APP_FORBIDDEN", { message: "error.detail.cannotDisableSelf" });
    const before = await prisma.user.findUnique({ where: { id: userId } });
    if (!before) throw new ApiError("AUTH_SESSION_NOT_FOUND", { message: "error.detail.userNotFound" });
    const after = await prisma.user.update({
      where: { id: userId },
      data: { deletedAt: now() }
    });
    await prisma.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now() }
    });
    await prisma.appSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now() }
    });
    AuditService.log({
      userId: actorId,
      action: "admin.user.disable",
      resourceType: "user",
      resourceId: userId,
      before: { deletedAt: before.deletedAt },
      after: { deletedAt: after.deletedAt }
    });
  }

  static async enableUser(actorId: string, userId: string) {
    const after = await prisma.user.update({
      where: { id: userId },
      data: { deletedAt: null }
    });
    AuditService.log({
      userId: actorId,
      action: "admin.user.enable",
      resourceType: "user",
      resourceId: userId,
      after: { deletedAt: after.deletedAt }
    });
  }

  static async setRole(actorId: string, userId: string, role: "user" | "admin") {
    if (actorId === userId) throw new ApiError("APP_FORBIDDEN", { message: "error.detail.cannotChangeOwnRole" });
    const before = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!before) throw new ApiError("AUTH_SESSION_NOT_FOUND");
    const after = await prisma.user.update({
      where: { id: userId },
      data: { role, updatedAt: now() }
    });
    AuditService.log({
      userId: actorId,
      action: "admin.user.set_role",
      resourceType: "user",
      resourceId: userId,
      before: { role: before.role },
      after: { role: after.role }
    });
  }

  static async resetPassword(actorId: string, userId: string, newPassword: string) {
    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash, updatedAt: now() }
    });
    await prisma.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now() }
    });
    await prisma.appSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now() }
    });
    AuditService.log({
      userId: actorId,
      action: "admin.user.reset_password",
      resourceType: "user",
      resourceId: userId
    });
  }

  static async listAllApps(limit = 100) {
    return prisma.app.findMany({
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 500),
      include: {
        owner: { select: { id: true, username: true } },
        _count: { select: { authorizations: true, records: true, files: true, appSessions: true } }
      }
    });
  }

  static async setAppStatus(actorId: string, appId: string, status: "active" | "suspended" | "archived") {
    const before = await prisma.app.findUnique({ where: { id: appId }, select: { status: true } });
    if (!before) throw new ApiError("APP_NOT_FOUND");
    await prisma.app.update({ where: { id: appId }, data: { status, updatedAt: now() } });
    AuditService.log({
      appId,
      userId: actorId,
      action: "admin.app.set_status",
      resourceType: "app",
      resourceId: appId,
      before: { status: before.status },
      after: { status }
    });
  }

  // ---------- Global config ----------

  static async listConfig(): Promise<Record<string, unknown>> {
    const rows = await prisma.globalConfig.findMany();
    const out: Record<string, unknown> = {};
    for (const r of rows) {
      try { out[r.key] = JSON.parse(r.value); }
      catch { out[r.key] = r.value; }
    }
    return out;
  }

  static async setConfig(actorId: string, key: string, value: unknown) {
    const json = JSON.stringify(value);
    const before = await prisma.globalConfig.findUnique({ where: { key } });
    await prisma.globalConfig.upsert({
      where: { key },
      create: { key, value: json, updatedAt: now() },
      update: { value: json, updatedAt: now() }
    });
    AuditService.log({
      userId: actorId,
      action: "admin.config.set",
      resourceType: "global_config",
      resourceId: key,
      before: before ? safeParse(before.value) : null,
      after: value
    });
  }

  // ---------- Default quota（写入到 GlobalConfig 内） ----------

  static async getDefaultQuota() {
    const c = config();
    const rows = await this.listConfig();
    const defaults = {
      rpsLimit: c.QUOTA_RPS_DEFAULT,
      dailyApiCalls: c.QUOTA_DAILY_API_DEFAULT,
      monthlyStorageBytes: c.QUOTA_MONTHLY_STORAGE_BYTES_DEFAULT,
      fnInvocationsDaily: c.QUOTA_FN_INVOCATIONS_DAILY_DEFAULT
    };
    const override = (rows["default_quota"] as Record<string, number> | undefined) ?? {};
    return { ...defaults, ...override };
  }

  static async setDefaultQuota(actorId: string, patch: Partial<{
    rpsLimit: number;
    dailyApiCalls: number;
    monthlyStorageBytes: number;
    fnInvocationsDaily: number;
  }>) {
    const cur = await this.getDefaultQuota();
    const merged = { ...cur, ...patch };
    await this.setConfig(actorId, "default_quota", merged);
    return merged;
  }

  // ---------- Auth security（写入到 GlobalConfig 内） ----------

  static async getAuthSecurityConfig(): Promise<AuthSecurityConfig> {
    const rows = await this.listConfig();
    return normalizeAuthSecurityConfig(rows[AUTH_SECURITY_CONFIG_KEY]);
  }

  static async setAuthSecurityConfig(actorId: string, patch: Partial<AuthSecurityConfig>) {
    const cur = await this.getAuthSecurityConfig();
    const merged = normalizeAuthSecurityConfig({ ...cur, ...patch });
    await this.setConfig(actorId, AUTH_SECURITY_CONFIG_KEY, merged);
    return merged;
  }
}

function safeParse(s: string): unknown {
  try { return JSON.parse(s); } catch { return s; }
}
