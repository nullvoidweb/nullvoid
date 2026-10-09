#!/usr/bin/env node
// Copies third-party browser libraries from node_modules into src/vendor.
// Manifest V3 forbids remotely hosted code, so every library the extension
// executes must ship inside the package. Run after `npm install` or when
// bumping a dependency: `npm run vendor`.

import { cp, mkdir, rm, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nm = (...p) => path.join(root, "node_modules", ...p);
const out = (...p) => path.join(root, "src", "vendor", ...p);

async function copy(from, to) {
  await mkdir(path.dirname(to), { recursive: true });
  await cp(from, to, { recursive: true });
}

async function pkgVersion(name) {
  const json = JSON.parse(await readFile(nm(name, "package.json"), "utf8"));
  return json.version;
}

async function main() {
  await rm(out(), { recursive: true, force: true });
  await mkdir(out("licenses"), { recursive: true });

  // DOMPurify — HTML sanitizer for e-mail bodies, AI output and HTML previews.
  await copy(nm("dompurify", "dist", "purify.es.mjs"), out("purify.es.mjs"));
  await copy(nm("dompurify", "LICENSE"), out("licenses", "dompurify.txt"));

  // fflate — lazy, single-entry ZIP inflation for OOXML text extraction.
  await copy(nm("fflate", "esm", "browser.js"), out("fflate.mjs"));
  await copy(nm("fflate", "LICENSE"), out("licenses", "fflate.txt"));

  // PDF.js — renders PDFs to canvas inside a worker, with scripting disabled.
  const pdf = (...p) => nm("pdfjs-dist", ...p);
  await copy(pdf("build", "pdf.min.mjs"), out("pdfjs", "pdf.min.mjs"));
  await copy(pdf("build", "pdf.worker.min.mjs"), out("pdfjs", "pdf.worker.min.mjs"));
  await copy(pdf("cmaps"), out("pdfjs", "cmaps"));
  await copy(pdf("standard_fonts"), out("pdfjs", "standard_fonts"));
  await copy(pdf("iccs"), out("pdfjs", "iccs"));
  for (const f of ["openjpeg.wasm", "jbig2.wasm", "qcms_bg.wasm", "openjpeg_nowasm_fallback.js", "jbig2_nowasm_fallback.js"]) {
    if (existsSync(pdf("wasm", f))) await copy(pdf("wasm", f), out("pdfjs", "wasm", f));
  }
  await copy(pdf("LICENSE"), out("licenses", "pdfjs.txt"));

  // Anthropic SDK — bundled into a single browser ESM file.
  await build({
    entryPoints: [nm("@anthropic-ai", "sdk", "index.mjs")],
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    minify: true,
    legalComments: "eof",
    outfile: out("anthropic-sdk.mjs"),
  });
  await copy(nm("@anthropic-ai", "sdk", "LICENSE"), out("licenses", "anthropic-sdk.txt"));

  const manifest = {
    generated: new Date().toISOString(),
    packages: {
      dompurify: await pkgVersion("dompurify"),
      fflate: await pkgVersion("fflate"),
      "pdfjs-dist": await pkgVersion("pdfjs-dist"),
      "@anthropic-ai/sdk": await pkgVersion("@anthropic-ai/sdk"),
    },
  };
  await writeFile(out("VERSIONS.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log("Vendored:", manifest.packages);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
