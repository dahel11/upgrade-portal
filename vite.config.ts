import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { localApiPlugin } from "./vite-local-api-plugin.ts";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), localApiPlugin()],
});
