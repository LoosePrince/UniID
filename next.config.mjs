const isLowMemBuild = process.env.UNIID_LOW_MEM_BUILD === "1";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  ...(isLowMemBuild
    ? {
        eslint: { ignoreDuringBuilds: true },
        typescript: { ignoreBuildErrors: true },
      }
    : {}),
  experimental: {
    ...(isLowMemBuild ? { cpus: 1 } : {}),
    // QuickJS sandbox runs as wasm; allow large bodies for file uploads.
    // node-cron 内部用到 worker_threads/child_process，不能让 webpack 静态打包。
    serverComponentsExternalPackages: [
      "argon2",
      "quickjs-emscripten",
      "better-sqlite3",
      "@aws-sdk/client-s3",
      "node-cron",
      "pino",
      "pino-pretty"
    ],
    // 启用 Next.js instrumentation 钩子（用于 audit/cron/webhooks boot）。
    instrumentationHook: true,
  },
  webpack: (config, { isServer }) => {
    if (isLowMemBuild) {
      config.parallelism = 1;
      if (config.cache && typeof config.cache === "object") {
        config.cache = { ...config.cache, maxMemoryGenerations: 1 };
      }
    }
    if (isServer) {
      const externals = Array.isArray(config.externals)
        ? config.externals
        : config.externals
          ? [config.externals]
          : [];
      // node-cron 内部用到 worker_threads/child_process，必须 require() 在运行时解析。
      externals.push({ "node-cron": "commonjs node-cron" });
      // better-sqlite3 是原生 Node 扩展，运行时加载，不能被 webpack 静态打包。
      externals.push(
        { "better-sqlite3": "commonjs better-sqlite3" },
        { bindings: "commonjs bindings" },
        { "file-uri-to-path": "commonjs file-uri-to-path" }
      );
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
