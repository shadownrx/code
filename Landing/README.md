# Landing

Sitio de documentación/landing del proyecto, hecho a medida en [Astro](https://astro.build)
(sin Starlight ni otros templates) — inspirado en el look de vercel.com/docs:
sidebar de navegación, buscador, TOC ("En esta página") con scroll-spy, code
blocks resaltados con Shiki, y tema claro/oscuro real (con toggle manual +
detección de preferencia del sistema).

No reemplaza a `/docs/*.md` en la raíz del repo (esos siguen siendo la fuente
que se lee directamente en GitHub) — este sitio es una copia editorial pensada
para navegarse como página web, actualmente sincronizada a mano.

## Desarrollo

```bash
npm install
npm run dev       # http://localhost:4321
npm run build     # genera dist/
npm run preview   # sirve el build de producción
```

## Estructura

```
src/
  components/   TopNav (con buscador), Sidebar, TableOfContents, ThemeToggle
  layouts/      Layout.astro — shell de 3 columnas (sidebar | contenido | TOC)
  content/docs/ Los cuatro docs reales (usage, cli, signing, troubleshooting) como Markdown
  pages/
    index.astro           landing/introducción, dentro del mismo shell de docs
    docs/[...slug].astro  ruta dinámica que renderiza cada entrada de content/docs
  styles/global.css        tokens de color (claro/oscuro) y estilos de prose
public/fonts/               Geist Sans + Geist Mono (variable, self-hosted)
```

## Fuentes

Usa las fuentes reales de Vercel (`Geist` y `Geist Mono`, MIT/SIL OFL) via el
paquete npm [`geist`](https://www.npmjs.com/package/geist) — los `.woff2`
variables están copiados a `public/fonts/` y referenciados por `@font-face` en
`global.css`.
