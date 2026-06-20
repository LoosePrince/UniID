/**
 * CronService — 定时任务的 CRUD + 调度。
 *
 * 调度模式：单实例（next.js 单进程）。启动时调用 boot()，
 * 它会为每个 active CronJob 注册 node-cron task；触发时调用 FunctionsService.invoke。
 *
 * 在 next.js dev 模式下可能会被重启；boot() 是幂等的（旧任务先 stop 再注册）。
 */
import cron, { type ScheduledTask } from "node-cron";
import { prisma } from "@/shared/prisma";
import { ApiError } from "@/shared/errors";
import { FunctionsService } from "@/modules/functions";
import { logger } from "@/shared/logger";

const now = () => Math.floor(Date.now() / 1000);
const DEFAULT_RUN_LEASE_SECONDS = 30;

function leaseSecondsForCron(cronExpr: string): number {
  const parts = cronExpr.trim().split(/\s+/);
  const seconds = parts[0];
  if (parts.length !== 6 || !seconds) return DEFAULT_RUN_LEASE_SECONDS;
  if (seconds === "*") return 1;

  const step = seconds.match(/^\*\/(\d+)$/)?.[1];
  if (!step) return DEFAULT_RUN_LEASE_SECONDS;

  const value = Number(step);
  if (!Number.isFinite(value) || value <= 1) return 1;
  return Math.max(1, Math.min(DEFAULT_RUN_LEASE_SECONDS, value - 1));
}

declare global {
  // eslint-disable-next-line no-var
  var __uniid_cron_tasks__: Map<string, ScheduledTask> | undefined;
}

const tasks: Map<string, ScheduledTask> =
  globalThis.__uniid_cron_tasks__ ?? new Map<string, ScheduledTask>();
if (process.env.NODE_ENV !== "production") {
  globalThis.__uniid_cron_tasks__ = tasks;
}

export class CronService {
  static async listForApp(appId: string) {
    return prisma.cronJob.findMany({
      where: { appId },
      orderBy: { createdAt: "desc" }
    });
  }

  static async create(input: {
    appId: string;
    name: string;
    cronExpr: string;
    fnId: string;
    payload?: unknown;
    createdById?: string;
  }) {
    if (!cron.validate(input.cronExpr)) throw new ApiError("CRON_INVALID_EXPR");
    const fn = await prisma.functionDefinition.findFirst({
      where: { id: input.fnId, appId: input.appId }
    });
    if (!fn) throw new ApiError("FUNC_NOT_FOUND");
    const t = now();
    const job = await prisma.cronJob.create({
      data: {
        appId: input.appId,
        name: input.name,
        cronExpr: input.cronExpr,
        fnId: fn.id,
        payload: input.payload === undefined ? null : JSON.stringify(input.payload),
        createdAt: t,
        updatedAt: t,
        createdById: input.createdById
      }
    });
    this.startTask(job);
    return job;
  }

  static async setActive(appId: string, jobId: string, isActive: boolean) {
    const existing = await prisma.cronJob.findFirst({ where: { id: jobId, appId } });
    if (!existing) throw new ApiError("CRON_NOT_FOUND");
    const t = now();
    const job = await prisma.cronJob.update({
      where: { id: existing.id },
      data: { isActive: isActive ? 1 : 0, nextRunAt: isActive ? null : existing.nextRunAt, updatedAt: t }
    });
    if (isActive) this.startTask(job);
    else this.stopTask(job.id);
    return job;
  }

  static async update(input: {
    appId: string;
    jobId: string;
    name?: string;
    cronExpr?: string;
    fnId?: string;
    payload?: unknown;
    isActive?: boolean;
  }) {
    if (input.cronExpr && !cron.validate(input.cronExpr)) throw new ApiError("CRON_INVALID_EXPR");
    const existing = await prisma.cronJob.findFirst({ where: { id: input.jobId, appId: input.appId } });
    if (!existing) throw new ApiError("CRON_NOT_FOUND");
    let fnId = input.fnId;
    if (fnId) {
      const fn = await prisma.functionDefinition.findFirst({
        where: { id: fnId, appId: input.appId }
      });
      if (!fn) throw new ApiError("FUNC_NOT_FOUND");
      fnId = fn.id;
    }
    const job = await prisma.cronJob.update({
      where: { id: existing.id },
      data: {
        name: input.name,
        cronExpr: input.cronExpr,
        fnId,
        payload: input.payload === undefined ? undefined : JSON.stringify(input.payload),
        isActive: input.isActive === undefined ? undefined : input.isActive ? 1 : 0,
        nextRunAt: input.cronExpr || input.isActive === true ? null : undefined,
        updatedAt: now()
      }
    });
    if (job.isActive) this.startTask(job);
    else this.stopTask(job.id);
    return job;
  }

  static async runNow(appId: string, jobId: string) {
    const job = await prisma.cronJob.findFirst({ where: { id: jobId, appId } });
    if (!job) throw new ApiError("CRON_NOT_FOUND");
    try {
      const payload = job.payload ? JSON.parse(job.payload) : {};
      const result = await FunctionsService.invoke({
        appId: job.appId,
        fnIdOrName: job.fnId,
        payload,
        trigger: "cron"
      });
      await prisma.cronJob.update({
        where: { id: job.id },
        data: { lastRunAt: now(), lastStatus: result.status }
      });
      return result;
    } catch (err) {
      await prisma.cronJob.update({
        where: { id: job.id },
        data: { lastRunAt: now(), lastStatus: "error" }
      });
      throw err;
    }
  }

  static async deleteOne(appId: string, jobId: string) {
    const job = await prisma.cronJob.findFirst({ where: { id: jobId, appId } });
    if (!job) throw new ApiError("CRON_NOT_FOUND");
    this.stopTask(job.id);
    await prisma.cronJob.delete({ where: { id: job.id } });
  }

  static async boot() {
    const active = await prisma.cronJob.findMany({ where: { isActive: 1 } });
    for (const j of active) this.startTask(j);
    logger.info({ count: active.length }, "cron tasks scheduled");
  }

  private static startTask(job: {
    id: string;
    appId: string;
    name: string;
    cronExpr: string;
    fnId: string;
    payload: string | null;
  }) {
    this.stopTask(job.id);
    if (!cron.validate(job.cronExpr)) return;
    const task = cron.schedule(job.cronExpr, async () => {
      const claimed = await this.claimScheduledRun(job);
      if (!claimed) return;

      try {
        const payload = job.payload ? JSON.parse(job.payload) : {};
        const r = await FunctionsService.invoke({
          appId: job.appId,
          fnIdOrName: job.fnId,
          payload,
          trigger: "cron"
        });
        await prisma.cronJob.update({
          where: { id: job.id },
          data: { lastRunAt: now(), lastStatus: r.status }
        });
      } catch (err) {
        logger.error({ err, jobId: job.id }, "cron invocation failed");
        await prisma.cronJob.update({
          where: { id: job.id },
          data: { lastRunAt: now(), lastStatus: "error" }
        });
      }
    });
    tasks.set(job.id, task);
  }

  private static async claimScheduledRun(job: { id: string; cronExpr: string }) {
    const t = now();
    const result = await prisma.cronJob.updateMany({
      where: {
        id: job.id,
        isActive: 1,
        OR: [{ nextRunAt: null }, { nextRunAt: { lte: t } }]
      },
      data: {
        nextRunAt: t + leaseSecondsForCron(job.cronExpr),
        updatedAt: t
      }
    });
    return result.count > 0;
  }

  private static stopTask(jobId: string) {
    const t = tasks.get(jobId);
    if (t) {
      t.stop();
      tasks.delete(jobId);
    }
  }
}
