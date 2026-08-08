import globals from 'globals';
import { baseConfig } from './base.js';

/**
 * Flat config for apps/api.
 *
 * @type {import("eslint").Linter.Config[]}
 */
export const nestConfig = [
  ...baseConfig,
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
      sourceType: 'commonjs',
    },
    rules: {
      // Nest's DI relies on parameter decorators and metadata reflection.
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  },
];

export default nestConfig;
