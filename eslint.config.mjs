import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Agent skill packs (templates/examples), not app code.
    ".claude/**",
    // Vendored MediaPipe runtime (generated wasm glue), not app code.
    "public/mediapipe/**",
    // Vendored minified files copied from node_modules (avatar lip-sync worklet).
    "public/interview/**",
    // Vendored MediaPipe Emscripten runtime (face detection), not app code.
    "public/mediapipe/**",
  ]),
]);

export default eslintConfig;
