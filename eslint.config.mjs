import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const config = [
  { ignores: [".next/**", "node_modules/**", "playwright-report/**", "test-results/**", "next-env.d.ts"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@next/next/no-img-element": "error",
      "@typescript-eslint/no-unused-vars": "error",
      "react-hooks/exhaustive-deps": "error",
      "import/no-anonymous-default-export": "off"
    }
  }
];

export default config;
