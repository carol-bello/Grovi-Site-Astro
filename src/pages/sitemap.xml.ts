import type { APIRoute } from 'astro';
import { getPublishedPages, getPublishedPosts } from '../utils/wpContent';
import { SITE_URL, normalizePath, toIsoGmt } from '../utils/seo';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const GET: APIRoute = async () => {
  const pages = getPublishedPages();
  const posts = getPublishedPosts();

  const entries: string[] = [];

  for (const page of pages) {
    const path = normalizePath(page.path);
    const loc = `${SITE_URL}${path}`;
    const lastmod = toIsoGmt(page.modified_gmt || page.date_gmt || page.modified || page.date) || '2026-10-16T00:00:00+00:00';
    const isHome = path === '/';
    const depth = path.split('/').filter(Boolean).length;
    const priority = isHome ? '1.0' : depth === 1 ? '0.9' : depth === 2 ? '0.8' : '0.7';
    const changefreq = isHome ? 'daily' : 'weekly';

    entries.push(`  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${escapeXml(lastmod)}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`);
  }

  for (const post of posts) {
    const path = normalizePath(post.path);
    const loc = `${SITE_URL}${path}`;
    const lastmod = toIsoGmt(post.modified_gmt || post.date_gmt || post.modified || post.date) || '2026-10-16T00:00:00+00:00';

    entries.push(`  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${escapeXml(lastmod)}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
