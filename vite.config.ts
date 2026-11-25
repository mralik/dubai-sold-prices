/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The web app lives in web/. API calls go to the local Hono server on port 8787.
export default defineConfig({
  root: "web",
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:8787" },
  },
  build: { outDir: "../dist", emptyOutDir: true },
  // Tests use the local sql.js database.
  test: { root: ".", include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"], setupFiles: ["./server/db.ts"] },
});
