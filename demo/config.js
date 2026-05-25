/**
 * Demo 站点与 UniID API 的连接配置。
 * 通过 URL 查询参数可覆盖（便于联调）：
 *   ?api=http://127.0.0.1:3000&appId=app_demo_blog
 */
(function () {
  const params = new URLSearchParams(window.location.search);
  const apiParam = params.get("api");
  const apiPort = params.get("apiPort") || "3000";

  let url;
  if (apiParam) {
    url = apiParam.replace(/\/$/, "");
  } else {
    const host = params.get("apiHost") || window.location.hostname;
    const protocol = window.location.protocol === "https:" ? "https:" : "http:";
    url = `${protocol}//${host}:${apiPort}`;
  }

  window.UNIID_DEMO = {
    url,
    appId: params.get("appId") || "app_demo_blog",
    theme: params.get("theme") || "light"
  };

  /** @returns {import('@uniid/sdk').UniID} */
  window.createUniID = function createUniID(overrides) {
    const cfg = { ...window.UNIID_DEMO, ...overrides };
    const raw = window.UniID;
    const Ctor =
      typeof raw === "function" ? raw : raw?.default ?? raw?.UniID;
    if (typeof Ctor !== "function") {
      throw new Error(
        "未加载 UniID SDK。请先执行 npm run demo:prepare，并确认 <script src=\"./sdk/uniid.umd.js\"> 可访问。"
      );
    }
    return new Ctor({
      url: cfg.url,
      appId: cfg.appId,
      theme: cfg.theme
    });
  };
})();
