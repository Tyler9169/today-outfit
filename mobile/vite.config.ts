import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
export default defineConfig({ root: path.resolve("mobile"), base: "./", publicDir: path.resolve("public"), plugins: [react()], resolve: { alias: { "@": path.resolve(".") } }, build: { outDir: path.resolve("dist-mobile"), emptyOutDir: true }, server: { host: "127.0.0.1", port: 5174 } });
