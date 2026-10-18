import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
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
const mainFiles = readdirSync(assetDir).filter((file) => /^index-.*\.js$/.test(file));
const cssFiles = readdirSync(assetDir).filter((file) => /\.css$/.test(file));

if (mainFiles.length === 0) {
  throw new Error("No client entry bundle found in .output/public/assets");
}

const entryFile = mainFiles[0];
const cssFile = cssFiles[0] ?? null;
const repositoryName = process.env.GITHUB_REPOSITORY?.split("/").at(-1) || "little-by-little";
const assetBase = process.env.GITHUB_PAGES === "true" ? `/${repositoryName}/` : "./";

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#7c9b6f" />
    <meta name="format-detection" content="telephone=no" />
    <title>Fit Start Daily</title>
    ${cssFile ? `<link rel="stylesheet" href="${assetBase}assets/${cssFile}" />` : ""}
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="${assetBase}assets/${entryFile}"></script>
  </body>
</html>
`;

writeFileSync(path.join(targetDir, "index.html"), html, "utf8");
writeFileSync(path.join(targetDir, "404.html"), html, "utf8");
console.log(`Capacitor web assets prepared in ${targetDir}`);
