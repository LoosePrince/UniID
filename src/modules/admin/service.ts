/**
 * AdminService — 系统级管理操作（仅 role=admin 可调）。
 *
 * 公开接口：
 *   - listUsers / disableUser / enableUser / setRole / resetPassword
 *   - listApps（跨所有应用）
 *   - getGlobalConfig / setGlobalConfig
 *   - getDefaultQuota / setDefaultQuota
 */
import { prisma } from "@/shared/prisma";
import { hashPassword } from "@/shared/iam";
import { ApiError } from "@/shared/errors";
import { AuditService } from "@/shared/audit";
import { config } from "@/shared/config";

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
        role: true,
        deletedAt: true,
        createdAt: true,
        _count: { select: { appSessions: true, recordsOwned: true, filesOwned: true } }
      }
    });
  }

  static async disableUser(actorId: string, userId: string) {
    if (actorId === userId) throw new ApiError("APP_FORBIDDEN", { message: "不能禁用自己" });
    const before = await prisma.user.findUnique({ where: { id: userId } });
    if (!before) throw new ApiError("AUTH_SESSION_NOT_FOUND", { message: "用户不存在" });
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
    if (actorId === userId) throw new ApiError("APP_FORBIDDEN", { message: "不能修改自己角色" });
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
}

function safeParse(s: string): unknown {
  try { return JSON.parse(s); } catch { return s; }
}
