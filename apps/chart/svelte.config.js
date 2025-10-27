import adapter from '@sveltejs/adapter-static';
import { sveltePreprocess } from 'svelte-preprocess';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Consult https://github.com/sveltejs/svelte-preprocess
  // for more information about preprocessors
  preprocess: [
    sveltePreprocess({
      postcss: true
    })
  ],
  kit: {
    alias: {
      '$/*': './src/lib/*',
      '@idem/shared-models': '../../packages/shared-models/src',
      '@idem/shared-models/*': '../../packages/shared-models/src/*',
      '@idem/shared-auth-client': '../../packages/shared-auth-client/src',
      '@idem/shared-auth-client/*': '../../packages/shared-auth-client/src/*'
    },
    adapter: adapter({
      pages: 'docs',
      fallback: 'index.html'
    })
  }
};

export default config;
