#!/usr/bin/env node
// Builds the static declarativeNetRequest rulesets from public threat feeds.
//
//   npm run rules                 # download feeds and regenerate src/rules/*.json
//   npm run rules -- --offline    # rebuild from the cached feeds in .cache/feeds
//
// Domains are packed into `requestDomains` conditions (thousands per rule), so
// hundreds of thousands of hosts fit comfortably inside Chrome's static rule
// budget (30k rules guaranteed per extension).

import { mkdir, readFile, writeFile, readdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cacheDir = path.join(root, ".cache", "feeds");
const rulesDir = path.join(root, "src", "rules");
const offline = process.argv.includes("--offline");

// Only permissively licensed feeds (MIT / CC0) so the generated rulesets can
// ship inside this MIT-licensed extension.
const SOURCES = {
  ads: [
    { name: "StevenBlack/hosts (unified)", url: "https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts", license: "MIT", format: "hosts" },
  ],
  malware: [
    { name: "abuse.ch URLhaus host file", url: "https://urlhaus.abuse.ch/downloads/hostfile/", license: "CC0", format: "hosts", payload: true },
    { name: "Phishing.Database (active domains)", url: "https://raw.githubusercontent.com/mitchellkrogza/Phishing.Database/master/phishing-domains-ACTIVE.txt", license: "MIT", format: "domains" },
  ],
};

// Never block these registrable domains outright, even if a feed lists them —
// they are shared platforms where blocking the whole domain breaks the web.
// Subdomains listed explicitly (e.g. a single bucket or site) are still blocked.
const NEVER_BLOCK = new Set([
  "google.com", "googleapis.com", "gstatic.com", "googleusercontent.com", "youtube.com", "github.com", "githubusercontent.com",
  "github.io", "gitlab.com", "bitbucket.org", "microsoft.com", "live.com", "office.com", "sharepoint.com", "onedrive.com",
  "1drv.ms", "windows.net", "azureedge.net", "azurewebsites.net", "amazon.com", "amazonaws.com", "cloudfront.net",
  "apple.com", "icloud.com", "dropbox.com", "dropboxusercontent.com", "discord.com", "discordapp.com", "discordapp.net",
  "telegram.org", "t.me", "facebook.com", "fbcdn.net", "instagram.com", "whatsapp.com", "twitter.com", "x.com", "t.co",
  "linkedin.com", "wikipedia.org", "wikimedia.org", "cloudflare.com", "pages.dev", "workers.dev", "netlify.app",
  "vercel.app", "web.app", "firebaseapp.com", "herokuapp.com", "blogspot.com", "wordpress.com", "wixsite.com",
  "weebly.com", "000webhostapp.com", "duckdns.org", "ngrok.io", "ngrok-free.app", "trycloudflare.com", "r2.dev",
  "appspot.com", "glitch.me", "repl.co", "onrender.com", "mediafire.com", "mega.nz", "box.com", "wetransfer.com",
  "docs.google.com", "drive.google.com", "sites.google.com", "forms.gle", "bit.ly", "tinyurl.com", "cutt.ly",
  "mozilla.org", "mail.tm", "browserless.io", "anthropic.com", "openai.com", "virustotal.com", "abuse.ch",
  "localhost", "localhost.localdomain", "local", "broadcasthost",
]);

const AD_RESOURCE_TYPES = ["sub_frame", "script", "image", "stylesheet", "font", "xmlhttprequest", "ping", "media", "websocket", "object", "other"];
const MALWARE_SUB_TYPES = ["sub_frame", "script", "image", "stylesheet", "font", "xmlhttprequest", "ping", "media", "websocket", "object", "other"];
const CHUNK = 5000;
// addons.mozilla.org refuses JSON files it cannot parse (> 4 MB), so large
// rulesets are split into several files, each declared in the manifest.
const MAX_FILE_BYTES = 3 * 1024 * 1024;

const DOMAIN_RE = /^(?=.{4,253}$)(?!-)([a-z0-9-]{1,63}\.)+[a-z][a-z0-9-]{0,62}$/;
const IPV4_RE = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

async function fetchFeed(src) {
  const file = path.join(cacheDir, `${src.name.replace(/[^a-z0-9]+/gi, "_")}.txt`);
  if (offline) {
    if (!existsSync(file)) throw new Error(`No cached copy of ${src.name}; run without --offline first`);
    return readFile(file, "utf8");
  }
  process.stdout.write(`↓ ${src.name} … `);
  const res = await fetch(src.url, { headers: { "User-Agent": "nullvoid-blocklist-builder" } });
  if (!res.ok) throw new Error(`${src.name}: HTTP ${res.status}`);
  const text = await res.text();
  await mkdir(cacheDir, { recursive: true });
  await writeFile(file, text);
  console.log(`${(text.length / 1048576).toFixed(1)} MB`);
  return text;
}

export function parseFeed(text, format) {
  const out = [];
  for (let line of text.split(/\r?\n/)) {
    line = line.replace(/#.*$/, "").trim().toLowerCase();
    if (!line) continue;
    let host = line;
    if (format === "hosts") {
      const parts = line.split(/\s+/);
      if (parts.length < 2) continue;
      host = parts[1];
    }
    host = host.replace(/^\*\./, "").replace(/\.$/, "");
    if (DOMAIN_RE.test(host) || IPV4_RE.test(host)) out.push(host);
  }
  return out;
}

function isProtected(host) {
  return NEVER_BLOCK.has(host);
}

/** Drop hosts already covered by a listed parent (requestDomains matches subdomains). */
export function collapse(domains) {
  const set = new Set(domains);
  const result = [];
  for (const d of set) {
    const labels = d.split(".");
    let covered = false;
    for (let i = 1; i < labels.length - 1; i++) {
      if (set.has(labels.slice(i).join("."))) {
        covered = true;
        break;
      }
    }
    if (!covered) result.push(d);
  }
  return result.sort();
}

function chunks(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

export function buildAdRules(domains) {
  return chunks(domains, CHUNK).map((requestDomains, i) => ({
    id: i + 1,
    priority: 1,
    action: { type: "block" },
    condition: { requestDomains, domainType: "thirdParty", resourceTypes: AD_RESOURCE_TYPES },
  }));
}

/**
 * Phishing/malware hosts: navigations (top-level and frames) are redirected to
 * the NULL VOID interstitial. Hosts from payload feeds (URLhaus) additionally
 * have every sub-resource blocked, since they serve malware downloads/scripts.
 */
export function buildMalwareRules(domains, payloadHosts = new Set()) {
  const rules = [];
  let id = 1;
  for (const requestDomains of chunks(domains, CHUNK)) {
    rules.push({
      id: id++, priority: 2,
      action: { type: "redirect", redirect: { extensionPath: "/blocked/blocked.html?mode=list&list=malware" } },
      condition: { requestDomains, resourceTypes: ["main_frame", "sub_frame"] },
    });
  }
  const payload = domains.filter((d) => payloadHosts.has(d));
  for (const requestDomains of chunks(payload, CHUNK)) {
    rules.push({
      id: id++, priority: 2,
      action: { type: "block" },
      condition: { requestDomains, resourceTypes: MALWARE_SUB_TYPES.filter((t) => t !== "sub_frame") },
    });
  }
  return rules;
}

/** Split a rule list into files no larger than `maxBytes`. */
export function splitRules(rules, maxBytes = MAX_FILE_BYTES) {
  const files = [];
  let cur = [], size = 2;
  for (const r of rules) {
    const len = JSON.stringify(r).length + 1;
    if (cur.length && size + len > maxBytes) {
      files.push(cur);
      cur = [];
      size = 2;
    }
    cur.push(r);
    size += len;
  }
  if (cur.length) files.push(cur);
  return files;
}

async function updateManifest(resources) {
  const file = path.join(root, "src", "manifest.json");
  const manifest = JSON.parse(await readFile(file, "utf8"));
  manifest.declarative_net_request = { rule_resources: resources };
  await writeFile(file, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function main() {
  await mkdir(rulesDir, { recursive: true });
  for (const f of await readdir(rulesDir)) {
    if (/^(ads|malware)(-\d+)?\.json$/.test(f)) await rm(path.join(rulesDir, f));
  }
  const resources = [];
  const summary = { generated: new Date().toISOString(), rulesets: {} };
  for (const [kind, sources] of Object.entries(SOURCES)) {
    const all = [];
    const used = [];
    const payloadHosts = new Set();
    for (const src of sources) {
      try {
        const domains = parseFeed(await fetchFeed(src), src.format);
        for (const d of domains) {
          all.push(d);
          if (src.payload) payloadHosts.add(d);
        }
        used.push({ ...src, entries: domains.length });
      } catch (err) {
        console.warn(`! skipped ${src.name}: ${err.message}`);
      }
    }
    if (!used.length) throw new Error(`No feeds available for ${kind}`);
    const filtered = all.filter((d) => !isProtected(d));
    const domains = collapse(filtered);
    const rules = kind === "ads" ? buildAdRules(domains) : buildMalwareRules(domains, payloadHosts);
    const parts = splitRules(rules);
    const files = [];
    for (const [i, part] of parts.entries()) {
      const name = parts.length === 1 ? `${kind}.json` : `${kind}-${i + 1}.json`;
      await writeFile(path.join(rulesDir, name), JSON.stringify(part));
      resources.push({ id: parts.length === 1 ? `nv_${kind}` : `nv_${kind}_${i + 1}`, enabled: true, path: `rules/${name}` });
      files.push(name);
    }
    summary.rulesets[kind] = { domains: domains.length, rules: rules.length, files, sources: used.map(({ name, url, license, entries }) => ({ name, url, license, entries })) };
    console.log(`✓ ${kind}: ${domains.length.toLocaleString()} domains → ${rules.length} rules in ${files.length} file(s)`);
  }
  await writeFile(path.join(rulesDir, "SOURCES.json"), JSON.stringify(summary, null, 2) + "\n");
  await updateManifest(resources);
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}` || process.argv[1]?.endsWith("update-blocklists.mjs")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
