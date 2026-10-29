import { useCallback, useEffect, useRef, useState } from 'react';
import { eventEmitter } from '../components/AiChat/utils/EventEmitter';

/** En deçà (px) du bas, on considère que l'utilisateur suit la conversation. */
const NEAR_BOTTOM = 96;

/**
 * LE DÉFILEMENT DU FIL DU CHAT — l'utilisateur doit toujours voir ce qui se passe.
 *
 *   suivre      tant que l'utilisateur est en bas, le fil le reste quoi qui grandisse : texte qui s'écrit, étapes
 *               qui s'ajoutent, choix qui s'affichent, image qui se charge (observation de la taille du contenu,
 *               pas seulement des messages)
 *   lire        s'il remonte lire (molette, doigt, clavier), on le laisse lire : le fil ne lui arrache pas la page ;
 *               un bouton « Voir la suite » dit que ça avance plus bas
 *   ramener     trois moments le ramènent en bas même s'il lisait plus haut : il envoie un message, la génération
 *               se termine, ou une réponse lui demande d'agir (choix à cliquer, page à ouvrir : `chat:attention`)
 */
export function useChatAutoScroll(isLoading: boolean) {
  // Les éléments arrivent par des refs de rappel : les observateurs s'installent une fois par élément, pas à
  // chaque rendu (le fil se redessine des dizaines de fois par seconde pendant l'écriture).
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [content, setContent] = useState<HTMLDivElement | null>(null);
  /** Suivre le bas : vrai tant que l'utilisateur n'est pas remonté lire. */
  const stick = useRef(true);
  /** Jusqu'à quand les événements de défilement sont les nôtres (et pas un geste de l'utilisateur). */
  const ours = useRef(0);
  const [away, setAway] = useState(false);
  const [unseen, setUnseen] = useState(false);

  const toBottom = useCallback((smooth: boolean) => {
    const el = containerRef.current;
    if (!el) return;
    ours.current = performance.now() + (smooth ? 700 : 120);
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  /** Descendre si l'utilisateur suit ; sinon noter qu'il y a du nouveau. `force` le ramène même s'il lisait. */
  const follow = useCallback(
    (options: { force?: boolean; smooth?: boolean } = {}) => {
      if (options.force) {
        stick.current = true;
        setAway(false);
        setUnseen(false);
      }
      if (stick.current) toBottom(!!options.smooth);
      else setUnseen(true);
    },
    [toBottom]
  );

  const onScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el || performance.now() < ours.current) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM;
    stick.current = near;
    setAway(!near);
    if (near) setUnseen(false);
  }, []);

  // Un geste de l'utilisateur interrompt aussitôt un défilement en cours : il compte, même au milieu du nôtre.
  useEffect(() => {
    const el = container;
    if (!el) return;
    const intent = () => {
      ours.current = 0;
    };
    const keys = (event: KeyboardEvent) => {
      if (['ArrowUp', 'PageUp', 'Home'].includes(event.key)) intent();
    };
    el.addEventListener('wheel', intent, { passive: true });
    el.addEventListener('touchmove', intent, { passive: true });
    el.addEventListener('keydown', keys);
    return () => {
      el.removeEventListener('wheel', intent);
      el.removeEventListener('touchmove', intent);
      el.removeEventListener('keydown', keys);
    };
  }, [container]);

  // Le contenu grandit (écriture en direct, étapes, choix, images) : on le suit si l'utilisateur est en bas.
  useEffect(() => {
    if (!content || typeof ResizeObserver === 'undefined') return;
    let last = content.getBoundingClientRect().height;
    const observer = new ResizeObserver(() => {
      const height = content.getBoundingClientRect().height;
      if (height > last) follow();
      last = height;
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [content, follow]);

  // Début d'une réponse (l'utilisateur vient d'envoyer) : on descend ; fin d'un traitement : on descend aussi,
  // en douceur, pour qu'il voie le résultat ou ce qu'on attend de lui.
  const wasLoading = useRef(isLoading);
  useEffect(() => {
    if (isLoading !== wasLoading.current) follow({ force: true, smooth: !isLoading });
    wasLoading.current = isLoading;
  }, [isLoading, follow]);

  // Une réponse demande d'agir : on le ramène en bas, après le rendu de ce qu'elle affiche.
  useEffect(
    () =>
      eventEmitter.on('chat:attention', () => {
        requestAnimationFrame(() => follow({ force: true, smooth: true }));
      }),
    [follow]
  );

  const attachContainer = useCallback((el: HTMLDivElement | null) => {
    containerRef.current = el;
    setContainer(el);
  }, []);

  return {
    /** À poser sur l'élément qui défile. */
    containerRef: attachContainer,
    /** À poser sur le contenu du fil (sa taille est observée). */
    contentRef: setContent,
    onScroll,
    follow,
    /** L'utilisateur lit plus haut alors que ça avance (ou que du nouveau est arrivé) : « Voir la suite ». */
    showJump: away && (isLoading || unseen),
    jump: () => follow({ force: true, smooth: true }),
  };
}
