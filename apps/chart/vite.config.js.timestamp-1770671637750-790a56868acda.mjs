// vite.config.js
import { sveltekit } from "file:///app/node_modules/@sveltejs/kit/src/exports/vite/index.js";
import { FileSystemIconLoader } from "file:///app/node_modules/unplugin-icons/dist/loaders.js";
import Icons from "file:///app/node_modules/unplugin-icons/dist/vite.js";
import { defineConfig } from "file:///app/node_modules/vitest/dist/config.js";
import tailwindcss from "file:///app/node_modules/@tailwindcss/vite/dist/index.mjs";
var alwaysFullReload = {
  name: "always-full-reload",
  handleHotUpdate({ server }) {
    server.ws.send({ type: "full-reload" });
    return [];
  }
};
var vite_config_default = defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit(),
    Icons({
      compiler: "svelte",
      customCollections: {
        custom: FileSystemIconLoader("./static/icons")
      }
    }),
    alwaysFullReload
  ],
  envPrefix: ["VITE_", "MERMAID_"],
  server: {
    port: 3e3,
    host: true
  },
  preview: {
    port: 3e3,
    host: true
  },
  test: {
    environment: "jsdom",
    // in-source testing
    includeSource: ["src/**/*.{js,ts,svelte}"],
    // Ignore E2E tests
    exclude: [
      "tests/**/*",
      "**/node_modules/**",
      "**/dist/**",
      "**/.{idea,git,cache,output,temp}/**",
      "**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*"
    ],
    setupFiles: ["./src/tests/setup.ts"],
    coverage: {
      exclude: ["src/mocks", ".svelte-kit", "src/**/*.test.ts"],
      reporter: ["text", "json", "html", "lcov"]
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvYXBwL2FwcHMvY2hhcnRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9hcHAvYXBwcy9jaGFydC92aXRlLmNvbmZpZy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vYXBwL2FwcHMvY2hhcnQvdml0ZS5jb25maWcuanNcIjtpbXBvcnQgeyBzdmVsdGVraXQgfSBmcm9tICdAc3ZlbHRlanMva2l0L3ZpdGUnO1xuaW1wb3J0IHsgRmlsZVN5c3RlbUljb25Mb2FkZXIgfSBmcm9tICd1bnBsdWdpbi1pY29ucy9sb2FkZXJzJztcbmltcG9ydCBJY29ucyBmcm9tICd1bnBsdWdpbi1pY29ucy92aXRlJztcbmltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gJ3ZpdGVzdC9jb25maWcnO1xuaW1wb3J0IHRhaWx3aW5kY3NzIGZyb20gJ0B0YWlsd2luZGNzcy92aXRlJztcblxuLyoqXG4gKiBITVIgY3JlYXRlcyBzdGF0ZSBpbmNvbnNpc3RlbmNpZXMsIHNvIHdlIGFsd2F5cyByZWxvYWQgdGhlIHBhZ2UuXG4gKiBAdHlwZSB7aW1wb3J0KCd2aXRlJykuUGx1Z2luT3B0aW9ufSBQbHVnaW5PcHRpb25cbiAqL1xuY29uc3QgYWx3YXlzRnVsbFJlbG9hZCA9IHtcbiAgbmFtZTogJ2Fsd2F5cy1mdWxsLXJlbG9hZCcsXG4gIGhhbmRsZUhvdFVwZGF0ZSh7IHNlcnZlciB9KSB7XG4gICAgc2VydmVyLndzLnNlbmQoeyB0eXBlOiAnZnVsbC1yZWxvYWQnIH0pO1xuICAgIHJldHVybiBbXTtcbiAgfVxufTtcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgcGx1Z2luczogW1xuICAgIHRhaWx3aW5kY3NzKCksXG4gICAgc3ZlbHRla2l0KCksXG4gICAgSWNvbnMoe1xuICAgICAgY29tcGlsZXI6ICdzdmVsdGUnLFxuICAgICAgY3VzdG9tQ29sbGVjdGlvbnM6IHtcbiAgICAgICAgY3VzdG9tOiBGaWxlU3lzdGVtSWNvbkxvYWRlcignLi9zdGF0aWMvaWNvbnMnKVxuICAgICAgfVxuICAgIH0pLFxuICAgIGFsd2F5c0Z1bGxSZWxvYWRcbiAgXSxcbiAgZW52UHJlZml4OiBbJ1ZJVEVfJywgJ01FUk1BSURfJ10sXG4gIHNlcnZlcjoge1xuICAgIHBvcnQ6IDMwMDAsXG4gICAgaG9zdDogdHJ1ZVxuICB9LFxuICBwcmV2aWV3OiB7XG4gICAgcG9ydDogMzAwMCxcbiAgICBob3N0OiB0cnVlXG4gIH0sXG4gIHRlc3Q6IHtcbiAgICBlbnZpcm9ubWVudDogJ2pzZG9tJyxcbiAgICAvLyBpbi1zb3VyY2UgdGVzdGluZ1xuICAgIGluY2x1ZGVTb3VyY2U6IFsnc3JjLyoqLyoue2pzLHRzLHN2ZWx0ZX0nXSxcbiAgICAvLyBJZ25vcmUgRTJFIHRlc3RzXG4gICAgZXhjbHVkZTogW1xuICAgICAgJ3Rlc3RzLyoqLyonLFxuICAgICAgJyoqXFwvbm9kZV9tb2R1bGVzLyoqJyxcbiAgICAgICcqKlxcL2Rpc3QvKionLFxuICAgICAgJyoqXFwvLntpZGVhLGdpdCxjYWNoZSxvdXRwdXQsdGVtcH0vKionLFxuICAgICAgJyoqXFwve2thcm1hLHJvbGx1cCx3ZWJwYWNrLHZpdGUsdml0ZXN0LGplc3QsYXZhLGJhYmVsLG55YyxjeXByZXNzLHRzdXAsYnVpbGQsZXNsaW50LHByZXR0aWVyfS5jb25maWcuKidcbiAgICBdLFxuICAgIHNldHVwRmlsZXM6IFsnLi9zcmMvdGVzdHMvc2V0dXAudHMnXSxcbiAgICBjb3ZlcmFnZToge1xuICAgICAgZXhjbHVkZTogWydzcmMvbW9ja3MnLCAnLnN2ZWx0ZS1raXQnLCAnc3JjLyoqLyoudGVzdC50cyddLFxuICAgICAgcmVwb3J0ZXI6IFsndGV4dCcsICdqc29uJywgJ2h0bWwnLCAnbGNvdiddXG4gICAgfVxuICB9XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBK04sU0FBUyxpQkFBaUI7QUFDelAsU0FBUyw0QkFBNEI7QUFDckMsT0FBTyxXQUFXO0FBQ2xCLFNBQVMsb0JBQW9CO0FBQzdCLE9BQU8saUJBQWlCO0FBTXhCLElBQU0sbUJBQW1CO0FBQUEsRUFDdkIsTUFBTTtBQUFBLEVBQ04sZ0JBQWdCLEVBQUUsT0FBTyxHQUFHO0FBQzFCLFdBQU8sR0FBRyxLQUFLLEVBQUUsTUFBTSxjQUFjLENBQUM7QUFDdEMsV0FBTyxDQUFDO0FBQUEsRUFDVjtBQUNGO0FBRUEsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUztBQUFBLElBQ1AsWUFBWTtBQUFBLElBQ1osVUFBVTtBQUFBLElBQ1YsTUFBTTtBQUFBLE1BQ0osVUFBVTtBQUFBLE1BQ1YsbUJBQW1CO0FBQUEsUUFDakIsUUFBUSxxQkFBcUIsZ0JBQWdCO0FBQUEsTUFDL0M7QUFBQSxJQUNGLENBQUM7QUFBQSxJQUNEO0FBQUEsRUFDRjtBQUFBLEVBQ0EsV0FBVyxDQUFDLFNBQVMsVUFBVTtBQUFBLEVBQy9CLFFBQVE7QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxFQUNSO0FBQUEsRUFDQSxTQUFTO0FBQUEsSUFDUCxNQUFNO0FBQUEsSUFDTixNQUFNO0FBQUEsRUFDUjtBQUFBLEVBQ0EsTUFBTTtBQUFBLElBQ0osYUFBYTtBQUFBO0FBQUEsSUFFYixlQUFlLENBQUMseUJBQXlCO0FBQUE7QUFBQSxJQUV6QyxTQUFTO0FBQUEsTUFDUDtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxJQUNGO0FBQUEsSUFDQSxZQUFZLENBQUMsc0JBQXNCO0FBQUEsSUFDbkMsVUFBVTtBQUFBLE1BQ1IsU0FBUyxDQUFDLGFBQWEsZUFBZSxrQkFBa0I7QUFBQSxNQUN4RCxVQUFVLENBQUMsUUFBUSxRQUFRLFFBQVEsTUFBTTtBQUFBLElBQzNDO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
