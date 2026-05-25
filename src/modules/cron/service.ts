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
    const t = now();
    const job = await prisma.cronJob.create({
      data: {
        appId: input.appId,
        name: input.name,
        cronExpr: input.cronExpr,
        fnId: input.fnId,
        payload: input.payload ? JSON.stringify(input.payload) : null,
        createdAt: t,
        updatedAt: t,
        createdById: input.createdById
      }
    });
    this.startTask(job);
    return job;
  }

  static async setActive(jobId: string, isActive: boolean) {
    const t = now();
    const job = await prisma.cronJob.update({
      where: { id: jobId },
      data: { isActive: isActive ? 1 : 0, updatedAt: t }
    });
    if (isActive) this.startTask(job);
    else this.stopTask(jobId);
    return job;
  }

  static async deleteOne(jobId: string) {
    this.stopTask(jobId);
    await prisma.cronJob.delete({ where: { id: jobId } });
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

  private static stopTask(jobId: string) {
    const t = tasks.get(jobId);
    if (t) {
      t.stop();
      tasks.delete(jobId);
    }
  }
}
