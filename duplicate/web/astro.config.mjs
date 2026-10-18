import { defineConfig } from 'astro/config';
import { cp } from 'node:fs/promises';
try { process.loadEnvFile(); } catch (error) { if (error.code !== 'ENOENT') throw error; }
export default defineConfig({
  site: process.env.SITE_URL || 'https://example.invalid',
  output: 'static',
  build: { inlineStylesheets: 'never' },
  vite: { build: { assetsInlineLimit: 0 } },
  integrations: [{ name: 'athena-generated-media', hooks: {
    'astro:build:done': async ({ dir }) => {
      // Images are downloaded during prerender, after Astro's public-file copy.
      await cp(new URL('./public/media/', import.meta.url), new URL('media/', dir), { recursive: true });
    },
  } }],
});
