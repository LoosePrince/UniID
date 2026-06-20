import { z } from "zod";
import { defineRoute, idSchema } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireAppAccess, requireConsoleAuth } from "@/shared/iam";
import { prisma } from "@/shared/prisma";

type SearchItemType =
  | "app"
  | "schema"
  | "file"
  | "database"
  | "function"
  | "cron"
  | "webhook"
  | "api_key"
  | "audit";

interface SearchItem {
  id: string;
  type: SearchItemType;
  title: string;
  subtitle?: string;
  href: string;
}

const query = z.object({
  q: z.string().trim().max(120).optional(),
  appId: idSchema.optional(),
  limit: z.coerce.number().int().min(1).max(40).optional()
});

function includes(value: string | null | undefined, term: string) {
  return Boolean(value && value.toLowerCase().includes(term));
}

function take(items: SearchItem[], limit: number) {
  return items.slice(0, limit);
}

async function searchApps(userId: string, role: string, term: string, limit: number): Promise<SearchItem[]> {
  const apps = await prisma.app.findMany({
    where: {
      ...(role === "admin"
        ? {}
        : {
            OR: [{ ownerId: userId }, { admins: { some: { userId } } }]
          }),
      ...(term
        ? {
            OR: [
              { id: { contains: term } },
              { name: { contains: term } },
              { primaryDomain: { contains: term } },
              { description: { contains: term } },
              { status: { contains: term } }
            ]
          }
        : {})
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: { id: true, name: true, primaryDomain: true, status: true }
  });

  return apps.map((app) => ({
    id: app.id,
    type: "app",
    title: app.name,
    subtitle: `${app.primaryDomain} · ${app.status}`,
    href: `/console/apps/${app.id}`
  }));
}

async function searchAppResources(appId: string, rawTerm: string, limit: number): Promise<SearchItem[]> {
  await requireAppAccess(appId);
  const term = rawTerm.toLowerCase();
  const perType = Math.max(3, Math.ceil(limit / 4));

  const [schemas, files, databases, functions, cronJobs, webhooks, apiKeys, audits] = await Promise.all([
    prisma.dataSchema.findMany({
      where: {
        appId,
        ...(rawTerm
          ? {
              OR: [{ id: { contains: rawTerm } }, { dataType: { contains: rawTerm } }, { description: { contains: rawTerm } }]
            }
          : {})
      },
      orderBy: { updatedAt: "desc" },
      take: perType,
      select: { id: true, dataType: true, description: true }
    }),
    prisma.fileObject.findMany({
      where: {
        appId,
        deletedAt: null,
        ...(rawTerm
          ? {
              OR: [
                { id: { contains: rawTerm } },
                { originalName: { contains: rawTerm } },
                { mimeType: { contains: rawTerm } },
                { ownerId: { contains: rawTerm } },
                { visibility: { contains: rawTerm } }
              ]
            }
          : {})
      },
      orderBy: { createdAt: "desc" },
      take: perType,
      select: { id: true, originalName: true, mimeType: true, size: true }
    }),
    prisma.appDatabase.findMany({
      where: {
        appId,
        ...(rawTerm
          ? {
              OR: [
                { id: { contains: rawTerm } },
                { name: { contains: rawTerm } },
                { filename: { contains: rawTerm } },
                { status: { contains: rawTerm } },
                { note: { contains: rawTerm } }
              ]
            }
          : {})
      },
      orderBy: { updatedAt: "desc" },
      take: perType,
      select: { id: true, name: true, filename: true, status: true }
    }),
    prisma.functionDefinition.findMany({
      where: {
        appId,
        ...(rawTerm
          ? {
              OR: [{ id: { contains: rawTerm } }, { name: { contains: rawTerm } }, { description: { contains: rawTerm } }]
            }
          : {})
      },
      orderBy: { updatedAt: "desc" },
      take: perType,
      select: { id: true, name: true, description: true, isActive: true }
    }),
    prisma.cronJob.findMany({
      where: {
        appId,
        ...(rawTerm
          ? {
              OR: [{ id: { contains: rawTerm } }, { name: { contains: rawTerm } }, { cronExpr: { contains: rawTerm } }, { lastStatus: { contains: rawTerm } }]
            }
          : {})
      },
      orderBy: { updatedAt: "desc" },
      take: perType,
      select: { id: true, name: true, cronExpr: true, isActive: true }
    }),
    prisma.webhook.findMany({
      where: {
        appId,
        ...(rawTerm
          ? {
              OR: [{ id: { contains: rawTerm } }, { name: { contains: rawTerm } }, { url: { contains: rawTerm } }, { events: { contains: rawTerm } }]
            }
          : {})
      },
      orderBy: { updatedAt: "desc" },
      take: perType,
      select: { id: true, name: true, url: true, isActive: true }
    }),
    prisma.appApiKey.findMany({
      where: {
        appId,
        ...(rawTerm
          ? {
              OR: [{ id: { contains: rawTerm } }, { label: { contains: rawTerm } }, { prefix: { contains: rawTerm } }, { scopes: { contains: rawTerm } }]
            }
          : {})
      },
      orderBy: { createdAt: "desc" },
      take: perType,
      select: { id: true, label: true, prefix: true, revokedAt: true }
    }),
    prisma.auditLog.findMany({
      where: {
        appId,
        ...(rawTerm
          ? {
              OR: [
                { id: { contains: rawTerm } },
                { action: { contains: rawTerm } },
                { resourceType: { contains: rawTerm } },
                { resourceId: { contains: rawTerm } },
                { userId: { contains: rawTerm } },
                { ip: { contains: rawTerm } },
                { requestId: { contains: rawTerm } },
                { before: { contains: rawTerm } },
                { after: { contains: rawTerm } }
              ]
            }
          : {})
      },
      orderBy: { createdAt: "desc" },
      take: perType,
      select: { id: true, action: true, resourceType: true, resourceId: true }
    })
  ]);

  const items: SearchItem[] = [
    ...schemas.map((schema) => ({
      id: schema.id,
      type: "schema" as const,
      title: schema.dataType,
      subtitle: schema.description ?? undefined,
      href: `/console/apps/${appId}/schemas`
    })),
    ...files.map((file) => ({
      id: file.id,
      type: "file" as const,
      title: file.originalName,
      subtitle: `${file.mimeType} · ${file.size} bytes`,
      href: `/console/apps/${appId}/files`
    })),
    ...databases.map((database) => ({
      id: database.id,
      type: "database" as const,
      title: database.name,
      subtitle: `${database.filename} · ${database.status}`,
      href: `/console/apps/${appId}/databases`
    })),
    ...functions.map((fn) => ({
      id: fn.id,
      type: "function" as const,
      title: fn.name,
      subtitle: fn.description ?? (fn.isActive ? "active" : "disabled"),
      href: `/console/apps/${appId}/functions`
    })),
    ...cronJobs.map((job) => ({
      id: job.id,
      type: "cron" as const,
      title: job.name,
      subtitle: `${job.cronExpr} · ${job.isActive ? "active" : "paused"}`,
      href: `/console/apps/${appId}/cron`
    })),
    ...webhooks.map((hook) => ({
      id: hook.id,
      type: "webhook" as const,
      title: hook.name,
      subtitle: `${hook.url} · ${hook.isActive ? "active" : "paused"}`,
      href: `/console/apps/${appId}/webhooks`
    })),
    ...apiKeys.map((key) => ({
      id: key.id,
      type: "api_key" as const,
      title: key.label,
      subtitle: `${key.prefix}... · ${key.revokedAt ? "revoked" : "active"}`,
      href: `/console/apps/${appId}/settings#api-keys`
    })),
    ...audits.map((log) => ({
      id: log.id,
      type: "audit" as const,
      title: log.action,
      subtitle: [log.resourceType, log.resourceId].filter(Boolean).join(" · "),
      href: `/console/apps/${appId}/audit${log.resourceId ? `?resourceId=${encodeURIComponent(log.resourceId)}` : ""}`
    }))
  ];

  if (!term) return take(items, limit);
  return take(
    items.filter((item) => includes(item.title, term) || includes(item.subtitle, term) || includes(item.id, term) || includes(item.type, term)),
    limit
  );
}

export const GET = withCors(
  "admin-only",
  defineRoute({
    schema: { query },
    handler: async ({ query: q }) => {
      const auth = await requireConsoleAuth();
      const rawTerm = q?.q ?? "";
      const limit = q?.limit ?? 12;
      if (q?.appId) {
        return { items: await searchAppResources(q.appId, rawTerm, limit) };
      }
      return { items: await searchApps(auth.user.id, auth.user.role, rawTerm, limit) };
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));
