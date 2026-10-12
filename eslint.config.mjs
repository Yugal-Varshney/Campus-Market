// ESLint 9 flat config. Next's recommended rules (React, hooks, a11y basics, Core Web Vitals).
import { FlatCompat } from '@eslint/eslintrc';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  { ignores: ['.next/**', 'node_modules/**', 'e2e/**', 'next-env.d.ts', 'supabase/**'] },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
];

export default config;
