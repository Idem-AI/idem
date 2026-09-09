import { useEffect, useState } from 'react';

/**
 * Abonnement à une media query.
 *
 * L'état initial est lu de façon synchrone : partir de `false` puis corriger
 * après le montage ferait afficher la disposition bureau pendant une frame sur
 * mobile, avec un saut de mise en page visible.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);

    setMatches(mql.matches);
    mql.addEventListener('change', onChange);

    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** Point de rupture unique du builder : en dessous, chat et espace de travail
 *  ne tiennent pas côte à côte et basculent en vue unique. */
export const useIsCompact = () => useMediaQuery('(max-width: 900px)');

export default useMediaQuery;
