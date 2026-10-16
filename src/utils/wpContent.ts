import fs from 'node:fs';
import path from 'node:path';

const EXPORT_PATH = path.resolve(process.cwd(), 'data/wp-export.json');
const SHELL_PATH = path.resolve(process.cwd(), 'src/data/astra-shell.json');

export interface WpItem {
  id: number;
  slug: string;
  status: string;
  type: 'page' | 'post';
  link: string;
  path: string;
  date: string;
  date_gmt: string;
  modified: string;
  modified_gmt: string;
  title: { rendered: string; raw: string };
  content: { rendered: string; raw: string };
  excerpt: { rendered: string; raw: string };
  author: number;
  featured_media: number;
  template: string;
  parent?: number;
  menu_order?: number;
  categories?: number[];
  tags?: number[];
  format?: string;
  rank_math?: Record<string, any>;
}

interface WpExportData {
  site_url: string;
  settings: Record<string, any>;
  categories: Array<{ id: number; name: string; slug: string }>;
  media: Array<{ id: number; source_url: string; alt_text: string; mime_type: string }>;
  pages: WpItem[];
  posts: WpItem[];
}

let cachedExport: WpExportData | null = null;
let cachedShell: { masthead: string; colophon: string } | null = null;

export function getWpExport(): WpExportData {
  if (!cachedExport) {
    const raw = fs.readFileSync(EXPORT_PATH, 'utf-8');
    cachedExport = JSON.parse(raw) as WpExportData;
  }
  return cachedExport;
}

export function getAstraShell(): { masthead: string; colophon: string } {
  if (!cachedShell) {
    const raw = fs.readFileSync(SHELL_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    cachedShell = {
      masthead: rewriteInternalLinks(parsed.masthead || ''),
      colophon: rewriteInternalLinks(parsed.colophon || ''),
    };
  }
  return cachedShell;
}

export function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&#038;/g, '&')
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&#8216;/g, '‘')
    .replace(/&#8217;/g, '’')
    .replace(/&#8220;/g, '“')
    .replace(/&#8221;/g, '”')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

export function stripHtml(html: string): string {
  if (!html) return '';
  return decodeHtmlEntities(html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
}

/**
 * Rewrites <a href="https://grovi-studio.com/..."> internal links to root-relative
 * so navigation works identically on localhost:4321 and in production, without touching
 * <img src="https://grovi-studio.com/wp-content/..."> or JSON-LD scripts.
 */
export function rewriteInternalLinks(html: string): string {
  if (!html) return '';
  return html
    .replace(/(<a\b[^>]*?\bhref=["'])https?:\/\/grovi-studio\.com(\/[^"']*)(["'])/gi, '$1$2$3')
    .replace(/(<a\b[^>]*?\bhref=["'])https?:\/\/grovi-studio\.com(["'])/gi, '$1/$2');
}

export function getHomePage(): WpItem {
  const data = getWpExport();
  const frontId = data.settings?.page_on_front || 14;
  const home = data.pages.find((p) => p.id === frontId) || data.pages.find((p) => p.path === '/');
  if (!home) {
    throw new Error('Home page not found in wp-export.json');
  }
  return home;
}

export function getPublishedPages(): WpItem[] {
  const data = getWpExport();
  return data.pages.filter((p) => p.status === 'publish');
}

export function getPublishedPosts(): WpItem[] {
  const data = getWpExport();
  return [...data.posts]
    .filter((p) => p.status === 'publish')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function getAllNonHomeItems(): WpItem[] {
  const pages = getPublishedPages().filter((p) => p.path !== '/' && p.id !== 14);
  const posts = getPublishedPosts();
  return [...pages, ...posts];
}

export function prepareItemContent(item: WpItem): string {
  let html = rewriteInternalLinks(item.content?.rendered || '');

  // If this is the /blog/ page (id 98), inject all published posts directly so client JS doesn't depend on external WP API
  if (item.id === 98 || item.slug === 'blog') {
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

    const preloadScript = `<script>window.__GROVI_STATIC_POSTS__ = ${JSON.stringify(postsPayload).replace(/<\//g, '<\\/')};</script>`;
    html =
      preloadScript +
      html.replace(
        /function fetchAllPosts\(page\)\s*\{[\s\S]*?return fetch\(apiBase[\s\S]*?\}\s*\}/,
        `function fetchAllPosts() {
          if (window.__GROVI_STATIC_POSTS__) {
            allPosts = window.__GROVI_STATIC_POSTS__;
            return Promise.resolve();
          }
          return fetch('/api/posts.json').then(function(r){ return r.json(); }).then(function(p){ allPosts = p; });
        }`
      );
  }

  return html;
}

export function formatSpanishDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const months = [
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
    ];
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  } catch {
    return dateStr;
  }
}

export function getPrevNextPost(postId: number): { prev?: WpItem; next?: WpItem } {
  const posts = getPublishedPosts();
  const idx = posts.findIndex((p) => p.id === postId);
  if (idx === -1) return {};
  return {
    // In WP, "Previous" is the older post (idx + 1 in desc order), "Next" is newer (idx - 1)
    prev: idx + 1 < posts.length ? posts[idx + 1] : undefined,
    next: idx - 1 >= 0 ? posts[idx - 1] : undefined,
  };
}
