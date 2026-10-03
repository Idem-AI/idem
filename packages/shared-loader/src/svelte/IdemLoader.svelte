<script lang="ts">
  /**
   * L'unique indicateur de chargement d'Idem, rendu Svelte (Chart).
   *
   * Même semis d'awalé, même géométrie, mêmes styles que `<idem-loader>` côté
   * Angular : seul le rendu change, parce que le framework change.
   */
  import {
    IDEM_LOADER_BOX,
    IDEM_LOADER_SIZES,
    idemLoaderSeeds,
    nextIdemLoaderGradientId,
    type IdemLoaderSize
  } from '../index';

  import '../loader.css';

  interface Props {
    /** Taille du cercle : `xs` dans un bouton, `lg` au centre d'une page. */
    size?: IdemLoaderSize;
    /** Texte affiché sous le cercle, et lu par les lecteurs d'écran. */
    label?: string | null;
    /** Prend toute la largeur et se centre, avec de l'air au-dessus et dessous. */
    block?: boolean;
    /** Se superpose au contenu du parent positionné plutôt que de le remplacer. */
    overlay?: boolean;
    /** Couvre la fenêtre entière. */
    fullscreen?: boolean;
    /** Ce que lisent les lecteurs d'écran quand aucun `label` n'est affiché. */
    ariaLabel?: string;
    /** Classes ajoutées à l'hôte, pour l'intégration dans la page. */
    class?: string;
  }

  let {
    size = 'md',
    label = null,
    block = false,
    overlay = false,
    fullscreen = false,
    ariaLabel = 'Chargement',
    class: className = ''
  }: Props = $props();

  const gradientId = nextIdemLoaderGradientId();
  const seeds = $derived(idemLoaderSeeds(size));
  const px = $derived(IDEM_LOADER_SIZES[size]);
</script>

<span
  class="idem-loader-host {className}"
  class:idem-loader-host--block={block}
  class:idem-loader-host--overlay={overlay}
  class:idem-loader-host--fullscreen={fullscreen}>
  <span class="idem-loader" role="status" aria-label={label || ariaLabel}>
    <svg
      class="idem-loader__ring"
      width={px}
      height={px}
      viewBox="0 0 {IDEM_LOADER_BOX} {IDEM_LOADER_BOX}"
      aria-hidden="true">
      <defs>
        <linearGradient
          id={gradientId}
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="0"
          x2={IDEM_LOADER_BOX}
          y2={IDEM_LOADER_BOX}>
          <stop offset="0%" stop-color="var(--color-primary-500, #1447e6)" />
          <stop offset="100%" stop-color="var(--color-secondary-500, #22d3ee)" />
        </linearGradient>
      </defs>
      <g fill="url(#{gradientId})">
        {#each seeds as seed, i (i)}
          <path class="idem-loader__seed" d={seed.d} style:animation-delay={seed.delay} />
        {/each}
      </g>
    </svg>
    {#if label}
      <span class="idem-loader__label">{label}</span>
    {/if}
  </span>
</span>
