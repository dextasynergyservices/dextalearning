import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [
		tanstackRouter({ target: "react", autoCodeSplitting: true }),
		react(),
		tailwindcss(),
		visualizer({ open: false, filename: "dist/stats.html" }),
	],
	resolve: {
		alias: {
			"@": fileURLToPath(new URL("./src", import.meta.url)),
		},
	},
	server: { host: "0.0.0.0", port: 5173 },
});
