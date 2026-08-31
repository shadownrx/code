// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://shadownrx.github.io',
  markdown: {
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark-dimmed',
      },
      defaultColor: false,
    },
  },
});
