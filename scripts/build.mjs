#!/usr/bin/env node
// Packages the extension for each browser:
//   node scripts/build.mjs            → dist/chrome + dist/firefox (+ zips)
//   node scripts/build.mjs chrome     → Chrome / Edge / Brave / Opera only
//   node scripts/build.mjs firefox    → Firefox only
//
// src/ is the Chromium build as-is (load it unpacked during development).
// The Firefox build rewrites the manifest: background scripts instead of a
// service worker, sidebar_action instead of side_panel, and Gecko settings.

import { cp, mkdir, readFile, rm, writeFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { zipSync } from "fflate";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "src");
const dist = path.join(root, "dist");
const targets = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const wanted = targets.length ? targets : ["chrome", "firefox"];
const GECKO_ID = "nullvoid@nullvoidweb.github.io";

async function listFiles(dir, base = dir) {
  const out = [];
  for (const entry of await readdir(dir)) {
    const full = path.join(dir, entry);
    const s = await stat(full);
    if (s.isDirectory()) out.push(...await listFiles(full, base));
    else out.push(path.relative(base, full).split(path.sep).join("/"));
  }
  return out;
}

async function zipDir(dir, outFile) {
  const files = {};
  for (const rel of await listFiles(dir)) files[rel] = [new Uint8Array(await readFile(path.join(dir, rel))), { level: 9 }];
  await writeFile(outFile, zipSync(files));
}

export function firefoxManifest(manifest) {
  const m = structuredClone(manifest);
  m.background = { scripts: [manifest.background.service_worker], type: "module" };
  delete m.minimum_chrome_version;
  delete m.side_panel;
  m.permissions = m.permissions.filter((p) => !["sidePanel"].includes(p));
  m.sidebar_action = {
    default_title: "NULL VOID AI Assistant",
    default_panel: manifest.side_panel.default_path,
    default_icon: manifest.action.default_icon,
    open_at_install: false,
  };
  m.browser_specific_settings = {
    gecko: {
      id: GECKO_ID,
      strict_min_version: "140.0",
      data_collection_permissions: {
        required: ["none"],
        optional: ["browsingActivity", "websiteContent"],
      },
    },
    // The data-collection consent framework needs Firefox for Android 142+.
    gecko_android: { strict_min_version: "142.0" },
  };
  return m;
}

async function build(target) {
  const out = path.join(dist, target);
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  await cp(src, out, { recursive: true });
  const manifest = JSON.parse(await readFile(path.join(src, "manifest.json"), "utf8"));
  const finalManifest = target === "firefox" ? firefoxManifest(manifest) : manifest;
  await writeFile(path.join(out, "manifest.json"), JSON.stringify(finalManifest, null, 2) + "\n");
  const zip = path.join(dist, `nullvoid-${target}-${manifest.version}.zip`);
  await zipDir(out, zip);
  const size = (await stat(zip)).size;
  console.log(`✓ ${target}: dist/${target}/ and ${path.basename(zip)} (${(size / 1048576).toFixed(1)} MB)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  for (const t of wanted) {
    if (!["chrome", "firefox"].includes(t)) {
      console.error(`Unknown target "${t}" (use chrome or firefox)`);
      process.exit(1);
    }
    await build(t);
  }
}
