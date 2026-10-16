import { getWpExport, decodeHtmlEntities, stripHtml, type WpItem } from './wpContent';

export const SITE_URL = 'https://grovi-studio.com';
export const DEFAULT_OG_IMAGE = 'https://grovi-studio.com/wp-content/uploads/2026/08/Grovi-logo-principal.png';
export const DEFAULT_LOGO_SQUARE = 'https://grovi-studio.com/wp-content/uploads/2026/08/Grovi-logo-principal-150x150.png';
export const DEFAULT_LOGO_HORIZONTAL = 'https://grovi-studio.com/wp-content/uploads/2026/10/grovi-logo-horizontal.png';

export interface OpenGraphMeta {
  locale: string;
  type: 'website' | 'article';
  title: string;
  description: string;
  url: string;
  siteName: string;
  updatedTime?: string;
  image: string;
  imageSecureUrl: string;
  imageWidth: number;
  imageHeight: number;
  imageAlt: string;
  imageType: string;
  publishedTime?: string;
  modifiedTime?: string;
  section?: string;
}

export interface TwitterCardMeta {
  card: 'summary_large_image' | 'summary';
  title: string;
  description: string;
  image: string;
  label1?: string;
  data1?: string;
  label2?: string;
  data2?: string;
}

export interface SeoMetadata {
  title: string;
  rawTitle: string;
  description: string;
  canonical: string;
  robots: string;
  keywords: string;
  og: OpenGraphMeta;
  twitter: TwitterCardMeta;
  jsonLd: {
    '@context': 'https://schema.org';
    '@graph': Array<Record<string, any>>;
  };
  jsonLdString: string;
  hasInlineJsonLd: boolean;
  inlineSchemaTypes: string[];
}

export interface SeoOptions {
  /**
   * When true, if `item.content.rendered` already contains an inline `Article` or `BlogPosting`
   * inside a `<script type="application/ld+json">` tag, omits adding another `BlogPosting`/`Article`
   * node in the head `@graph` to avoid duplicate article schemas.
   * Defaults to true.
   */
  avoidDuplicateArticleIfInline?: boolean;
  /**
   * When true, merges unique inline JSON-LD nodes (like `FAQPage`) into the main `@graph`
   * so the caller can strip inline `<script type="application/ld+json">` tags from the body.
   * Defaults to false (preserves body scripts as-is without duplicating them in head).
   */
  mergeInlineIntoGraph?: boolean;
}

/**
 * Normalizes a site path so it always starts and ends with `/`.
 */
export function normalizePath(pathStr?: string): string {
  if (!pathStr || pathStr === '/') return '/';
  const cleaned = pathStr.replace(/^https?:\/\/grovi-studio\.com/i, '').trim();
  if (!cleaned || cleaned === '/') return '/';
  const withLeading = cleaned.startsWith('/') ? cleaned : `/${cleaned}`;
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
}

/**
 * Ensures a date string is formatted as ISO 8601 with timezone offset (+00:00).
 */
export function toIsoGmt(dateStr?: string): string | undefined {
  if (!dateStr) return undefined;
  const trimmed = dateStr.trim();
  if (!trimmed) return undefined;
  if (/[+-]\d{2}:\d{2}$|Z$/i.test(trimmed)) {
    return trimmed.replace(/Z$/i, '+00:00');
  }
  return `${trimmed}+00:00`;
}

/**
 * Extracts all `<script type="application/ld+json">...</script>` JSON objects from HTML content.
 */
export function extractInlineJsonLd(contentHtml?: string): Array<Record<string, any>> {
  if (!contentHtml) return [];
  const results: Array<Record<string, any>> = [];
  const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(contentHtml)) !== null) {
    const rawJson = match[1]?.trim();
    if (!rawJson) continue;
    try {
      const parsed = JSON.parse(rawJson);
      if (parsed && typeof parsed === 'object') {
        results.push(parsed);
      }
    } catch {
      // Ignore malformed inline JSON-LD blocks
    }
  }
  return results;
}

/**
 * Returns the set of Schema.org `@type` values present in inline `<script type="application/ld+json">` blocks.
 */
export function extractInlineSchemaTypes(contentHtml?: string): Set<string> {
  const types = new Set<string>();
  const blocks = extractInlineJsonLd(contentHtml);

  const collectTypes = (node: any) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(collectTypes);
      return;
    }
    if (node['@type']) {
      if (Array.isArray(node['@type'])) {
        node['@type'].forEach((t: string) => types.add(String(t)));
      } else {
        types.add(String(node['@type']));
      }
    }
    if (Array.isArray(node['@graph'])) {
      node['@graph'].forEach(collectTypes);
    }
  };

  blocks.forEach(collectTypes);
  return types;
}

/**
 * Checks whether an HTML string already contains at least one `<script type="application/ld+json">` block.
 */
export function hasInlineJsonLd(contentHtml?: string): boolean {
  if (!contentHtml) return false;
  return /<script[^>]*type=["']application\/ld\+json["'][^>]*>/i.test(contentHtml);
}

/**
 * Removes inline `<script type="application/ld+json">...</script>` blocks from HTML content
 * (useful if `mergeInlineIntoGraph: true` is used).
 */
export function stripInlineJsonLd(contentHtml?: string): string {
  if (!contentHtml) return '';
  return contentHtml.replace(
    /<p>\s*<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>\s*<\/p>|<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi,
    ''
  );
}

/**
 * Estimates reading time in minutes from HTML content.
 */
export function estimateReadingTimeMinutes(contentHtml?: string): number {
  const plain = stripHtml(
    (contentHtml || '').replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, ' ')
  );
  const words = plain ? plain.split(/\s+/).filter(Boolean).length : 0;
  return Math.max(1, Math.round(words / 200));
}

/**
 * Cleans WordPress excerpt text, removing accidental navigation/chrome text.
 */
function getCleanExcerptFallback(item: WpItem): string {
  const rawExcerpt = stripHtml(item.excerpt?.rendered || item.excerpt?.raw || '');
  const withoutNav = rawExcerpt
    .replace(
      /^Servicios\s*🚀\s*Agencia de Marketing Digital[\s\S]*?(?:Agenda aqu[ií]|Agenda una llamada)\s*/i,
      ''
    )
    .replace(/^Saltar al contenido[\s\S]*?Volver a(?:l blog| herramientas)\s*/i, '')
    .replace(/\[&hellip;\]|\[\.\.\.\]/g, '')
    .trim();

  if (withoutNav && !withoutNav.includes('este_archivo_relleno')) {
    return withoutNav.slice(0, 160);
  }
  return '';
}

/**
 * Builds the BreadcrumbList Schema.org object for any page or post in `wp-export.json`.
 */
export function buildBreadcrumbSchema(item: WpItem, canonicalUrl: string, rawTitle: string): Record<string, any> {
  const data = getWpExport();
  const isHome = item.path === '/' || item.id === 14;
  const isPost = item.type === 'post';

  const itemListElement: Array<Record<string, any>> = [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Inicio',
      item: `${SITE_URL}/`,
    },
  ];

  if (isHome) {
    return {
      '@type': 'BreadcrumbList',
      '@id': `${canonicalUrl}#breadcrumb`,
      itemListElement,
    };
  }

  if (isPost) {
    const primaryCatId = item.categories?.[0];
    const category = primaryCatId ? data.categories.find((c) => c.id === primaryCatId) : undefined;
    if (category && category.slug !== 'uncategorized') {
      itemListElement.push({
        '@type': 'ListItem',
        position: 2,
        name: decodeHtmlEntities(category.name),
        item: `${SITE_URL}/category/${category.slug}/`,
      });
      itemListElement.push({
        '@type': 'ListItem',
        position: 3,
        name: rawTitle,
        item: canonicalUrl,
      });
    } else {
      itemListElement.push({
        '@type': 'ListItem',
        position: 2,
        name: 'Blog',
        item: `${SITE_URL}/blog/`,
      });
      itemListElement.push({
        '@type': 'ListItem',
        position: 3,
        name: rawTitle,
        item: canonicalUrl,
      });
    }
  } else {
    const segments = normalizePath(item.path).split('/').filter(Boolean);
    segments.forEach((seg, idx) => {
      const isLast = idx === segments.length - 1;
      const segPath = `/${segments.slice(0, idx + 1).join('/')}/`;
      const parentPage = !isLast ? data.pages.find((p) => normalizePath(p.path) === segPath) : undefined;
      const segName = isLast
        ? rawTitle
        : parentPage
          ? decodeHtmlEntities(parentPage.title?.raw || parentPage.title?.rendered || seg)
          : seg.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

      itemListElement.push({
        '@type': 'ListItem',
        position: idx + 2,
        name: segName,
        item: `${SITE_URL}${segPath}`,
      });
    });
  }

  return {
    '@type': 'BreadcrumbList',
    '@id': `${canonicalUrl}#breadcrumb`,
    itemListElement,
  };
}

/**
 * Generates the complete Schema.org `@graph` JSON-LD for Grovi Studio and the given page/post,
 * avoiding duplicate schemas when `item.content.rendered` already includes inline JSON-LD.
 */
export function generateJsonLd(
  item: WpItem,
  options: SeoOptions = {}
): { '@context': 'https://schema.org'; '@graph': Array<Record<string, any>> } {
  const { avoidDuplicateArticleIfInline = true, mergeInlineIntoGraph = false } = options;
  const data = getWpExport();
  const isHome = item.path === '/' || item.id === 14;
  const isPost = item.type === 'post';

  const rm = item.rank_math || (item as any)[' rank_math'] || {};
  const rawTitle = decodeHtmlEntities(item.title?.raw || item.title?.rendered || 'Grovi Studio');
  const seoTitle = getResolvedTitle(item, rm, rawTitle);
  const seoDescription = getResolvedDescription(item, rm);
  const canonicalUrl = rm.rank_math_canonical_url || `${SITE_URL}${normalizePath(item.path)}`;
  const focusKeyword = rm.rank_math_focus_keyword || 'growth marketing, agencia seo, marketing digital b2b';

  const mediaItem = item.featured_media ? data.media.find((m) => m.id === item.featured_media) : undefined;
  const primaryImageUrl = mediaItem?.source_url || (isHome ? DEFAULT_LOGO_HORIZONTAL : DEFAULT_OG_IMAGE);
  const primaryImageWidth = mediaItem ? 1059 : isHome ? 200 : 1080;
  const primaryImageHeight = mediaItem ? 556 : isHome ? 200 : 1080;

  const publishedIso = toIsoGmt(item.date_gmt || item.date);
  const modifiedIso = toIsoGmt(item.modified_gmt || item.modified);

  const primaryCatId = item.categories?.[0];
  const category = primaryCatId ? data.categories.find((c) => c.id === primaryCatId) : undefined;
  const articleSection = category ? decodeHtmlEntities(category.name) : undefined;

  const contentHtml = item.content?.rendered || '';
  const inlineTypes = extractInlineSchemaTypes(contentHtml);

  // 1. Organization + MarketingAgency + ProfessionalService
  const organizationNode: Record<string, any> = {
    '@type': ['Organization', 'MarketingAgency', 'ProfessionalService'],
    '@id': `${SITE_URL}/#organization`,
    name: 'Grovi Studio',
    alternateName: ['grovi-studio.com', 'Grovi', 'C² Growth Studio by Grovi'],
    url: `${SITE_URL}/`,
    logo: {
      '@type': 'ImageObject',
      '@id': `${SITE_URL}/#logo`,
      url: DEFAULT_LOGO_SQUARE,
      contentUrl: DEFAULT_LOGO_SQUARE,
      caption: 'Grovi Studio',
      inLanguage: 'es-CO',
    },
    image: DEFAULT_OG_IMAGE,
    description:
      'Agencia de Growth Marketing B2B, SEO Técnico, Paid Media, Analítica de Datos (BI) y Automatización con IA para e-commerce y negocios de alto ticket en Latinoamérica y Estados Unidos.',
    email: 'hola@grovi-studio.com',
    telephone: '+573103235087',
    priceRange: '$$$',
    areaServed: [
      { '@type': 'Country', name: 'Colombia' },
      { '@type': 'Country', name: 'México' },
      { '@type': 'Country', name: 'Estados Unidos' },
      { '@type': 'Country', name: 'Chile' },
      { '@type': 'Country', name: 'Perú' },
      { '@type': 'Country', name: 'Argentina' },
    ],
    knowsAbout: [
      'Growth Marketing B2B',
      'Search Engine Optimization (SEO)',
      'Generative Engine Optimization (GEO / AEO)',
      'Paid Media (Google Ads, Meta Ads, LinkedIn Ads)',
      'Data Analytics, Looker Studio & Google BigQuery',
      'Server-Side Tracking & Meta Conversions API (CAPI)',
      'AI Agents & Marketing Automation (n8n, Make, WhatsApp Business API)',
    ],
    sameAs: ['https://www.linkedin.com/company/grovi-studio/'],
  };

  // 2. WebSite
  const websiteNode: Record<string, any> = {
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    url: `${SITE_URL}/`,
    name: 'Grovi Studio',
    alternateName: 'grovi-studio.com',
    description: 'Agencia de Growth para e-commerce B2B en salud, legal y servicios de alto ticket',
    publisher: { '@id': `${SITE_URL}/#organization` },
    inLanguage: 'es-CO',
    ...(isHome
      ? {
          potentialAction: {
            '@type': 'SearchAction',
            target: `${SITE_URL}/?s={search_term_string}`,
            'query-input': 'required name=search_term_string',
          },
        }
      : {}),
  };

  // 3. Primary ImageObject
  const imageNode: Record<string, any> = {
    '@type': 'ImageObject',
    '@id': primaryImageUrl,
    url: primaryImageUrl,
    contentUrl: primaryImageUrl,
    width: String(primaryImageWidth),
    height: String(primaryImageHeight),
    caption: mediaItem?.alt_text || rawTitle,
    inLanguage: 'es-CO',
  };

  // 4. BreadcrumbList
  const breadcrumbNode = buildBreadcrumbSchema(item, canonicalUrl, rawTitle);

  // 5. WebPage
  const webPageNode: Record<string, any> = {
    '@type': 'WebPage',
    '@id': `${canonicalUrl}#webpage`,
    url: canonicalUrl,
    name: seoTitle,
    description: seoDescription,
    ...(publishedIso ? { datePublished: publishedIso } : {}),
    ...(modifiedIso ? { dateModified: modifiedIso } : {}),
    about: { '@id': `${SITE_URL}/#organization` },
    isPartOf: { '@id': `${SITE_URL}/#website` },
    primaryImageOfPage: { '@id': primaryImageUrl },
    breadcrumb: { '@id': `${canonicalUrl}#breadcrumb` },
    inLanguage: 'es-CO',
  };

  // 6. Person (Author)
  const authorNode: Record<string, any> = {
    '@type': 'Person',
    '@id': `${SITE_URL}/author/cesarjimenezarciagmail-com/`,
    name: 'César Jiménez',
    url: `${SITE_URL}/author/cesarjimenezarciagmail-com/`,
    sameAs: ['https://www.linkedin.com/in/cesarjimenezarcia/'],
    worksFor: { '@id': `${SITE_URL}/#organization` },
  };

  const graph: Array<Record<string, any>> = [
    organizationNode,
    websiteNode,
    imageNode,
    breadcrumbNode,
    webPageNode,
    authorNode,
  ];

  // 7. BlogPosting for posts (or Article for pages if no inline Article/BlogPosting already exists)
  const hasInlineArticleOrBlog = inlineTypes.has('BlogPosting') || inlineTypes.has('Article');
  const shouldAddBlogPosting =
    isPost && (!avoidDuplicateArticleIfInline || !inlineTypes.has('BlogPosting'));

  if (shouldAddBlogPosting) {
    // Note: if inline content already has an `Article` block and `avoidDuplicateArticleIfInline` is false
    // or if we want the rich BlogPosting node linked to `#webpage` and `#organization`:
    if (!avoidDuplicateArticleIfInline || !hasInlineArticleOrBlog) {
      graph.push({
        '@type': 'BlogPosting',
        '@id': `${canonicalUrl}#richSnippet`,
        headline: seoTitle,
        name: seoTitle,
        keywords: focusKeyword,
        description: seoDescription,
        ...(publishedIso ? { datePublished: publishedIso } : {}),
        ...(modifiedIso ? { dateModified: modifiedIso } : {}),
        ...(articleSection ? { articleSection } : {}),
        author: {
          '@id': `${SITE_URL}/author/cesarjimenezarciagmail-com/`,
          name: 'César Jiménez',
        },
        publisher: { '@id': `${SITE_URL}/#organization` },
        isPartOf: { '@id': `${canonicalUrl}#webpage` },
        mainEntityOfPage: { '@id': `${canonicalUrl}#webpage` },
        image: { '@id': primaryImageUrl },
        inLanguage: 'es-CO',
      });
    }
  }

  // Optional: merge unique inline JSON-LD nodes (e.g., FAQPage) if requested
  if (mergeInlineIntoGraph && contentHtml) {
    const inlineBlocks = extractInlineJsonLd(contentHtml);
    const existingTypes = new Set<string>(
      graph.flatMap((n) => (Array.isArray(n['@type']) ? n['@type'] : [n['@type']]))
    );
    for (const block of inlineBlocks) {
      const nodes = Array.isArray(block['@graph']) ? block['@graph'] : [block];
      for (const node of nodes) {
        const nodeType = node?.['@type'];
        if (!nodeType) continue;
        if (nodeType === 'Article' && isPost) {
          if (!existingTypes.has('BlogPosting')) {
            graph.push({
              ...node,
              '@type': 'BlogPosting',
              '@id': `${canonicalUrl}#richSnippet`,
              isPartOf: { '@id': `${canonicalUrl}#webpage` },
              mainEntityOfPage: { '@id': `${canonicalUrl}#webpage` },
              publisher: { '@id': `${SITE_URL}/#organization` },
              image: { '@id': primaryImageUrl },
            });
            existingTypes.add('BlogPosting');
          }
        } else if (!existingTypes.has(String(nodeType))) {
          graph.push(node);
          existingTypes.add(String(nodeType));
        }
      }
    }
  }

  return {
    '@context': 'https://schema.org',
    '@graph': graph,
  };
}

function getResolvedTitle(item: WpItem, rm: Record<string, any>, rawTitle: string): string {
  if (rm.rank_math_title && String(rm.rank_math_title).trim()) {
    return decodeHtmlEntities(String(rm.rank_math_title).trim());
  }
  if (item.slug === 'portafolio' || item.id === 1163) {
    return 'Portafolio de Casos de Éxito & Resultados | Grovi Studio';
  }
  if (/grovi/i.test(rawTitle)) {
    return rawTitle;
  }
  return `${rawTitle} | Grovi Studio`;
}

function getResolvedDescription(item: WpItem, rm: Record<string, any>): string {
  if (rm.rank_math_description && String(rm.rank_math_description).trim()) {
    return decodeHtmlEntities(String(rm.rank_math_description).trim());
  }
  if (item.slug === 'portafolio' || item.id === 1163) {
    return 'Casos de éxito reales y resultados auditados de Grovi Studio: +$7.5M USD en facturación atribuida, +45M impresiones orgánicas en Search Console y crecimiento B2B/D2C.';
  }
  const cleanExcerpt = getCleanExcerptFallback(item);
  if (cleanExcerpt) {
    return cleanExcerpt;
  }
  return 'Agencia de growth marketing B2B para e-commerce y negocios de alto ticket. Estrategia, SEO técnico, Paid Media, analítica de datos y automatización con IA.';
}

/**
 * Main SEO helper: Given an item from `wp-export.json` (page or post), returns all SEO metadata
 * (`title`, `description`, `canonical`, `robots`, `og:*`, `twitter:*`, and Schema.org `@graph` JSON-LD).
 */
export function getSeoMetadata(item: WpItem, options: SeoOptions = {}): SeoMetadata {
  const data = getWpExport();
  const isHome = item.path === '/' || item.id === 14;
  const isPost = item.type === 'post';
  const rm = item.rank_math || (item as any)[' rank_math'] || {};

  const rawTitle = decodeHtmlEntities(item.title?.raw || item.title?.rendered || 'Grovi Studio');
  const title = getResolvedTitle(item, rm, rawTitle);
  const description = getResolvedDescription(item, rm);
  const canonical = rm.rank_math_canonical_url || `${SITE_URL}${normalizePath(item.path)}`;

  const robotsList = Array.isArray(rm.rank_math_robots) && rm.rank_math_robots.length > 0
    ? rm.rank_math_robots
    : ['index', 'follow'];
  const robotsBase = robotsList.join(', ');
  const robots = robotsBase.includes('max-snippet')
    ? robotsBase
    : `${robotsBase}, max-snippet:-1, max-video-preview:-1, max-image-preview:large`;

  const keywords =
    rm.rank_math_focus_keyword ||
    (isHome
      ? 'agencia growth marketing, growth marketing b2b'
      : 'growth marketing, agencia seo, marketing digital b2b');

  const mediaItem = item.featured_media ? data.media.find((m) => m.id === item.featured_media) : undefined;
  const imageUrl = mediaItem?.source_url || DEFAULT_OG_IMAGE;
  const imageWidth = mediaItem ? 1059 : 1080;
  const imageHeight = mediaItem ? 556 : 1080;
  const imageAlt = decodeHtmlEntities(mediaItem?.alt_text || rm.rank_math_focus_keyword || rawTitle);
  const imageType = mediaItem?.mime_type || (imageUrl.endsWith('.jpg') || imageUrl.endsWith('.jpeg') ? 'image/jpeg' : 'image/png');

  const publishedIso = toIsoGmt(item.date_gmt || item.date);
  const modifiedIso = toIsoGmt(item.modified_gmt || item.modified);

  const primaryCatId = item.categories?.[0];
  const category = primaryCatId ? data.categories.find((c) => c.id === primaryCatId) : undefined;
  const section = category && category.slug !== 'uncategorized' ? decodeHtmlEntities(category.name) : undefined;

  const readingMinutes = estimateReadingTimeMinutes(item.content?.rendered);

  const ogTitle = decodeHtmlEntities(rm.rank_math_facebook_title || title);
  const ogDescription = decodeHtmlEntities(rm.rank_math_facebook_description || description);
  const twitterTitle = decodeHtmlEntities(rm.rank_math_twitter_title || title);
  const twitterDescription = decodeHtmlEntities(rm.rank_math_twitter_description || description);

  const og: OpenGraphMeta = {
    locale: 'es_ES',
    type: isHome ? 'website' : 'article',
    title: ogTitle,
    description: ogDescription,
    url: canonical,
    siteName: 'grovi-studio.com',
    updatedTime: modifiedIso,
    image: imageUrl,
    imageSecureUrl: imageUrl,
    imageWidth,
    imageHeight,
    imageAlt,
    imageType,
    publishedTime: publishedIso,
    modifiedTime: modifiedIso,
    section,
  };

  const twitter: TwitterCardMeta = {
    card: 'summary_large_image',
    title: twitterTitle,
    description: twitterDescription,
    image: imageUrl,
    label1: 'Written by',
    data1: 'César Jiménez',
    label2: 'Time to read',
    data2: `${readingMinutes} minutos`,
  };

  const contentHtml = item.content?.rendered || '';
  const inlineTypes = Array.from(extractInlineSchemaTypes(contentHtml));
  const jsonLd = generateJsonLd(item, options);

  return {
    title,
    rawTitle,
    description,
    canonical,
    robots,
    keywords,
    og,
    twitter,
    jsonLd,
    jsonLdString: JSON.stringify(jsonLd),
    hasInlineJsonLd: hasInlineJsonLd(contentHtml),
    inlineSchemaTypes: inlineTypes,
  };
}

// Convenient aliases for flexibility across components/layouts
export const generateSeoMetadata = getSeoMetadata;
export const buildSeoMetadata = getSeoMetadata;
export const getSchemaGraph = generateJsonLd;
