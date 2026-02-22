import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
      // Match Next.js `lib/*` bare imports used in route handlers and tests
      lib: path.resolve(__dirname, "lib"),
    },
  },
});


