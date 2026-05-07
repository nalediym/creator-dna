import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
  },
  worker: {
    format: "es",
  },
  optimizeDeps: {
    // Transformers.js + onnxruntime-web ship WASM that Vite shouldn't try to pre-bundle
    exclude: ["@huggingface/transformers"],
  },
  build: {
    target: "es2022",
    sourcemap: true,
  },
});
