declare module '*.css' {
  const content: string;
  export default content;
}

/** Feuille compilée au moment du paquet : Tailwind (thème vidéo + utilitaires) puis engine.css. */
declare module 'virtual:engine-css' {
  const content: string;
  export default content;
}

declare module '*.wasm' {
  const bytes: Uint8Array;
  export default bytes;
}
