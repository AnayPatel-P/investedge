import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true, // fail loudly instead of drifting to 5174 when the port is taken
    proxy: { "/api": "http://localhost:8000" },
  },
  test: { environment: "node" },
});
