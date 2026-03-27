import { config } from "@repo/eslint-config/server-lib";

/** @type {import("eslint").Linter.Config} */
export default [
    ...config,
    {
        ignores: ['vitest.config.mjs'],
    },
];
