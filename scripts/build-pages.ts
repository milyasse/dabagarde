// Pages statiques générées après `vite build` (version initiale : 404, robots.txt, sitemap.xml).
import { copyFileSync, writeFileSync } from 'node:fs';
const SITE = (process.env.SITE_URL || 'http://localhost:4173/dabagarde').replace(/\/$/, '');
copyFileSync('dist/index.html', 'dist/404.html');
writeFileSync('dist/robots.txt', `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
writeFileSync('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${SITE}/</loc></url></urlset>\n`);
console.log('Pages statiques : 404, robots.txt, sitemap.xml');
