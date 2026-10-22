// Vérification de l'interface construite (GitHub Actions, `vite preview` sur le dossier dist) :
// accueil, recherche de ville, fiche, signalement, favoris, carte, ville non couverte, filtres,
// lien partagé, géolocalisation (acceptée / refusée), cliniques, pages statiques, ordinateur.
import { chromium } from 'playwright';
import { mkdir, writeFile, readdir, rename } from 'node:fs/promises';

const URL = process.env.APP_URL || 'http://localhost:4173/dabagarde/';
const OUT = process.env.VERIF_OUT || 'verif';
await mkdir(`${OUT}/raw`, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const log = [];
let failures = 0;
const note = (m) => { console.log(m); log.push(m); };
const check = (ok, m) => { note(`${ok ? 'OK ' : 'ÉCHEC'} — ${m}`); if (!ok) failures++; };
const section = async (name, fn) => { note(`\n## ${name}`); try { await fn(); } catch (e) { check(false, `${name} : ${String(e?.message || e).split('\n')[0]}`); } };

const browser = await chromium.launch();
const mobile = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR', timezoneId: 'Africa/Casablanca' };
const results = (page) => page.locator('section[aria-label="Résultats"]').first();
const heading = async (page) => (await results(page).locator('h2').first().innerText().catch(() => '')).trim();

await section('Parcours principal (téléphone)', async () => {
  const ctx = await browser.newContext({ ...mobile, recordVideo: { dir: `${OUT}/raw`, size: { width: 390, height: 844 } } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', (e) => { note('pageerror: ' + e.message); failures++; });
  await page.goto(URL, { waitUntil: 'networkidle' });
  check(await page.getByRole('heading', { level: 1, name: /pharmacie de garde/i }).isVisible(), 'accueil : titre principal visible immédiatement (pas d’écran de lancement)');
  check(await page.getByRole('combobox', { name: /Ville, commune ou quartier/ }).isVisible(), 'accueil : recherche centrale par ville');
  check(/Rabat/.test(await page.getByRole('region', { name: /Villes couvertes/ }).innerText().catch(() => '')) || (await page.getByText('Villes couvertes').count()) > 0, 'accueil : villes couvertes listées');
  await page.screenshot({ path: `${OUT}/01-accueil.png`, fullPage: false });
  await page.screenshot({ path: `${OUT}/01-accueil-complet.png`, fullPage: true });

  // Recherche instantanée
  const box = page.getByRole('combobox', { name: /Ville, commune ou quartier/ });
  await box.fill('Sal');
  const opt = page.getByRole('option', { name: /^Salé/ }).first();
  await opt.waitFor({ timeout: 10000 });
  check(true, 'recherche instantanée : « Sal » propose Salé');
  await page.screenshot({ path: `${OUT}/02-suggestions.png` });
  await opt.click();
  await results(page).locator('h2').first().waitFor({ timeout: 20000 });
  await wait(1500);
  const h = await heading(page);
  check(/pharmacies? de garde|Aucune/.test(h), `résultats Salé : « ${h} »`);
  check((await page.getByText(/Pas encore de liste de garde fiable/).count()) === 0, 'ville couverte : aucun avertissement de couverture');
  check(page.url().includes('ville=sale'), `adresse partageable : ${page.url().split('?')[1] ?? ''}`);
  await page.screenshot({ path: `${OUT}/03-resultats-sale.png` });

  const cards = results(page).locator('article');
  const n = await cards.count();
  if (n > 0) {
    const first = cards.first();
    check((await first.getByRole('button', { name: /Itinéraire/ }).count()) === 1, 'carte de résultat : bouton Itinéraire');
    check(/Appeler|Tél\. non publié/.test(await first.innerText()), 'carte de résultat : appel (ou absence de numéro signalée)');
    check(!/ouverte/i.test(await results(page).innerText()), 'aucune pharmacie présentée comme « ouverte »');
    // Fiche détaillée
    await first.getByRole('button', { name: /Fiche détaillée/ }).click();
    const dlg = page.locator('dialog[open]');
    await dlg.waitFor();
    const txt = await dlg.innerText();
    check(/Sources/.test(txt) && /récupérée le/.test(txt) && /Position/.test(txt), 'fiche : sources, date de récupération, précision de la position');
    check(/non vérifiées sur le terrain|pas été vérifiées sur le terrain/.test(txt), 'fiche : distinction donnée récupérée / vérifiée');
    await page.screenshot({ path: `${OUT}/04-fiche.png` });
    await dlg.getByRole('button', { name: /Signaler une information incorrecte/ }).click();
    const rep = page.locator('dialog[open]');
    await rep.getByText('Pharmacie fermée').click();
    const href = await rep.getByRole('link', { name: /Envoyer le signalement/ }).getAttribute('href');
    check(/issues\/new\?template=signalement\.yml/.test(href ?? '') && /Pharmacie\+ferm|Pharmacie%20ferm/.test(href ?? ''), 'signalement : ticket prérempli (motif « Pharmacie fermée »)');
    await page.screenshot({ path: `${OUT}/05-signalement.png` });
    await rep.getByRole('button', { name: 'Fermer' }).click();
    // Favori
    await first.getByRole('button', { name: /Ajouter aux favoris/ }).click();
    check((await page.getByRole('status').filter({ hasText: /favoris/ }).count()) > 0, 'favori : confirmation affichée');
    // Filtre texte
    const name = (await first.locator('h3').innerText()).split(' ').slice(-1)[0];
    await page.getByPlaceholder('Filtrer par nom, adresse ou quartier').fill(name);
    await wait(300);
    check((await cards.count()) >= 1, `filtre texte « ${name} » : ${await cards.count()} résultat(s)`);
    await page.getByPlaceholder('Filtrer par nom, adresse ou quartier').fill('');
    // Carte
    await page.getByRole('tab', { name: 'Carte' }).click();
    await wait(1500);
    const markers = await page.locator('.rank-marker').count();
    check(markers > 0, `onglet Carte : ${markers} marqueur(s)`);
    await page.screenshot({ path: `${OUT}/06-carte.png` });
    await page.getByRole('tab', { name: 'Liste' }).click();
  } else note('Aucune garde publiée pour Salé à cette heure : contrôles de fiche ignorés.');

  // Retour à l'accueil : favoris
  await page.getByRole('link', { name: /DabaGarde, accueil/ }).click();
  await wait(800);
  if (n > 0) check(await page.getByRole('heading', { name: 'Vos pharmacies' }).isVisible(), 'accueil : section « Vos pharmacies » (favoris locaux)');
  check(/Récemment/.test(await page.locator('main').innerText()), 'accueil : recherches récentes');

  // Ville non couverte
  await page.getByRole('button', { name: 'Marrakech' }).click();
  await results(page).locator('h2').first().waitFor({ timeout: 20000 }).catch(() => {});
  await wait(1200);
  const cov = await page.getByText(/Pas encore de liste de garde fiable pour Marrakech/).count();
  check(cov === 1, 'ville non couverte (Marrakech) : message explicite, aucune donnée inventée');
  const g24 = await page.getByRole('link', { name: /garde24\.ma/ }).getAttribute('href').catch(() => null);
  check(g24 === 'https://garde24.ma/fr/pharmacie-de-garde/marrakech', 'ville non couverte : lien vers la page publique d’origine');
  await page.screenshot({ path: `${OUT}/07-non-couverte.png` });

  // Filtre « De nuit » puis ville
  await page.getByRole('link', { name: /DabaGarde, accueil/ }).click();
  await page.getByRole('button', { name: 'De nuit' }).click();
  await page.getByRole('button', { name: /^Rabat/ }).first().click();
  await results(page).locator('h2').first().waitFor({ timeout: 20000 }).catch(() => {});
  await wait(800);
  check(page.url().includes('type=night'), 'filtre « De nuit » appliqué et visible dans l’adresse');
  const types = await results(page).locator('article').evaluateAll((els) => els.map((e) => e.innerText));
  check(types.every((t) => /nuit/i.test(t)), `filtre « De nuit » : ${types.length} résultat(s), tous de nuit`);
  await ctx.close();
});

await section('Lien partagé et géolocalisation acceptée', async () => {
  const ctx = await browser.newContext({ ...mobile, geolocation: { latitude: 33.9985, longitude: -6.852, accuracy: 25 }, permissions: ['geolocation'] });
  const page = await ctx.newPage();
  await page.goto(URL + '?ville=temara', { waitUntil: 'networkidle' });
  await results(page).locator('h2').first().waitFor({ timeout: 20000 });
  check(/Témara/.test(await results(page).innerText()), 'lien ?ville=temara : recherche lancée à l’ouverture');
  await page.getByRole('button', { name: /Pharmacies autour de ma position/ }).click();
  await wait(2500);
  check(/Autour de ma position/.test(await results(page).innerText()), 'géolocalisation : recherche autour de ma position');
  check(!/lat=|lng=/.test(page.url()), 'aucune position GPS dans l’adresse de la page');
  await page.screenshot({ path: `${OUT}/08-autour-de-moi.png` });
  await ctx.close();
});

await section('Géolocalisation refusée', async () => {
  const ctx = await browser.newContext({ ...mobile, permissions: [] });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Pharmacies autour de ma position/ }).click();
  await wait(3000);
  const alert = await page.locator('[role="alert"]').allInnerTexts();
  check(alert.some((t) => /position|localisation/i.test(t)), `message explicite (« ${alert.join(' | ').slice(0, 100)} »)`);
  await page.screenshot({ path: `${OUT}/09-geoloc-refusee.png` });
  await ctx.close();
});

await section('Cliniques et hôpitaux', async () => {
  const ctx = await browser.newContext({ ...mobile });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Cliniques et hôpitaux' }).first().click();
  await page.locator('#espace-sante').waitFor();
  check(page.url().includes('espace=sante'), 'espace Cliniques : adresse ?espace=sante');
  await page.locator('#espace-sante').getByRole('button', { name: /^Rabat/ }).first().click();
  await wait(2500);
  const head = await page.locator('#espace-sante section[aria-label="Résultats"] h2').first().innerText().catch(() => '');
  check(/^\d+ établissement/.test(head), `cliniques Rabat : « ${head} »`);
  check(!/De garde \(désignation officielle\)/.test(await page.locator('#espace-sante').innerText()), 'cliniques : aucun établissement « de garde » sans source officielle');
  await page.screenshot({ path: `${OUT}/10-cliniques.png` });
  await ctx.close();
});

await section('Pages statiques et référencement', async () => {
  const ctx = await browser.newContext({ ...mobile, javaScriptEnabled: false });
  const page = await ctx.newPage();
  const r = await page.goto(URL + 'pharmacie-de-garde/rabat/');
  check(r?.status() === 200, 'page /pharmacie-de-garde/rabat/ servie');
  check(/Pharmacie de garde à Rabat/.test(await page.locator('h1').innerText()), 'page Rabat : titre H1 sans JavaScript');
  const cards = await page.locator('li.card').count();
  check(cards > 0 || /Aucune pharmacie de garde/.test(await page.locator('main').innerText()), `page Rabat : ${cards} garde(s) lisibles sans JavaScript`);
  check((await page.locator('link[rel="canonical"]').getAttribute('href'))?.endsWith('/pharmacie-de-garde/rabat/'), 'page Rabat : balise canonical');
  check((await page.locator('script[type="application/ld+json"]').count()) >= 2, 'page Rabat : données structurées (fil d’Ariane, liste)');
  await page.screenshot({ path: `${OUT}/11-page-rabat.png`, fullPage: false });
  for (const p of ['villes/', 'urgences/', 'comment-ca-marche/', 'faq/', 'contact/', 'confidentialite/', 'mentions-legales/', 'cliniques-hopitaux/rabat-sale-temara/']) {
    const res = await page.goto(URL + p);
    check(res?.status() === 200 && (await page.locator('h1').count()) === 1, `page /${p} : servie, un seul H1`);
  }
  const sm = await page.goto(URL + 'sitemap.xml');
  const xml = (await sm?.text()) ?? '';
  check(/<loc>[^<]+\/pharmacie-de-garde\/rabat\/<\/loc>/.test(xml) && !/lat=/.test(xml), 'sitemap.xml : pages de ville, aucune URL de recherche');
  const rb = await page.goto(URL + 'robots.txt');
  check(/Sitemap:/.test((await rb?.text()) ?? ''), 'robots.txt : déclare le sitemap');
  const home = await page.goto(URL);
  const html = (await home?.text()) ?? '';
  check(!/__SITE__/.test(html) && /<link rel="canonical" href="https?:\/\//.test(html), 'index.html : URL canonique absolue');
  check(/Pharmacie de garde près de vous/.test(html), 'index.html : contenu lisible sans JavaScript');
  await ctx.close();
});

await section('Accessibilité de base', async () => {
  const ctx = await browser.newContext({ ...mobile });
  const page = await ctx.newPage();
  await page.goto(URL + '?ville=rabat', { waitUntil: 'networkidle' });
  await results(page).locator('h2').first().waitFor({ timeout: 20000 }).catch(() => {});
  const unnamed = await page.evaluate(() => [...document.querySelectorAll('button, a[href], input, select')].filter((el) => {
    const name = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('title') || el.getAttribute('placeholder') || (el.id && document.querySelector(`label[for="${el.id}"]`)?.textContent) || el.closest('label')?.textContent || '').trim();
    return !name && el.getAttribute('type') !== 'hidden';
  }).map((el) => el.outerHTML.slice(0, 80)));
  check(unnamed.length === 0, `éléments interactifs sans nom accessible : ${unnamed.length}${unnamed.length ? ' — ' + unnamed.slice(0, 3).join(' | ') : ''}`);
  await page.keyboard.press('Tab');
  const skip = await page.evaluate(() => document.activeElement?.textContent ?? '');
  check(/Aller au contenu/.test(skip), 'clavier : lien d’évitement en premier');
  await ctx.close();
});

await section('Ordinateur', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR', timezoneId: 'Africa/Casablanca' });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${OUT}/12-ordinateur-accueil.png` });
  await page.getByRole('button', { name: /^Rabat/ }).first().click();
  await results(page).locator('h2').first().waitFor({ timeout: 20000 }).catch(() => {});
  await wait(2500);
  check((await page.locator('.leaflet-container').count()) === 1 && (await results(page).count()) === 1, 'ordinateur : liste et carte affichées ensemble');
  await page.screenshot({ path: `${OUT}/13-ordinateur-resultats.png` });
  await ctx.close();
});

await browser.close();
const vids = await readdir(`${OUT}/raw`);
if (vids[0]) await rename(`${OUT}/raw/${vids[0]}`, `${OUT}/parcours.webm`);
note(failures ? `\n${failures} vérification(s) en échec` : '\ntoutes les vérifications sont passées');
await writeFile(`${OUT}/rapport.txt`, log.join('\n') + '\n');
process.exit(failures ? 1 : 0);
