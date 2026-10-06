import { readFile, writeFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
const root = "docs";
async function walk(dir) { return (await Promise.all((await readdir(dir, {withFileTypes:true})).filter(e=>!e.name.startsWith(".")).map(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]))).flat(); }
const manifest = JSON.parse(await readFile("public/manifest.webmanifest", "utf8"));
manifest.id = "./"; manifest.start_url = "./"; manifest.scope = "./";
manifest.icons = manifest.icons.map(icon => ({...icon, src: icon.src.replace(/^\//, "./")}));
await writeFile("docs/manifest.webmanifest", JSON.stringify(manifest));
const files = (await walk(root)).filter(f=>!f.endsWith("/sw.js")).sort();
const hash = createHash("sha256");
for (const file of files) hash.update(await readFile(file));
let template = await readFile("scripts/service-worker.js", "utf8");
template = template.replace('cache.match("/")', 'cache.match(new URL("./", self.registration.scope).href)');
hash.update(template);
const resources = ["./", ...files.map(f=>"./"+path.relative(root,f).split(path.sep).join("/"))];
await writeFile("docs/sw.js", `const CACHE_NAME = "wardrobe-pages-${hash.digest("hex").slice(0,16)}";\nconst RESOURCES = ${JSON.stringify(resources)}.map(url => new URL(url, self.registration.scope).href);\n${template}`);
await writeFile("docs/.nojekyll", "");
