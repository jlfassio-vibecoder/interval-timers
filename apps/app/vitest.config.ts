import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'vitest/config';
import path from 'path';

// Hydrate Supabase public env for tests so `supabase-instance` is not "placeholder + stderr" in CI/local without .env.
loadEnv({ path: path.resolve(__dirname, '../../.env') });
loadEnv({ path: path.resolve(__dirname, '../../.env.local'), override: true });
loadEnv({ path: path.resolve(__dirname, '.env'), override: true });
loadEnv({ path: path.resolve(__dirname, '.env.local'), override: true });

const vitestSupabaseUrl =
  process.env.PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  'https://vitest-placeholder.supabase.co';
const vitestSupabaseAnon =
  process.env.PUBLIC_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJ2aXRlc3QifQ.placeholder';

export default defineConfig({
  define: {
    'import.meta.env.MODE': JSON.stringify('test'),
    'import.meta.env.DEV': JSON.stringify(true),
    'import.meta.env.PUBLIC_SUPABASE_URL': JSON.stringify(vitestSupabaseUrl),
    'import.meta.env.PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(vitestSupabaseAnon),
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(vitestSupabaseUrl),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(vitestSupabaseAnon),
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
