import type { APIRoute } from 'astro';
import { getPublishedPosts } from '../utils/wpContent';
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
  const posts = getPublishedPosts();
  const entries = posts.map((post) => {
    const path = normalizePath(post.path);
    const loc = `${SITE_URL}${path}`;
    const lastmod = toIsoGmt(post.modified_gmt || post.date_gmt || post.modified || post.date) || '2026-10-16T00:00:00+00:00';

    return `  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${escapeXml(lastmod)}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
