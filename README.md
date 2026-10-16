# Grovi Site Astro (`grovi-studio.com`)

Sitio web oficial de **Grovi Studio** migrado íntegramente a **Astro 5** conservando el **100% de fidelidad visual**, estructura de URLs (`trailingSlash: 'always'`), metadatos SEO de Rank Math, sitemaps XML, `robots.txt`, `robotllm.txt` / `llms.txt` y el grafo completo de JSON-LD Schemas (`Organization`, `MarketingAgency`, `ProfessionalService`, `WebSite`, `WebPage`, `BreadcrumbList`, `BlogPosting`, `Service`, `FAQPage`).

## Estructura del Proyecto

- `data/wp-export.json` — Exportación íntegra de las 90 páginas publicadas, 116 artículos del blog, categorías y biblioteca de medios.
- `src/layouts/WpLayout.astro` — Layout maestro con fidelidad visual exacta (cabecera global `.gx-h`, footer global `.gx-f`, estilos inline de Astra para páginas y posts, Google Fonts e inyección automática de Schemas JSON-LD).
- `src/pages/index.astro` — Página de inicio (`/`).
- `src/pages/[...slug].astro` — Enrutador estático para las 89 páginas internas (servicios, portafolio, países, ciudades, herramientas, blog, contacto) y los 116 artículos del blog (`206` rutas en total).
- `src/utils/seo.ts` — Motor de SEO y generador del `@graph` JSON-LD de la organización **Grovi Studio**.
- `src/utils/wpContent.ts` — Cargador y normalizador de contenido, enlaces relativos e hidratación estática instantánea de `/blog/`.
- `src/pages/sitemap.xml.ts`, `sitemap_index.xml.ts`, `page-sitemap.xml.ts`, `post-sitemap.xml.ts` — Sitemaps XML dinámicos con las 206 URLs.
- `public/robots.txt` — Reglas para buscadores tradicionales y crawlers de IA/LLMs (GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Google-Extended, etc.).
- `public/robotllm.txt` y `public/llms.txt` — Contexto estructurado completo (~100 KB) de la organización, metodología, casos de éxito, servicios, cobertura geográfica y artículos.

## Comandos

```bash
# Servidor de desarrollo local (http://localhost:4321/)
npm run dev

# Build estático de producción (genera carpeta dist/ con las 206 páginas + sitemaps)
npm run build

# Previsualizar build de producción
npm run preview
```
