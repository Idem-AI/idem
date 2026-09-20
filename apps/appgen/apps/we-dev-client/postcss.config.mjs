/* Tailwind 4 : le plugin PostCSS est désormais un paquet distinct, et
   autoprefixer est intégré au moteur — il n'a plus à figurer ici. */
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};

export default config;
