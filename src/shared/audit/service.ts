/**
 * AuditService — 写入审计日志。
 *
 * 设计原则：写入永远 best-effort（异步、不抛错），即使审计失败也不应影响业务流程。
 */
import { prisma } from "@/shared/prisma";
import { logger } from "@/shared/logger";
import type { Prisma } from "@prisma/client";

const now = () => Math.floor(Date.now() / 1000);

export type AuditResourceType =
  | "user"
  | "app"
  | "app_domain"
  | "app_admin"
  | "app_api_key"
  | "authorization"
  | "policy"
  | "schema"
  | "schema_version"
  | "record"
  | "file"
  | "file_share"
  | "function"
  | "function_deployment"
  | "cron"
  | "webhook"
  | "quota"
  | "session"
  | "global_config";

export interface AuditEntry {
  appId?: string | null;
  userId?: string | null;
  action: string; // e.g. "record.create" | "auth.login" | "app.domain.add"
  resourceType: AuditResourceType;
  resourceId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

function serializeOrNull(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  try {
    const s = JSON.stringify(v);
    return s.length > 16 * 1024 ? s.slice(0, 16 * 1024) + "…[truncated]" : s;
  } catch {
    return null;
  }
}

export class AuditService {
  static log(entry: AuditEntry): void {
    // fire-and-forget；不 await，错误吞掉并 log。
    prisma.auditLog
      .create({
        data: {
          appId: entry.appId ?? null,
          userId: entry.userId ?? null,
          action: entry.action,
          resourceType: entry.resourceType,
          resourceId: entry.resourceId ?? null,
          before: serializeOrNull(entry.before),
          after: serializeOrNull(entry.after),
          ip: entry.ip ?? null,
          userAgent: entry.userAgent ?? null,
          requestId: entry.requestId ?? null,
          createdAt: now()
        }
      })
      .catch((err: unknown) => logger.error({ err, action: entry.action }, "audit log write failed"));
  }

  static async list(filters: {
    appId?: string;
    userId?: string;
    action?: string;
    resourceType?: string;
    resourceId?: string;
    query?: string;
    from?: number;
    to?: number;
    limit?: number;
    cursor?: string;
  }) {
    const take = Math.min(filters.limit ?? 50, 200);
    const query = filters.query?.trim();
    const createdAt: Prisma.IntFilter | undefined =
      filters.from || filters.to
        ? {
            ...(filters.from ? { gte: filters.from } : {}),
            ...(filters.to ? { lte: filters.to } : {})
          }
        : undefined;

    return prisma.auditLog.findMany({
      where: {
        ...(filters.appId && { appId: filters.appId }),
        ...(filters.userId && { userId: filters.userId }),
        ...(filters.action && { action: { contains: filters.action } }),
        ...(filters.resourceType && { resourceType: filters.resourceType }),
        ...(filters.resourceId && { resourceId: { contains: filters.resourceId } }),
        ...(createdAt && { createdAt }),
        ...(query && {
          OR: [
            { action: { contains: query } },
            { resourceType: { contains: query } },
            { resourceId: { contains: query } },
            { before: { contains: query } },
            { after: { contains: query } },
            { requestId: { contains: query } },
            { ip: { contains: query } },
            { userId: { contains: query } }
          ]
        })
      },
      orderBy: { createdAt: "desc" },
      take,
      ...(filters.cursor && { cursor: { id: filters.cursor }, skip: 1 })
    });
  }
}
