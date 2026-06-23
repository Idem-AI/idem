import { defineConfig, loadEnv } from "vite";
import { fileURLToPath } from "url";
import path from "path";
import laravel from "laravel-vite-plugin";
import vue from "@vitejs/plugin-vue";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '')

    return {
        server: {
            watch: {
                ignored: [
                    "**/dev_*_data/**",
                    "**/storage/**",
                ],
            },
            host: "0.0.0.0",
            port: parseInt(env.VITE_PORT) || 5173,
            hmr: {
                host: env.VITE_HMR_HOST || 'localhost',
                port: parseInt(env.VITE_PORT) || 5173,
            },
        },
        plugins: [
            laravel({
                input: ["resources/css/app.css", "resources/js/app.js"],
                refresh: true,
            }),
            vue({
                template: {
                    transformAssetUrls: {
                        base: null,
                        includeAbsolute: false,
                    },
                },
            }),
        ],
        resolve: {
            alias: {
                vue: "vue/dist/vue.esm-bundler.js",
                "@idem/shared-styles": "/packages/shared-styles",
            },
        },
    }
});
