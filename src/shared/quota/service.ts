/**
 * QuotaService — 每个应用的配额读取、记账与限额检查。
 *
 * - 配额来自 Quota 表（按 appId 唯一）。
 * - 使用按 period (YYYY-MM-DD UTC) 聚合到 QuotaUsage 表。
 * - 触发限额时抛出 ApiError("QUOTA_EXCEEDED")。
 */
import { prisma } from "@/shared/prisma";
import { ApiError } from "@/shared/errors";
import { getSystemConfig } from "@/shared/system-config";

const todayUTC = () => {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
};

const monthUTC = () => {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

export type QuotaMetric = "apiCalls" | "fnInvocations" | "storageBytes" | "egressBytes";

function periodForMetric(metric: QuotaMetric) {
  return metric === "apiCalls" || metric === "fnInvocations" ? todayUTC() : monthUTC();
}

export class QuotaService {
  static async getOrDefault(appId: string) {
    const existing = await prisma.quota.findUnique({ where: { appId } });
    if (existing) return existing;
    const c = await getSystemConfig();
    return prisma.quota.create({
      data: {
        appId,
        rpsLimit: c.quotaRpsDefault,
        dailyApiCalls: c.quotaDailyApiDefault,
        monthlyStorageBytes: BigInt(c.quotaMonthlyStorageBytesDefault),
        monthlyEgressBytes: BigInt(c.quotaMonthlyEgressBytesDefault),
        fnInvocationsDaily: c.quotaFnInvocationsDailyDefault,
        updatedAt: Math.floor(Date.now() / 1000)
      }
    });
  }

  static async update(appId: string, patch: Partial<{
    rpsLimit: number;
    dailyApiCalls: number;
    monthlyStorageBytes: number | bigint;
    monthlyEgressBytes: number | bigint;
    fnInvocationsDaily: number;
  }>) {
    await this.getOrDefault(appId);
    const data: Record<string, unknown> = { updatedAt: Math.floor(Date.now() / 1000) };
    if (patch.rpsLimit !== undefined) data.rpsLimit = patch.rpsLimit;
    if (patch.dailyApiCalls !== undefined) data.dailyApiCalls = patch.dailyApiCalls;
    if (patch.fnInvocationsDaily !== undefined) data.fnInvocationsDaily = patch.fnInvocationsDaily;
    if (patch.monthlyStorageBytes !== undefined) data.monthlyStorageBytes = BigInt(patch.monthlyStorageBytes);
    if (patch.monthlyEgressBytes !== undefined) data.monthlyEgressBytes = BigInt(patch.monthlyEgressBytes);
    return prisma.quota.update({ where: { appId }, data });
  }

  /** 当天使用量（apiCalls/fnInvocations）。 */
  static async dailyUsage(appId: string) {
    const period = todayUTC();
    const row = await prisma.quotaUsage.findUnique({
      where: { appId_period: { appId, period } }
    });
    return row ?? { appId, period, apiCalls: 0, fnInvocations: 0, storageBytes: 0, egressBytes: 0 };
  }

  /** 指定指标当前周期使用量。 */
  static async usageForMetric(appId: string, metric: QuotaMetric) {
    const period = periodForMetric(metric);
    const row = await prisma.quotaUsage.findUnique({
      where: { appId_period: { appId, period } }
    });
    return row ?? { appId, period, apiCalls: 0, fnInvocations: 0, storageBytes: BigInt(0), egressBytes: BigInt(0) };
  }

  /** 累加使用量并检查是否超额。 */
  static async consume(appId: string, metric: QuotaMetric, amount: number | bigint = 1) {
    const quota = await this.getOrDefault(appId);
    const period = periodForMetric(metric);
    const amt = typeof amount === "bigint" ? amount : BigInt(amount);
    const amtNum = typeof amount === "number" ? amount : Number(amount);

    const usage = await prisma.quotaUsage.upsert({
      where: { appId_period: { appId, period } },
      create: {
        appId,
        period,
        apiCalls: metric === "apiCalls" ? amtNum : 0,
        fnInvocations: metric === "fnInvocations" ? amtNum : 0,
        storageBytes: metric === "storageBytes" ? amt : BigInt(0),
        egressBytes: metric === "egressBytes" ? amt : BigInt(0)
      },
      update: {
        ...(metric === "apiCalls" && { apiCalls: { increment: amtNum } }),
        ...(metric === "fnInvocations" && { fnInvocations: { increment: amtNum } }),
        ...(metric === "storageBytes" && { storageBytes: { increment: amt } }),
        ...(metric === "egressBytes" && { egressBytes: { increment: amt } })
      }
    });

    if (metric === "apiCalls" && usage.apiCalls > quota.dailyApiCalls) {
      throw new ApiError("QUOTA_EXCEEDED", { message: "error.detail.quotaDailyApiExceeded" });
    }
    if (metric === "fnInvocations" && usage.fnInvocations > quota.fnInvocationsDaily) {
      throw new ApiError("QUOTA_EXCEEDED", { message: "error.detail.quotaDailyFnExceeded" });
    }
    if (metric === "storageBytes" && usage.storageBytes > quota.monthlyStorageBytes) {
      throw new ApiError("QUOTA_EXCEEDED", { message: "error.detail.quotaMonthlyStorageExceeded" });
    }
    if (metric === "egressBytes" && usage.egressBytes > quota.monthlyEgressBytes) {
      throw new ApiError("QUOTA_EXCEEDED", { message: "error.detail.quotaMonthlyEgressExceeded" });
    }

    return usage;
  }

  /** 月度存储使用量（按月聚合 file 的 size，扣除已删除）。 */
  static async monthlyStorage(appId: string): Promise<bigint> {
    const rows = await prisma.fileObject.findMany({
      where: { appId, deletedAt: null },
      select: { size: true }
    });
    return rows.reduce((a: bigint, b: { size: number }) => a + BigInt(b.size), BigInt(0));
  }

  /** 释放（删除）记账，例如文件删除后回收存储统计。 */
  static async releaseStorage(appId: string, bytes: number | bigint) {
    const period = monthUTC();
    const amt = typeof bytes === "bigint" ? bytes : BigInt(bytes);
    await prisma.quotaUsage.upsert({
      where: { appId_period: { appId, period } },
      create: { appId, period, storageBytes: -amt },
      update: { storageBytes: { decrement: amt } }
    });
  }
}
