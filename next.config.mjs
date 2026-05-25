/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // QuickJS sandbox runs as wasm; allow large bodies for file uploads.
    // node-cron 内部用到 worker_threads/child_process，不能让 webpack 静态打包。
    serverComponentsExternalPackages: [
      "argon2",
      "quickjs-emscripten",
      "@aws-sdk/client-s3",
      "node-cron",
      "pino",
      "pino-pretty"
    ],
    // 启用 Next.js instrumentation 钩子（用于 audit/cron/webhooks boot）。
    instrumentationHook: true,
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      const externals = Array.isArray(config.externals)
        ? config.externals
        : config.externals
          ? [config.externals]
          : [];
      // node-cron 内部用到 worker_threads/child_process，必须 require() 在运行时解析。
      externals.push({ "node-cron": "commonjs node-cron" });
      // pino / pino-pretty 依赖 Node 内置模块与可选 worker，避免打进 vendor-chunks。
      externals.push(
        { pino: "commonjs pino" },
        { "pino-pretty": "commonjs pino-pretty" },
        { "thread-stream": "commonjs thread-stream" }
      );
      // 把 node:* scheme 全部按 commonjs 外部模块解析（next 14 webpack 默认不识别此 scheme）。
      externals.push(({ request }, cb) => {
        if (request && request.startsWith("node:")) {
          return cb(null, "commonjs " + request);
        }
        cb();
      });
      config.externals = externals;
    }
    return config;
  },
  async headers() {
    return [
      {
        // SSE realtime stream must not be buffered by proxies.
        source: "/api/v1/realtime/stream",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-transform" },
          { key: "X-Accel-Buffering", value: "no" }
        ]
      }
    ];
  }
};

export default nextConfig;
