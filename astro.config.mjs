import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://grovi-studio.com',
  trailingSlash: 'always',
  output: 'static',
  build: {
    format: 'directory',
  },
});
