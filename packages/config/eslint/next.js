import { FlatCompat } from '@eslint/eslintrc';
import { baseConfig } from './base.js';

const compat = new FlatCompat();

/**
 * Flat config for apps/web. `eslint-config-next` is still eslintrc-shaped,
 * so it is bridged through FlatCompat.
 *
 * @type {import("eslint").Linter.Config[]}
 */
export const nextConfig = [
  ...baseConfig,
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
];

export default nextConfig;
