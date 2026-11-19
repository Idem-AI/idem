/**
 * Le relevé sur de VRAIS sites, une technologie par site (réseau requis, aucun modèle) :
 *
 *   npm run check:real-sites [-- --only nextjs,wordpress] [--pages 6]
 *
 * Pour chaque site : la technologie attendue (nom dans le catalogue) contre celles détectées, le nombre de pages et
 * de sections relevées, les images, les adaptations appliquées, le temps. Une ligne « ÉCART » dit ce qui ne va pas.
 */
import { crawlWebsite, SiteInventory } from '../src/site/site-crawler';

interface Case {
  id: string;
  url: string;
  /** La technologie qu'on s'attend à voir reconnue (nom du catalogue, sans casse). */
  expect: string;
  /** Pages au moins attendues (le site en a plus que cela). */
  minPages: number;
  minSections?: number;
}

const CASES: Case[] = [
  { id: 'wordpress', url: 'https://wordpress.org/', expect: 'WordPress', minPages: 3 },
  { id: 'wordpress-blog', url: 'https://techcrunch.com/', expect: 'WordPress', minPages: 2 },
  { id: 'nextjs', url: 'https://nextjs.org/', expect: 'Next.js', minPages: 3 },
  { id: 'nextjs-vercel', url: 'https://vercel.com/', expect: 'Next.js', minPages: 3 },
  { id: 'astro', url: 'https://astro.build/', expect: 'Astro', minPages: 3 },
  { id: 'nuxt', url: 'https://nuxt.com/', expect: 'Nuxt', minPages: 3 },
  { id: 'sveltekit', url: 'https://svelte.dev/', expect: 'SvelteKit', minPages: 3 },
  { id: 'angular', url: 'https://angular.dev/', expect: 'Angular', minPages: 3 },
  { id: 'vue', url: 'https://vuejs.org/', expect: 'Vue', minPages: 3 },
  { id: 'react-spa', url: 'https://react.dev/', expect: 'Next.js', minPages: 3 },
  { id: 'gatsby', url: 'https://www.gatsbyjs.com/', expect: 'Gatsby', minPages: 2 },
  { id: 'docusaurus', url: 'https://docusaurus.io/', expect: 'Docusaurus', minPages: 3 },
  { id: 'hugo', url: 'https://gohugo.io/', expect: 'Hugo', minPages: 3 },
  { id: 'jekyll', url: 'https://jekyllrb.com/', expect: 'Jekyll', minPages: 3 },
  { id: 'django', url: 'https://www.djangoproject.com/', expect: '', minPages: 3 }, // n'expose aucune signature Django
  { id: 'laravel', url: 'https://laravel.com/', expect: 'Statamic', minPages: 3 }, // laravel.com tourne sur Statamic
  { id: 'rails', url: 'https://rubyonrails.org/', expect: 'Ruby on Rails', minPages: 3 },
  { id: 'drupal', url: 'https://www.drupal.org/', expect: 'Drupal', minPages: 3 },
  { id: 'joomla', url: 'https://www.joomla.org/', expect: 'Joomla', minPages: 3 },
  { id: 'ghost', url: 'https://ghost.org/', expect: 'Hugo', minPages: 3 }, // le site de Ghost est bâti avec Hugo
  { id: 'webflow', url: 'https://webflow.com/', expect: 'Webflow', minPages: 3 },
  { id: 'framer', url: 'https://www.framer.com/', expect: 'Framer', minPages: 3 },
  { id: 'shopify', url: 'https://www.allbirds.com/', expect: 'Shopify', minPages: 2 },
  { id: 'squarespace', url: 'https://www.squarespace.com/', expect: 'Squarespace', minPages: 3 },
  { id: 'wix', url: 'https://www.wix.com/', expect: 'Wix', minPages: 2 },
  { id: 'static', url: 'https://example.com/', expect: '', minPages: 1, minSections: 1 },
];

const args = process.argv.slice(2);
const option = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const only = option('only')?.split(',');
const maxPages = Number(option('pages') ?? 6);
const concurrency = Number(option('parallel') ?? 3);

const summary = (inv: SiteInventory) => {
  const sections = inv.pages.reduce((n, p) => n + p.sections.length, 0);
  const text = inv.pages.reduce((n, p) => n + p.sections.reduce((m, s) => m + [...s.headings, ...s.texts, ...s.items].join(' ').length, 0), 0);
  return { pages: inv.pages.length, sections, text, images: inv.assets.images.length };
};

async function run(item: Case) {
  const started = Date.now();
  try {
    const inventory = await crawlWebsite({ url: item.url, maxPages, timeoutMs: 25_000 });
    return { item, inventory, ms: Date.now() - started, error: null as string | null };
  } catch (error) {
    return { item, inventory: null, ms: Date.now() - started, error: (error as Error).message };
  }
}

(async () => {
  const cases = CASES.filter((c) => !only || only.includes(c.id));
  const results: Awaited<ReturnType<typeof run>>[] = [];
  const queue = [...cases];
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (queue.length) {
        const next = queue.shift()!;
        const result = await run(next);
        results.push(result);
        const s = result.inventory ? summary(result.inventory) : null;
        console.log(`${next.id.padEnd(15)} ${result.error ? `ERREUR ${result.error.slice(0, 80)}` : `${result.inventory!.technology?.family?.padEnd(8)} ${s!.pages} p · ${s!.sections} sect · ${s!.images} img · ${(result.ms / 1000).toFixed(1)} s · ${result.inventory!.technology?.names.slice(0, 4).join(', ')}`}`);
      }
    })
  );

  console.log('\n— Écarts');
  let gaps = 0;
  for (const { item, inventory, ms, error } of results.sort((a, b) => a.item.id.localeCompare(b.item.id))) {
    const problems: string[] = [];
    if (error || !inventory) problems.push(`relevé impossible : ${error}`);
    else {
      const s = summary(inventory);
      const names = (inventory.technology?.names ?? []).map((n) => n.toLowerCase());
      if (item.expect && !names.some((n) => n.includes(item.expect.toLowerCase()))) problems.push(`technologie « ${item.expect} » non reconnue (vu : ${names.slice(0, 5).join(', ') || 'rien'})`);
      if (s.pages < item.minPages) problems.push(`${s.pages} page(s) pour ${item.minPages} attendues`);
      if (s.sections < (item.minSections ?? 2)) problems.push(`${s.sections} section(s) relevée(s)`);
      if (s.text < (item.minSections === 1 ? 80 : 300)) problems.push(`peu de texte relevé (${s.text} signes)`);
      if (ms > 60_000) problems.push(`lent : ${(ms / 1000).toFixed(0)} s`);
    }
    if (problems.length) {
      gaps += 1;
      console.log(`ÉCART ${item.id} (${item.url}) : ${problems.join(' ; ')}`);
      if (inventory) console.log(`      adaptations : ${inventory.technology?.adaptations.join(', ') || 'aucune'} · pages : ${inventory.pages.map((p) => p.path).slice(0, 8).join(' ')}`);
    }
  }
  console.log(gaps ? `\n${gaps} site(s) avec écart sur ${results.length}.` : `\nTous les sites (${results.length}) relevés comme attendu.`);
  process.exit(0);
})();
