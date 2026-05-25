import { defineConfig } from "tsup";

// 注意：paths 相对当前工作目录，而 npm run sdk:build 在仓库根目录执行，
// 所以这里要写出完整相对路径 packages/sdk-core/...。
const SRC = "packages/sdk-core/src/index.ts";
const OUT = "packages/sdk-core/dist";
const TSCONFIG = "packages/sdk-core/tsconfig.json";

export default defineConfig([
  {
    entry: { index: SRC },
    outDir: OUT,
    format: ["esm", "cjs"],
    dts: { resolve: true, entry: SRC, compilerOptions: { incremental: false } },
    sourcemap: true,
    clean: true,
    tsconfig: TSCONFIG,
    target: "es2020"
  },
  {
    entry: { "uniid.umd": SRC },
    outDir: OUT,
    format: ["iife"],
    globalName: "UniID",
    sourcemap: false,
    minify: true,
    tsconfig: TSCONFIG,
    target: "es2018"
  }
]);
