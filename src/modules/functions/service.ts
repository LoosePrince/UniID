/**
 * FunctionsService — CRUD + invoke + 部署版本管理。
 */
import { createHash } from "node:crypto";
import { prisma } from "@/shared/prisma";
import { ApiError } from "@/shared/errors";
import { runSandbox, type SandboxResult } from "@/shared/sandbox";
import { config } from "@/shared/config";

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

    const env = fn.env ? safeParseEnv(fn.env) : undefined;
    const result = await runSandbox({
      source: dep.sourceCode,
      input: input.payload,
      env,
      timeoutMs: fn.timeoutMs,
      memoryMb: fn.memoryMb,
      functionName: fn.name
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

  static async listInvocations(fnId: string, limit = 50) {
    return prisma.functionInvocation.findMany({
      where: { fnId },
      orderBy: { createdAt: "desc" },
      take: limit
    });
  }
}

function safeParseEnv(s: string): Record<string, string> | undefined {
  try {
    const p = JSON.parse(s);
    if (p && typeof p === "object") return p as Record<string, string>;
  } catch {}
  return undefined;
}
