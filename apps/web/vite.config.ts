import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [
		TanStackRouterVite(),
		react(),
		tailwindcss(),
		visualizer({ open: false, filename: "dist/stats.html" }),
	],
	server: { host: "0.0.0.0", port: 5173 },
});
