/**
 * AppService — 应用注册 / 域名 / 成员管理。
 */
import { prisma } from "@/shared/prisma";
import { ApiError } from "@/shared/errors";

const now = () => Math.floor(Date.now() / 1000);

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
    return prisma.appDomain.create({
      data: { appId, host, verified: 0, createdAt: now() }
    });
  }

  static async deleteDomain(appId: string, actorUserId: string, domainId: string, actorRole?: string) {
    const app = await this.get(appId);
    await this.requireOwnerOrAdmin(app.ownerId, app.admins, actorUserId, actorRole === "admin");
    if (actorRole !== "admin") {
      throw new ApiError("APP_FORBIDDEN", { message: "error.detail.systemAdminOnlyUnbindDomain" });
    }
    await prisma.appDomain.delete({ where: { id: domainId } });
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
