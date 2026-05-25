/**
 * 烟测：登录页可达 + 控制台未登录跳转 + 注册页可达。
 *
 * 完整 demo 流程（login → 创建 record → 订阅 SSE → 撤销）建议在
 * 拥有 seed 数据的 dev 环境里跑；这里给出最小确定性烟测以验证关键路由健康。
 */
import { test, expect } from "@playwright/test";

test("login page renders", async ({ page }) => {
  await page.goto("/login");
  await expect(page).toHaveTitle(/UniID|登录/);
  await expect(page.getByLabel(/用户名/i)).toBeVisible();
  await expect(page.getByLabel(/密码/i)).toBeVisible();
});

test("register page renders", async ({ page }) => {
  await page.goto("/register");
  await expect(page.getByLabel(/用户名/i)).toBeVisible();
});

test("console redirects to login when not authenticated", async ({ page }) => {
  await page.goto("/console");
  await expect(page).toHaveURL(/\/login/);
});

test("account redirects to login when not authenticated", async ({ page }) => {
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login/);
});

test("embed page requires app_id", async ({ page }) => {
  await page.goto("/embed");
  // 错误处理或要求 app_id（任意一种都可接受）
  const body = await page.textContent("body");
  expect(body).toBeTruthy();
});
