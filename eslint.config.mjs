import { FlatCompat } from "@eslint/eslintrc";
import path from "node:path";
import { fileURLToPath } from "node:url";

const compat = new FlatCompat({
  baseDirectory: path.dirname(fileURLToPath(import.meta.url)),
});

const config = [
  {
    ignores: ["eslint.config.mjs", ".next/**", "node_modules/**"],
  },
  ...compat.extends("next/core-web-vitals"),
];

export default config;
