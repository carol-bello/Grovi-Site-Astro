import type { APIRoute } from 'astro';
import { getPublishedPages, getPublishedPosts } from '../utils/wpContent';
import { SITE_URL, toIsoGmt } from '../utils/seo';

export const GET: APIRoute = async () => {
  const pages = getPublishedPages();
  const posts = getPublishedPosts();

  const latestPageMod = pages
    .map((p) => toIsoGmt(p.modified_gmt || p.date_gmt))
    .filter(Boolean)
    .sort()
    .pop() || '2026-10-16T00:00:00+00:00';

  const latestPostMod = posts
    .map((p) => toIsoGmt(p.modified_gmt || p.date_gmt))
    .filter(Boolean)
    .sort()
    .pop() || '2026-10-16T00:00:00+00:00';

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${SITE_URL}/page-sitemap.xml</loc>
    <lastmod>${latestPageMod}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${SITE_URL}/post-sitemap.xml</loc>
    <lastmod>${latestPostMod}</lastmod>
  </sitemap>
</sitemapindex>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
