import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
const root = "dist/client";
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.filter(e => !e.name.startsWith(".")).map(e => e.isDirectory() ? walk(path.join(dir,e.name)) : [path.join(dir,e.name)]))).flat();
}
const files = (await walk(root)).filter(f => /\.(js|css|png|svg|woff2?|webmanifest)$/.test(f) && !f.endsWith("/sw.js")).sort();
const hash = createHash("sha256");
for (const file of files) hash.update(await readFile(file));
const template = await readFile("scripts/service-worker.js", "utf8");
hash.update(template);
const version = hash.digest("hex").slice(0,16);
const urls = ["/", ...files.map(f => "/" + path.relative(root,f).split(path.sep).join("/"))];
await writeFile(path.join(root,"sw.js"), `const CACHE_NAME = "wardrobe-${version}";\nconst RESOURCES = ${JSON.stringify(urls)};\n${template}`);
console.log(`PWA ${version}: ${urls.length} resources`);
