import { defineConfig } from "tsup";

const SRC = "packages/sdk-vue/src/index.ts";
const OUT = "packages/sdk-vue/dist";
const TSCONFIG = "packages/sdk-vue/tsconfig.json";

export default defineConfig({
  entry: { index: SRC },
  outDir: OUT,
  format: ["esm", "cjs"],
  dts: { entry: SRC, compilerOptions: { incremental: false } },
  sourcemap: true,
  clean: true,
  tsconfig: TSCONFIG,
  target: "es2020",
  external: ["vue", "@uniid/sdk"]
});
