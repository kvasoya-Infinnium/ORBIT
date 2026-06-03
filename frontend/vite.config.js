import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The React dev server runs on port 8080. `host: true` binds it to 0.0.0.0 so other
// machines on the same network can reach it at http://<this-machine-ip>:8080.
// The frontend talks to the FastAPI backend on port 8000 (see src/api.js, which uses
// the same hostname the page was opened with, so it works from any machine).
export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 8080 },
});
