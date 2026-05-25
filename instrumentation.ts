/**
 * Next.js Instrumentation — 在 Node 运行时启动时挂载后台服务。
 *
 * - Cron 调度（加载 active CronJob 并注册到 node-cron）
 * - Webhooks 事件订阅 / 投递循环
 * - Audit 事件监听
 *
 * 注意：Next.js 会在两种运行时触发此 hook（'nodejs' 和 'edge'）；
 * 我们只在 'nodejs' 里初始化 —— argon2/quickjs/sqlite 都是 Node 原生模块。
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const [{ CronService }, { WebhooksService }, { ensureAuditListenersBooted }] = await Promise.all([
    import("./src/modules/cron"),
    import("./src/modules/webhooks"),
    import("./src/shared/audit")
  ]);
  ensureAuditListenersBooted();
  WebhooksService.ensureBoot();
  await CronService.boot();
}
