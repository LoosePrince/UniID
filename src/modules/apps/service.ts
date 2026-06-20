/**
 * AppService — 应用注册 / 域名 / 成员管理。
 */
import { randomBytes } from "node:crypto";
import { resolveTxt } from "node:dns/promises";
import { prisma } from "@/shared/prisma";
import { ApiError } from "@/shared/errors";
import { generateApiKey, hashApiKey } from "@/shared/iam/api-key";
import { AuditService } from "@/shared/audit";

const now = () => Math.floor(Date.now() / 1000);
const DOMAIN_TOKEN_PREFIX = "uniid-domain-verification=";

export interface CreateAppInput {
  ownerId: string;
  adminIds?: string[];
  name: string;
  primaryDomain: string;
  description?: string;
}

export class AppService {
  static async listOwnedOrAdmin(userId: string) {
    return prisma.app.findMany({
      where: {
        OR: [{ ownerId: userId }, { admins: { some: { userId } } }]
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        primaryDomain: true,
        description: true,
        status: true,
        createdAt: true
      }
    });
  }

  static async listAll() {
    return prisma.app.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, primaryDomain: true, status: true, createdAt: true }
    });
  }

  static async get(appId: string) {
    const app = await prisma.app.findUnique({
      where: { id: appId },
      include: { domains: true, admins: { include: { user: true } }, owner: true, quota: true }
    });
    if (!app) throw new ApiError("APP_NOT_FOUND");
    return app;
  }

  static async create(input: CreateAppInput) {
    const owner = await prisma.user.findUnique({ where: { id: input.ownerId } });
    if (!owner || owner.deletedAt) {
      throw new ApiError("AUTH_SESSION_NOT_FOUND", { message: "error.detail.ownerUserNotFound" });
    }

    const adminIds = [...new Set(input.adminIds ?? [])].filter((id) => id !== input.ownerId);
    if (adminIds.length > 0) {
      const admins = await prisma.user.findMany({
        where: { id: { in: adminIds }, deletedAt: null },
        select: { id: true }
      });
      if (admins.length !== adminIds.length) {
        throw new ApiError("AUTH_SESSION_NOT_FOUND", { message: "error.detail.adminUserNotFound" });
      }
    }

    const existing = await prisma.app.findUnique({ where: { primaryDomain: input.primaryDomain } });
    if (existing) throw new ApiError("APP_DOMAIN_TAKEN");
    const t = now();
    return prisma.app.create({
      data: {
        ownerId: input.ownerId,
        name: input.name,
        primaryDomain: input.primaryDomain,
        description: input.description,
        createdAt: t,
        updatedAt: t,
        admins: {
          create: adminIds.map((userId) => ({ userId, createdAt: t }))
        },
        quota: {
          create: {
            rpsLimit: 60,
            dailyApiCalls: 1_000_000,
            monthlyStorageBytes: BigInt(10) * BigInt(1024) * BigInt(1024) * BigInt(1024),
            monthlyEgressBytes: BigInt(50) * BigInt(1024) * BigInt(1024) * BigInt(1024),
            fnInvocationsDaily: 100_000,
            updatedAt: t
          }
        }
      }
    });
  }

  static async update(
    appId: string,
    actorUserId: string,
    patch: { name?: string; description?: string; primaryDomain?: string; status?: string },
    actorRole?: string
  ) {
    const app = await this.get(appId);
    await this.requireOwnerOrAdmin(app.ownerId, app.admins, actorUserId, actorRole === "admin");
    if (patch.primaryDomain && patch.primaryDomain !== app.primaryDomain) {
      if (actorRole !== "admin") {
        throw new ApiError("APP_FORBIDDEN", { message: "error.detail.systemAdminOnlyPrimaryDomain" });
      }
      const taken = await prisma.app.findUnique({ where: { primaryDomain: patch.primaryDomain } });
      if (taken) throw new ApiError("APP_DOMAIN_TAKEN");
    }
    return prisma.app.update({
      where: { id: appId },
      data: { ...patch, updatedAt: now() }
    });
  }

  static async addDomain(appId: string, actorUserId: string, host: string, actorRole?: string) {
    const app = await this.get(appId);
    await this.requireOwnerOrAdmin(app.ownerId, app.admins, actorUserId, actorRole === "admin");
    if (actorRole !== "admin") {
      throw new ApiError("APP_FORBIDDEN", { message: "error.detail.systemAdminOnlyBindDomain" });
    }
    const exists = await prisma.appDomain.findUnique({ where: { host } });
    if (exists) throw new ApiError("APP_DOMAIN_TAKEN");
    const domain = await prisma.appDomain.create({
      data: { appId, host, verified: 0, verifyToken: makeDomainVerifyToken(), createdAt: now() }
    });
    AuditService.log({
      appId,
      userId: actorUserId,
      action: "app.domain.add",
      resourceType: "app_domain",
      resourceId: domain.id,
      after: { host: domain.host, verified: domain.verified }
    });
    return domain;
  }

  static async deleteDomain(appId: string, actorUserId: string, domainId: string, actorRole?: string) {
    const app = await this.get(appId);
    await this.requireOwnerOrAdmin(app.ownerId, app.admins, actorUserId, actorRole === "admin");
    if (actorRole !== "admin") {
      throw new ApiError("APP_FORBIDDEN", { message: "error.detail.systemAdminOnlyUnbindDomain" });
    }
    const domain = await prisma.appDomain.findFirst({ where: { id: domainId, appId } });
    if (!domain) throw new ApiError("APP_NOT_FOUND");
    await prisma.appDomain.delete({ where: { id: domainId } });
    AuditService.log({
      appId,
      userId: actorUserId,
      action: "app.domain.delete",
      resourceType: "app_domain",
      resourceId: domainId,
      before: { host: domain.host, verified: domain.verified }
    });
  }

  static async verifyDomain(appId: string, actorUserId: string, domainId: string, opts?: { manual?: boolean; actorRole?: string }) {
    const domain = await prisma.appDomain.findFirst({ where: { id: domainId, appId } });
    if (!domain) throw new ApiError("APP_NOT_FOUND");
    if (domain.verified === 1) return domain;

    if (!opts?.manual) {
      const token = domain.verifyToken ?? makeDomainVerifyToken();
      if (!domain.verifyToken) {
        await prisma.appDomain.update({ where: { id: domain.id }, data: { verifyToken: token } });
      }
      const ok = await dnsHasToken(domain.host, token);
      if (!ok) {
        throw new ApiError("APP_DOMAIN_VERIFY_FAILED", {
          details: domainVerificationRecord(domain.host, token)
        });
      }
    } else if (opts.actorRole !== "admin") {
      throw new ApiError("APP_FORBIDDEN");
    }

    const updated = await prisma.appDomain.update({
      where: { id: domain.id },
      data: { verified: 1 }
    });
    AuditService.log({
      appId,
      userId: actorUserId,
      action: opts?.manual ? "app.domain.verify.manual" : "app.domain.verify",
      resourceType: "app_domain",
      resourceId: domain.id,
      after: { host: updated.host, verified: updated.verified }
    });
    return updated;
  }

  static async refreshDomainVerifyToken(appId: string, actorUserId: string, domainId: string) {
    const domain = await prisma.appDomain.findFirst({ where: { id: domainId, appId } });
    if (!domain) throw new ApiError("APP_NOT_FOUND");
    const updated = await prisma.appDomain.update({
      where: { id: domain.id },
      data: { verifyToken: makeDomainVerifyToken(), verified: 0 }
    });
    AuditService.log({
      appId,
      userId: actorUserId,
      action: "app.domain.token.rotate",
      resourceType: "app_domain",
      resourceId: domain.id,
      after: { host: updated.host, verified: updated.verified }
    });
    return updated;
  }

  static domainVerificationRecord(host: string, token: string | null) {
    return domainVerificationRecord(host, token ?? makeDomainVerifyToken());
  }

  static async listApiKeys(appId: string) {
    return prisma.appApiKey.findMany({
      where: { appId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        label: true,
        prefix: true,
        scopes: true,
        createdAt: true,
        lastUsedAt: true,
        revokedAt: true,
        createdBy: { select: { id: true, username: true } }
      }
    });
  }

  static async createApiKey(input: { appId: string; label: string; scopes?: string[]; createdById: string; actorRole?: string }) {
    const app = await this.get(input.appId);
    await this.requireOwnerOrAdmin(app.ownerId, app.admins, input.createdById, input.actorRole === "admin");
    const generated = generateApiKey();
    const key = await prisma.appApiKey.create({
      data: {
        appId: input.appId,
        label: input.label,
        keyHash: generated.hash,
        prefix: generated.prefix,
        scopes: JSON.stringify(input.scopes?.length ? input.scopes : ["*"]),
        createdById: input.createdById,
        createdAt: now()
      },
      select: {
        id: true,
        label: true,
        prefix: true,
        scopes: true,
        createdAt: true,
        lastUsedAt: true,
        revokedAt: true,
        createdBy: { select: { id: true, username: true } }
      }
    });
    AuditService.log({
      appId: input.appId,
      userId: input.createdById,
      action: "app.api_key.create",
      resourceType: "app_api_key",
      resourceId: key.id,
      after: { label: key.label, prefix: key.prefix, scopes: key.scopes }
    });
    return { key, secret: generated.plain };
  }

  static async updateApiKey(input: { appId: string; keyId: string; actorUserId: string; actorRole?: string; label?: string; scopes?: string[] }) {
    const app = await this.get(input.appId);
    await this.requireOwnerOrAdmin(app.ownerId, app.admins, input.actorUserId, input.actorRole === "admin");
    const existing = await prisma.appApiKey.findFirst({ where: { id: input.keyId, appId: input.appId } });
    if (!existing) throw new ApiError("AUTH_INVALID_TOKEN");
    const updated = await prisma.appApiKey.update({
      where: { id: existing.id },
      data: {
        label: input.label,
        scopes: input.scopes ? JSON.stringify(input.scopes) : undefined
      }
    });
    AuditService.log({
      appId: input.appId,
      userId: input.actorUserId,
      action: "app.api_key.update",
      resourceType: "app_api_key",
      resourceId: existing.id,
      before: { label: existing.label, scopes: existing.scopes },
      after: { label: updated.label, scopes: updated.scopes }
    });
    return updated;
  }

  static async revokeApiKey(appId: string, keyId: string, actorUserId: string, actorRole?: string) {
    const app = await this.get(appId);
    await this.requireOwnerOrAdmin(app.ownerId, app.admins, actorUserId, actorRole === "admin");
    const existing = await prisma.appApiKey.findFirst({ where: { id: keyId, appId } });
    if (!existing) throw new ApiError("AUTH_INVALID_TOKEN");
    const updated = await prisma.appApiKey.update({
      where: { id: existing.id },
      data: { revokedAt: existing.revokedAt ?? now() }
    });
    AuditService.log({
      appId,
      userId: actorUserId,
      action: "app.api_key.revoke",
      resourceType: "app_api_key",
      resourceId: existing.id,
      before: { label: existing.label, revokedAt: existing.revokedAt },
      after: { revokedAt: updated.revokedAt }
    });
    return updated;
  }

  static async rotateApiKey(appId: string, keyId: string, actorUserId: string, actorRole?: string) {
    const app = await this.get(appId);
    await this.requireOwnerOrAdmin(app.ownerId, app.admins, actorUserId, actorRole === "admin");
    const existing = await prisma.appApiKey.findFirst({ where: { id: keyId, appId } });
    if (!existing) throw new ApiError("AUTH_INVALID_TOKEN");
    const generated = generateApiKey();
    const updated = await prisma.appApiKey.update({
      where: { id: existing.id },
      data: {
        keyHash: generated.hash,
        prefix: generated.prefix,
        lastUsedAt: null,
        revokedAt: null
      },
      select: {
        id: true,
        label: true,
        prefix: true,
        scopes: true,
        createdAt: true,
        lastUsedAt: true,
        revokedAt: true,
        createdBy: { select: { id: true, username: true } }
      }
    });
    AuditService.log({
      appId,
      userId: actorUserId,
      action: "app.api_key.rotate",
      resourceType: "app_api_key",
      resourceId: existing.id,
      before: { prefix: existing.prefix },
      after: { prefix: updated.prefix }
    });
    return { key: updated, secret: generated.plain };
  }

  static async authenticateApiKey(secret: string) {
    const keyHash = hashApiKey(secret);
    const row = await prisma.appApiKey.findUnique({
      where: { keyHash },
      include: {
        app: { include: { owner: true } }
      }
    });
    if (!row) throw new ApiError("AUTH_INVALID_TOKEN");
    if (row.revokedAt) throw new ApiError("AUTH_API_KEY_REVOKED");
    if (row.app.status !== "active") throw new ApiError("APP_FORBIDDEN");
    void prisma.appApiKey
      .update({ where: { id: row.id }, data: { lastUsedAt: now() } })
      .catch(() => {});
    return row;
  }

  static async addAdmin(appId: string, actorUserId: string, username: string) {
    const app = await this.get(appId);
    await this.requireOwnerOrAdmin(app.ownerId, app.admins, actorUserId);
    const target = await prisma.user.findUnique({ where: { username } });
    if (!target || target.deletedAt) {
      throw new ApiError("AUTH_INVALID_CREDENTIALS", { message: "error.detail.userNotFound" });
    }
    if (target.id === app.ownerId) {
      throw new ApiError("APP_FORBIDDEN", { message: "error.detail.ownerAlreadyFullAccess" });
    }
    return prisma.appAdmin.upsert({
      where: { appId_userId: { appId, userId: target.id } },
      create: { appId, userId: target.id, createdAt: now() },
      update: {}
    });
  }

  static async removeAdmin(appId: string, actorUserId: string, targetUserId: string) {
    const app = await this.get(appId);
    await this.requireOwnerOrAdmin(app.ownerId, app.admins, actorUserId);
    if (targetUserId === app.ownerId) {
      throw new ApiError("APP_FORBIDDEN", { message: "error.detail.ownerCannotRemoveSelf" });
    }
    await prisma.appAdmin.delete({
      where: { appId_userId: { appId, userId: targetUserId } }
    });
  }

  /** 危险操作：删除整个应用（含级联）。仅 owner 可执行。 */
  static async destroy(appId: string, actorUserId: string) {
    const app = await this.get(appId);
    if (app.ownerId !== actorUserId) {
      throw new ApiError("APP_FORBIDDEN", { message: "error.detail.ownerOnlyDeleteApp" });
    }
    await prisma.app.delete({ where: { id: appId } });
  }

  static async requireOwnerOrAdmin(
    ownerId: string,
    admins: { userId: string }[],
    userId: string,
    allowSystemAdmin = false
  ) {
    if (allowSystemAdmin) return;
    if (ownerId === userId) return;
    if (admins.some((a) => a.userId === userId)) return;
    throw new ApiError("APP_FORBIDDEN");
  }
}

function makeDomainVerifyToken() {
  return `${DOMAIN_TOKEN_PREFIX}${randomBytes(18).toString("base64url")}`;
}

function stripPort(host: string) {
  if (host.startsWith("[")) return host;
  return host.split(":")[0] ?? host;
}

function domainVerificationRecord(host: string, token: string) {
  const dnsHost = stripPort(host);
  return {
    type: "TXT",
    name: `_uniid-verify.${dnsHost}`,
    value: token
  };
}

async function dnsHasToken(host: string, token: string) {
  const record = domainVerificationRecord(host, token);
  try {
    const rows = await resolveTxt(record.name);
    return rows.some((parts) => parts.join("") === token);
  } catch {
    return false;
  }
}
