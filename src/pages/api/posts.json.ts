import type { APIRoute } from 'astro';
import { getPublishedPosts, getWpExport, stripHtml } from '../../utils/wpContent';

export const GET: APIRoute = async () => {
  const data = getWpExport();
  const mediaMap = new Map(data.media.map((m) => [m.id, m]));
  const postsPayload = getPublishedPosts().map((post) => {
    const mediaItem = post.featured_media ? mediaMap.get(post.featured_media) : undefined;
    return {
      id: post.id,
      date: post.date,
      slug: post.slug,
      link: post.path,
      title: { rendered: post.title.rendered },
      excerpt: { rendered: post.excerpt.rendered },
      categories: post.categories || [],
      _embedded: mediaItem
        ? {
            'wp:featuredmedia': [
              {
                source_url: mediaItem.source_url,
                alt_text: mediaItem.alt_text || stripHtml(post.title.rendered),
              },
            ],
          }
        : {},
    };
  });

  return new Response(JSON.stringify(postsPayload), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
