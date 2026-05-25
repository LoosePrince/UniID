import { defineConfig } from "tsup";

const SRC = "packages/sdk-react/src/index.ts";
const OUT = "packages/sdk-react/dist";
const TSCONFIG = "packages/sdk-react/tsconfig.json";

export default defineConfig({
  entry: { index: SRC },
  outDir: OUT,
  format: ["esm", "cjs"],
  dts: { entry: SRC, compilerOptions: { incremental: false } },
  sourcemap: true,
  clean: true,
  tsconfig: TSCONFIG,
  target: "es2020",
  external: ["react", "@uniid/sdk"]
});
