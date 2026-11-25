import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../..');

describe('PWA Service Worker & Netlify/Vercel Hosting Configuration', () => {
  it('configures anti-stale-cache headers and SPA redirects on Netlify and Vercel', () => {
    const netlify = fs.readFileSync(path.join(ROOT, 'netlify.toml'), 'utf8');
    const vercel = fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8');
    const headers = fs.readFileSync(path.join(ROOT, 'public/_headers'), 'utf8');
    const redirects = fs.readFileSync(path.join(ROOT, 'public/_redirects'), 'utf8');

    expect(netlify).toContain('no-cache, no-store, must-revalidate');
    expect(netlify).toContain('max-age=31536000, immutable');
    expect(vercel).toContain('no-cache, no-store, must-revalidate');
    expect(headers).toContain('/sw.js');
    expect(redirects).toContain('/*    /index.html   200');
  });

  it('maintains valid PWA manifest and Service Worker cache-busting template', () => {
    const sw = fs.readFileSync(path.join(ROOT, 'public/sw.js'), 'utf8');
    const manifest = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'public/manifest.webmanifest'), 'utf8'),
    ) as { name: string; short_name: string };

    expect(sw).toContain('hajodeya-__HAJODEYA_BUILD_ID__');
    expect(sw).toContain('networkFirstHtml');
    expect(sw).toContain('cacheFirstAsset');
    expect(manifest.short_name).toBe('Ha Jodeya');
  });
});
