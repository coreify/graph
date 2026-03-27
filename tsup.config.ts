import { defineConfig } from "tsup"

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/core/index.ts",
    "src/react/index.ts",
    "src/algorithms/index.ts",
    "src/serialization/index.ts",
    "src/persist/index.ts",
    "src/worker/index.ts",
    "src/worker/thread.ts",
  ],
  format: ["cjs", "esm"],
  dts: {
    compilerOptions: {
      ignoreDeprecations: "6.0",
    },
  },
  clean: true,
  target: "es2020",
  treeshake: true,
  splitting: false,
  bundle: false,
})
