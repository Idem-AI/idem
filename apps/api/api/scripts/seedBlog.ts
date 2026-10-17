/**
 * Premier article du blog — `npm run seed:blog`.
 *
 * Publie « Bienvenue sur le blog d'IDEM » en français et en anglais, pour voir
 * le rendu du blog sans rien écrire. Idempotent : un billet dont l'adresse
 * existe déjà dans sa langue n'est ni recréé ni écrasé.
 */
import { loadSecrets } from '../config/secrets';
import mongoDBConnection from '../config/mongodb.config';
import { BlogPost } from '../schemas/blogPost.schema';
import { blogService } from '../services/blog.service';

const FR = `## Pourquoi ce blog

IDEM est né à Douala d'une conviction simple : un entrepreneur de Yaoundé ne devrait pas payer quatre fois plus qu'un entrepreneur de Paris pour le même travail. Ce blog est l'endroit où nous racontons **ce que nous construisons**, **pourquoi** nous le construisons ainsi, et ce que nous apprenons en chemin.

Vous y trouverez deux sortes de billets :

- des **articles**, pour comprendre une idée, une décision ou une méthode ;
- des **notes de version**, pour savoir ce qui change dans IDEM, sans jargon.

## IDEM en une phrase

IDEM est l'IA qui aide à créer des **business rentables** en Afrique. Plus de 500 agents IA travaillent à partir de votre description : ils structurent le projet, rédigent le business plan, dessinent la marque, préparent la communication, construisent le site et le mettent en ligne.

### Ce que vous obtenez

| Étape | Ce qu'IDEM produit |
|---|---|
| Structurer | Business plan aux normes SYSCOHADA, prévisions financières |
| Reconnaître | Logo, charte graphique, papeterie |
| Se faire connaître | Stratégie de communication, visuels et vidéos |
| Construire | Site et application, écrits sous vos yeux par iCode |
| Lancer | Mise en ligne en un clic avec iDeploy, sur des serveurs en Afrique |

## Payer ce que vous gardez

Voir ce qu'IDEM produit ne coûte rien : vous décrivez votre projet, vous regardez les livrables, et vous ne payez que ce que vous décidez de garder.

> Les prix sont fixés pays par pays, en francs CFA, et se règlent par Mobile Money.

Le Kit Business est à 2 500 F, le Pack Lancement à 5 000 F, et IDEM Croissance à 3 000 F par mois. Les tarifs complets sont sur la [page des prix](/pricing).

## Un code que vous pouvez lire

Le code d'IDEM est public, sous licence Apache 2.0 avec la Commons Clause : vous pouvez l'auditer, le faire tourner chez vous et livrer du travail à vos clients avec. Seule la revente d'IDEM lui-même est exclue. Il est sur [GitHub](https://github.com/Idem-AI).

## Et maintenant ?

Le plus simple pour juger est d'essayer : décrivez votre projet en quelques lignes et regardez ce qu'IDEM en tire. Et si vous voulez suivre le produit, abonnez-vous au flux RSS de ce blog : chaque nouveauté y sera annoncée.
`;

const EN = `## Why this blog

IDEM was born in Douala from a simple conviction: an entrepreneur in Yaoundé should not pay four times more than one in Paris for the same work. This blog is where we tell **what we are building**, **why** we build it this way, and what we learn along the way.

You will find two kinds of posts:

- **articles**, to understand an idea, a decision or a method;
- **release notes**, to know what changes in IDEM, without jargon.

## IDEM in one sentence

IDEM is the AI that helps create **profitable businesses** in Africa. More than 500 AI agents work from your description: they structure the project, write the business plan, draw the brand, prepare the communication, build the website and put it online.

### What you get

| Step | What IDEM produces |
|---|---|
| Structure | SYSCOHADA-compliant business plan, financial forecasts |
| Be recognised | Logo, brand guidelines, stationery |
| Get known | Communication strategy, visuals and videos |
| Build | Website and app, written before your eyes by iCode |
| Launch | One-click go-live with iDeploy, on servers in Africa |

## Pay for what you keep

Seeing what IDEM produces costs nothing: you describe your project, look at the deliverables, and only pay for what you decide to keep.

> Prices are set country by country, in CFA francs, and paid by Mobile Money.

The Business Kit is 2,500 F, the Launch Pack 5,000 F, and IDEM Growth 3,000 F a month. Full pricing is on the [pricing page](/pricing).

## Code you can read

IDEM's code is public, under the Apache 2.0 licence with the Commons Clause: you can audit it, run it yourself and deliver client work with it. Only reselling IDEM itself is ruled out. It is on [GitHub](https://github.com/Idem-AI).

## What now?

The simplest way to judge is to try: describe your project in a few lines and see what IDEM makes of it. And if you want to follow the product, subscribe to this blog's RSS feed: every news item will be announced there.
`;

const POSTS = [
  {
    locale: 'fr' as const,
    slug: 'bienvenue-sur-le-blog-d-idem',
    title: 'Bienvenue sur le blog d’IDEM',
    excerpt:
      'Ce que nous construisons, pourquoi nous le construisons ainsi, et comment IDEM aide les entrepreneurs africains à créer des business rentables.',
    tags: ['idem', 'produit'],
    contentMd: FR,
    coverAlt: 'Motif géométrique d’IDEM',
  },
  {
    locale: 'en' as const,
    slug: 'welcome-to-the-idem-blog',
    title: 'Welcome to the IDEM blog',
    excerpt:
      'What we are building, why we build it this way, and how IDEM helps African entrepreneurs create profitable businesses.',
    tags: ['idem', 'product'],
    contentMd: EN,
    coverAlt: 'IDEM geometric pattern',
  },
];

async function main(): Promise<void> {
  await loadSecrets();
  await mongoDBConnection.connect();

  for (const post of POSTS) {
    if (await BlogPost.exists({ locale: post.locale, slug: post.slug })) {
      console.log(`= ${post.locale}/${post.slug} existe déjà`);
      continue;
    }
    const created = await blogService.create(
      { ...post, kind: 'article', authorName: 'Équipe IDEM', coverUrl: '/assets/images/home/brand.webp' },
      'seed'
    );
    await blogService.setStatus(String(created._id), 'published', 'seed');
    console.log(`✔ ${post.locale}/${post.slug} publié`);
  }

  await mongoDBConnection.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
