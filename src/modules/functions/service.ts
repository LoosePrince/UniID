/**
 * FunctionsService — CRUD + invoke + 部署版本管理。
 */
import { createHash } from "node:crypto";
import { prisma } from "@/shared/prisma";
import { ApiError } from "@/shared/errors";
import { runSandbox, type SandboxResult } from "@/shared/sandbox";
import { config } from "@/shared/config";
import { QuotaService } from "@/shared/quota";

const now = () => Math.floor(Date.now() / 1000);
const INPUT_PREVIEW_BYTES = 4 * 1024;

function hashSource(source: string): string {
  return createHash("sha256").update(source).digest("hex");
}

function truncate(s: unknown, limit = INPUT_PREVIEW_BYTES): string {
  try {
    const str = typeof s === "string" ? s : JSON.stringify(s);
    return str.length > limit ? str.slice(0, limit) + "…[truncated]" : str;
  } catch {
    return "";
  }
}

export class FunctionsService {
  static async listForApp(appId: string) {
    return prisma.functionDefinition.findMany({
      where: { appId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        runtime: true,
        isActive: true,
        memoryMb: true,
        timeoutMs: true,
        activeDeploymentId: true,
        createdAt: true,
        updatedAt: true
      }
    });
  }

  static async create(input: {
    appId: string;
    name: string;
    description?: string;
    memoryMb?: number;
    timeoutMs?: number;
    env?: Record<string, string>;
    createdById: string;
  }) {
    const t = now();
    const fn = await prisma.functionDefinition.create({
      data: {
        appId: input.appId,
        name: input.name,
        description: input.description,
        memoryMb: input.memoryMb ?? config().FN_DEFAULT_MEMORY_MB,
        timeoutMs: input.timeoutMs ?? config().FN_DEFAULT_TIMEOUT_MS,
        env: input.env ? JSON.stringify(input.env) : null,
        createdAt: t,
        updatedAt: t,
        createdById: input.createdById
      }
    });
    return fn;
  }

  static async deploy(input: {
    fnId: string;
    sourceCode: string;
    deployedById?: string;
  }) {
    const fn = await prisma.functionDefinition.findUnique({ where: { id: input.fnId } });
    if (!fn) throw new ApiError("FUNC_NOT_FOUND");
    if (!input.sourceCode || input.sourceCode.length === 0) {
      throw new ApiError("FUNC_INVALID_SOURCE");
    }
    const last = await prisma.functionDeployment.findFirst({
      where: { fnId: fn.id },
      orderBy: { version: "desc" },
      select: { version: true }
    });
    const version = (last?.version ?? 0) + 1;
    const t = now();
    const dep = await prisma.functionDeployment.create({
      data: {
        fnId: fn.id,
        version,
        sourceHash: hashSource(input.sourceCode),
        sourceCode: input.sourceCode,
        createdAt: t,
        deployedById: input.deployedById
      }
    });
    await prisma.functionDefinition.update({
      where: { id: fn.id },
      data: { activeDeploymentId: dep.id, updatedAt: t }
    });
    return dep;
  }

  static async update(input: {
    appId: string;
    fnId: string;
    description?: string;
    isActive?: boolean;
    memoryMb?: number;
    timeoutMs?: number;
    env?: Record<string, string> | null;
  }) {
    const fn = await prisma.functionDefinition.findFirst({
      where: { id: input.fnId, appId: input.appId }
    });
    if (!fn) throw new ApiError("FUNC_NOT_FOUND");
    return prisma.functionDefinition.update({
      where: { id: fn.id },
      data: {
        description: input.description,
        isActive: input.isActive === undefined ? undefined : input.isActive ? 1 : 0,
        memoryMb: input.memoryMb,
        timeoutMs: input.timeoutMs,
        env: input.env === undefined ? undefined : input.env ? JSON.stringify(input.env) : null,
        updatedAt: now()
      }
    });
  }

  static async deleteOne(appId: string, fnId: string) {
    const fn = await prisma.functionDefinition.findFirst({ where: { id: fnId, appId } });
    if (!fn) throw new ApiError("FUNC_NOT_FOUND");
    await prisma.functionDefinition.delete({ where: { id: fn.id } });
  }

  static async getForApp(appId: string, fnId: string) {
    const fn = await prisma.functionDefinition.findFirst({ where: { id: fnId, appId } });
    if (!fn) throw new ApiError("FUNC_NOT_FOUND");
    return fn;
  }

  static async invoke(input: {
    appId: string;
    fnIdOrName: string;
    payload: unknown;
    trigger: "http" | "cron" | "event" | "sdk";
  }): Promise<{ invocationId: string } & SandboxResult> {
    const fn = await prisma.functionDefinition.findFirst({
      where: {
        appId: input.appId,
        OR: [{ id: input.fnIdOrName }, { name: input.fnIdOrName }],
        isActive: 1
      }
    });
    if (!fn) throw new ApiError("FUNC_NOT_FOUND");
    if (!fn.activeDeploymentId) throw new ApiError("FUNC_NOT_FOUND");

    const dep = await prisma.functionDeployment.findUnique({ where: { id: fn.activeDeploymentId } });
    if (!dep) throw new ApiError("FUNC_NOT_FOUND");

    await QuotaService.consume(input.appId, "fnInvocations");

    const env = fn.env ? safeParseEnv(fn.env) : undefined;
    const result = await runSandbox({
      source: dep.sourceCode,
      input: input.payload,
      env,
      timeoutMs: fn.timeoutMs,
      memoryMb: fn.memoryMb,
      functionName: fn.name,
      appId: input.appId
    });

    const inv = await prisma.functionInvocation.create({
      data: {
        fnId: fn.id,
        deploymentId: dep.id,
        trigger: input.trigger,
        status: result.status,
        durationMs: result.durationMs,
        memoryPeakKb: result.memoryPeakKb,
        inputPreview: truncate(input.payload),
        output: result.output === undefined ? null : truncate(result.output),
        logs: result.logs.join("\n").slice(0, 8 * 1024),
        error: result.error ?? null,
        createdAt: now()
      }
    });

    return { invocationId: inv.id, ...result };
  }

  static async listInvocations(appId: string, fnId: string, limit = 50) {
    const fn = await prisma.functionDefinition.findFirst({ where: { id: fnId, appId } });
    if (!fn) throw new ApiError("FUNC_NOT_FOUND");
    return prisma.functionInvocation.findMany({
      where: { fnId: fn.id },
      orderBy: { createdAt: "desc" },
      take: limit
    });
  }

  static async listEventTriggers(appId: string) {
    const rows = await prisma.functionEventTrigger.findMany({
      where: { appId },
      orderBy: { createdAt: "desc" },
      include: { fn: { select: { id: true, name: true, isActive: true, activeDeploymentId: true } } }
    });
    return rows.map((row) => ({
      ...row,
      events: safeParseStringArray(row.events),
      filterJson: row.filter
    }));
  }

  static async createEventTrigger(input: {
    appId: string;
    name: string;
    fnId: string;
    events: string[];
    filter?: unknown;
    isActive?: boolean;
    createdById?: string;
  }) {
    const fn = await prisma.functionDefinition.findFirst({
      where: { id: input.fnId, appId: input.appId }
    });
    if (!fn) throw new ApiError("FUNC_NOT_FOUND");
    const t = now();
    return prisma.functionEventTrigger.create({
      data: {
        appId: input.appId,
        name: input.name,
        fnId: fn.id,
        events: JSON.stringify(normalizeEvents(input.events)),
        filter: input.filter === undefined ? null : JSON.stringify(input.filter),
        isActive: input.isActive === false ? 0 : 1,
        createdAt: t,
        updatedAt: t,
        createdById: input.createdById
      }
    });
  }

  static async updateEventTrigger(input: {
    appId: string;
    triggerId: string;
    name?: string;
    fnId?: string;
    events?: string[];
    filter?: unknown;
    isActive?: boolean;
  }) {
    const existing = await prisma.functionEventTrigger.findFirst({
      where: { id: input.triggerId, appId: input.appId }
    });
    if (!existing) throw new ApiError("FUNC_NOT_FOUND");
    let fnId = input.fnId;
    if (fnId) {
      const fn = await prisma.functionDefinition.findFirst({
        where: { id: fnId, appId: input.appId }
      });
      if (!fn) throw new ApiError("FUNC_NOT_FOUND");
      fnId = fn.id;
    }
    return prisma.functionEventTrigger.update({
      where: { id: existing.id },
      data: {
        name: input.name,
        fnId,
        events: input.events ? JSON.stringify(normalizeEvents(input.events)) : undefined,
        filter: input.filter === undefined ? undefined : input.filter === null ? null : JSON.stringify(input.filter),
        isActive: input.isActive === undefined ? undefined : input.isActive ? 1 : 0,
        updatedAt: now()
      }
    });
  }

  static async deleteEventTrigger(appId: string, triggerId: string) {
    const existing = await prisma.functionEventTrigger.findFirst({
      where: { id: triggerId, appId }
    });
    if (!existing) throw new ApiError("FUNC_NOT_FOUND");
    await prisma.functionEventTrigger.delete({ where: { id: existing.id } });
  }
}

function safeParseEnv(s: string): Record<string, string> | undefined {
  try {
    const p = JSON.parse(s);
    if (p && typeof p === "object") return p as Record<string, string>;
  } catch {}
  return undefined;
}

function normalizeEvents(events: string[]): string[] {
  return Array.from(new Set(events.map((event) => event.trim()).filter(Boolean)));
}

function safeParseStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}
