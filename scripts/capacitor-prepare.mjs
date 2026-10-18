import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const sourceDir = path.resolve(".output/public");
const targetDir = path.resolve("dist");

if (!existsSync(sourceDir)) {
  throw new Error("Missing built web assets. Run `npm run build` first.");
}

rmSync(targetDir, { recursive: true, force: true });
mkdirSync(targetDir, { recursive: true });
cpSync(sourceDir, targetDir, { recursive: true, force: true });

const assetDir = path.join(targetDir, "assets");
const shellFile = path.join(targetDir, "_shell.html");

if (!existsSync(assetDir) || !existsSync(shellFile)) {
  throw new Error(
    "Missing built app shell. Enable TanStack Start SPA prerendering and run `npm run build` again.",
  );
}

const html = readFileSync(shellFile);

writeFileSync(path.join(targetDir, "index.html"), html, "utf8");
writeFileSync(path.join(targetDir, "404.html"), html, "utf8");
console.log(`Static app shell prepared in ${targetDir}`);
