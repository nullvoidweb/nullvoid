import { api, extensionUrl } from "../lib/browser.js";
import { call } from "../lib/messaging.js";
import { $, $$, h, icon, hydrateIcons, toast, copyText, initTheme, formatBytes } from "../lib/ui.js";
import { analyzeFile, decodeText } from "../lib/file-analysis.js";
import { digestHex, md5Hex } from "../lib/crypto.js";
import { takeHandoff } from "../lib/handoff.js";
import { DOMPurify, emailFrameDoc } from "../lib/sanitize.js";

const MAX_BYTES = 150 * 1024 * 1024;
const params = new URLSearchParams(location.search);
let current = null; // { name, type, bytes, blob, report, source }
let windowId = null;
let cleanCanvas = null;

const LEVEL_COLOR = { low: "var(--ok)", medium: "var(--warn)", high: "var(--danger)", critical: "var(--danger)" };

async function init() {
  await initTheme();
  hydrateIcons();
  windowId = (await api.windows.getCurrent())?.id ?? null;

  const input = $("#fileInput");
  const pick = () => input.click();
  $("#openBtn").addEventListener("click", pick);
  $("#dropPick").addEventListener("click", pick);
  input.addEventListener("change", () => input.files[0] && loadBlob(input.files[0], input.files[0].name, input.files[0].type));

  const drop = $("#drop");
  for (const ev of ["dragenter", "dragover"]) document.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("dragging"); });
  for (const ev of ["dragleave", "drop"]) document.addEventListener(ev, (e) => { e.preventDefault(); if (ev === "drop" || e.target === document.documentElement) drop.classList.remove("dragging"); });
  document.addEventListener("drop", (e) => {
    const f = e.dataTransfer?.files?.[0];
    if (f) loadBlob(f, f.name, f.type);
  });
  document.addEventListener("paste", (e) => {
    const f = [...(e.clipboardData?.files || [])][0];
    if (f) loadBlob(f, f.name || "pasted-file", f.type);
  });

  for (const tab of $$("#tabs .tab")) tab.addEventListener("click", () => selectTab(tab.dataset.tab));
  $("#checkHash").addEventListener("click", checkHash);
  $("#askAi").addEventListener("click", askAi);
  $("#exportReport").addEventListener("click", exportReport);
  $("#closeFile").addEventListener("click", closeFile);
  $("#cleanCopy").addEventListener("click", downloadCleanCopy);

  if (params.get("handoff")) {
    const item = await takeHandoff(params.get("handoff"));
    if (item) await loadBlob(item.blob, item.meta.name, item.meta.type, item.meta.source);
    else toast("That file is no longer available. Open it again from the inbox.", "warn");
  } else if (params.get("url")) {
    await loadFromUrl(params.get("url"));
  }
}

async function loadFromUrl(url) {
  if (!/^https?:\/\//i.test(url)) return toast("Only http(s) links can be analysed", "error");
  toast("Downloading the file into memory for analysis…", "info");
  try {
    const res = await fetch(url, { credentials: "omit", redirect: "follow", referrerPolicy: "no-referrer", cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const len = Number(res.headers.get("content-length"));
    if (len > MAX_BYTES) throw new Error(`File is larger than ${formatBytes(MAX_BYTES)}`);
    const blob = await res.blob();
    const name = decodeURIComponent(new URL(res.url).pathname.split("/").pop() || "download") ||
      res.headers.get("content-disposition")?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)/i)?.[1] || "download";
    await loadBlob(blob, name, res.headers.get("content-type")?.split(";")[0] || blob.type, url);
  } catch (err) {
    toast(`Could not download: ${err.message}`, "error");
  }
}

async function loadBlob(blob, name, type, source) {
  if (blob.size > MAX_BYTES) return toast(`Files up to ${formatBytes(MAX_BYTES)} can be analysed`, "error");
  $("#drop").hidden = true;
  $("#result").hidden = false;
  $("#verdict").replaceChildren(h("span", { class: "spinner" }), h("span", {}, ` Analysing ${name}…`));
  await new Promise((r) => setTimeout(r, 20));
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const report = analyzeFile({ name, type, bytes });
  report.source = source || "Local file";
  const [sha256, sha1] = await Promise.all([digestHex("SHA-256", bytes), digestHex("SHA-1", bytes)]);
  report.hashes = { sha256, sha1, md5: bytes.length <= 64 * 1024 * 1024 ? md5Hex(bytes) : null };
  current = { name, type, bytes, blob, report };
  cleanCanvas = null;
  renderReport();
  selectTab("preview");
  renderPreview().catch((err) => $("#pane-preview").replaceChildren(notice(`Preview failed: ${err.message}`)));
  renderStructure();
  renderStrings();
  renderHex(0);
  document.title = `${name} — NULL VOID File Viewer`;
}

function closeFile() {
  current = null;
  cleanCanvas = null;
  $("#result").hidden = true;
  $("#drop").hidden = false;
  for (const p of $$(".pane")) p.replaceChildren();
  $("#fileInput").value = "";
  document.title = "NULL VOID — Secure File Viewer";
}

function selectTab(name) {
  for (const t of $$("#tabs .tab")) t.setAttribute("aria-selected", String(t.dataset.tab === name));
  for (const p of $$(".pane")) p.hidden = p.id !== `pane-${name}`;
}

function notice(text, cls = "") {
  return h("div", { class: `notice ${cls}` }, icon(cls === "info" ? "info" : "shield-alert", "icon icon-sm"), h("span", {}, text));
}

// --- Report -----------------------------------------------------------------------------

function renderReport() {
  const r = current.report;
  const v = r.verdict;
  $("#verdict").replaceChildren(
    h("div", { class: "ring", style: { "--p": String(Math.max(3, v.score)), "--c": LEVEL_COLOR[v.level] } }, h("div", {}, String(v.score))),
    h("div", { class: "grow" },
      h("span", { class: `badge badge-${v.level}` }, v.level === "low" ? "Low risk" : v.level),
      h("h2", {}, v.label),
      h("div", { class: "name" }, r.name)),
  );

  const hashRow = (label, val) => val ? [h("dt", {}, label), h("dd", { class: "hash" }, h("code", { title: val }, val),
    h("button", { class: "icon-btn", title: `Copy ${label}`, "aria-label": `Copy ${label}`, onclick: () => copyText(val, `${label} copied`) }, icon("copy", "icon icon-sm")))] : [];
  const ent = r.entropy;
  const bars = h("div", { class: "entropy", title: `Entropy per block (${formatBytes(ent.blockSize)} blocks)` },
    ...ent.blocks.map((e) => h("span", { class: e > 7.2 ? "hot" : e > 6.5 ? "warm" : "", style: { height: `${Math.max(4, (e / 8) * 100)}%` }, title: e.toFixed(2) })));
  $("#facts").replaceChildren(
    h("h3", {}, "File"),
    h("dl", { class: "facts" },
      h("dt", {}, "Size"), h("dd", {}, `${formatBytes(r.size)} (${r.size.toLocaleString()} bytes)`),
      h("dt", {}, "Real type"), h("dd", {}, r.detected.label),
      h("dt", {}, "Declared"), h("dd", {}, `${r.declaredMime}${r.extension ? ` · .${r.extension}` : ""}`),
      h("dt", {}, "Source"), h("dd", {}, r.source),
      ...hashRow("SHA-256", r.hashes.sha256), ...hashRow("SHA-1", r.hashes.sha1), ...hashRow("MD5", r.hashes.md5),
      h("dt", {}, "Entropy"), h("dd", {}, `${ent.overall.toFixed(2)} bits/byte (max block ${ent.max.toFixed(2)})`)),
    bars,
  );

  $("#findingCount").textContent = `${r.findings.length} item${r.findings.length === 1 ? "" : "s"}`;
  $("#findings").replaceChildren(...(r.findings.length ? r.findings.map((f) => h("div", { class: "finding" },
    h("span", { class: `badge badge-${f.severity}` }, f.severity), h("strong", {}, f.title), f.detail ? h("span", { class: "detail" }, f.detail) : h("span"))) :
    [h("p", { class: "muted small" }, "No suspicious characteristics found. Static analysis can't prove a file is safe, so open files only from sources you trust.")]));

  const io = r.iocs;
  const groups = [["URLs", io.urls, true], ["IP addresses", io.ips], ["Domains", io.domains], ["E-mail addresses", io.emails]].filter(([, list]) => list.length);
  $("#iocCard").hidden = !groups.length;
  $("#iocs").replaceChildren(...groups.map(([title, list, isUrl]) => h("div", { class: "ioc-group" }, h("h4", {}, `${title} (${list.length})`),
    ...list.slice(0, 25).map((v) => h("div", { class: "ioc" }, h("span", { title: v }, v),
      isUrl ? h("a", { class: "icon-btn", href: `${extensionUrl("blocked/blocked.html")}?mode=link&url=${encodeURIComponent(v)}`, target: "_blank", rel: "noopener noreferrer", title: "Check link" }, icon("shield-check", "icon icon-sm")) : null,
      h("button", { class: "icon-btn", title: "Copy", onclick: () => copyText(v) }, icon("copy", "icon icon-sm")))))));
  $("#intel").replaceChildren("Look up this file's SHA-256 with your enabled services. Only the hash is sent.");
}

async function checkHash() {
  const btn = $("#checkHash");
  btn.disabled = true;
  try {
    const res = await call("intel:checkHash", { sha256: current.report.hashes.sha256 });
    if (!res.configured) {
      $("#intel").replaceChildren("No reputation services configured. ", h("a", { href: `${extensionUrl("options/options.html")}#intel`, target: "_blank" }, "Add a VirusTotal or abuse.ch key"), ".");
      return;
    }
    current.report.intel = res.results;
    $("#intel").replaceChildren(...res.results.map((r) => {
      if (r.service === "error") return h("div", {}, `Lookup failed: ${r.error}`);
      const verdict = r.malicious ? h("span", { class: "badge badge-dangerous" }, "Known malware")
        : r.known ? h("span", { class: "badge badge-safe" }, "Known, not flagged") : h("span", { class: "badge badge-info" }, "Never seen");
      const extra = r.stats ? `${r.stats.malicious || 0}/${r.engines} engines${r.label ? ` · ${r.label}` : ""}` : r.signature ? `${r.signature}${r.tags?.length ? ` · ${r.tags.join(", ")}` : ""}` : "";
      return h("div", { class: "row-between", style: { padding: "4px 0" } },
        h("div", {}, h("strong", { style: { color: "var(--text)" } }, r.service), extra ? h("div", { class: "tiny" }, extra) : null,
          r.link ? h("a", { href: r.link, target: "_blank", rel: "noopener noreferrer", class: "tiny" }, "Open report") : null), verdict);
    }));
  } catch (err) {
    toast(err.message, "error");
  } finally {
    btn.disabled = false;
  }
}

function askAi() {
  if (!current) return;
  const { strings, ...rest } = current.report;
  api.storage.session.set({ "nv.pendingAiPrompt": { kind: "file", report: { ...rest, strings: strings.slice(0, 80) }, ts: Date.now() } });
  if (api.sidePanel?.open && windowId != null) {
    api.sidePanel.open({ windowId }).catch(() => api.tabs.create({ url: extensionUrl("assistant/assistant.html") }));
  } else {
    api.tabs.create({ url: extensionUrl("assistant/assistant.html") });
  }
}

function exportReport() {
  const { report } = current;
  const blob = new Blob([JSON.stringify({ ...report, strings: report.strings.slice(0, 500), generatedBy: `NULL VOID ${api.runtime.getManifest().version}`, generatedAt: new Date().toISOString() }, null, 2)], { type: "application/json" });
  const a = h("a", { href: URL.createObjectURL(blob), download: `${report.name}.nullvoid-report.json` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// --- Preview ---------------------------------------------------------------------------

async function renderPreview() {
  const pane = $("#pane-preview");
  const { report, bytes, blob } = current;
  const t = report.detected.type;
  const cat = report.detected.category;
  $("#cleanCopy").hidden = true;

  if (cat === "executable" || ["lnk", "chm", "iso", "ole", "rtf", "onenote"].includes(t)) {
    pane.replaceChildren(notice("Preview is disabled for executable and container formats. Use the Structure, Strings and Hex tabs to inspect them safely."));
    return;
  }
  if (["png", "jpeg", "gif", "webp", "bmp", "ico", "heif", "tiff"].includes(t)) return previewImage(pane, blob, t);
  if (t === "svg") return previewSvg(pane, bytes);
  if (t === "pdf") return previewPdf(pane, bytes);
  if (t === "zip") {
    const kind = report.details.zip?.kind;
    if (["docx", "pptx", "xlsx", "odf"].includes(kind)) return previewOffice(pane, bytes, kind);
    pane.replaceChildren(notice("Archive contents are listed in the Structure tab. Nothing is extracted to disk.", "info"));
    return;
  }
  if (["mp4", "webm", "ogg", "mp3", "wav", "flac", "m4a"].includes(t)) {
    const url = URL.createObjectURL(new Blob([bytes], { type: report.detected.mime }));
    const el = cat === "video" ? h("video", { src: url, controls: true, preload: "metadata" }) : h("audio", { src: url, controls: true, preload: "metadata" });
    pane.replaceChildren(h("div", { class: "media-wrap" }, el));
    return;
  }
  if (t === "html") return previewHtml(pane, bytes);
  if (t === "json") {
    const text = decodeText(bytes.subarray(0, 4 << 20));
    let pretty = text;
    try {
      pretty = JSON.stringify(JSON.parse(text), null, 2);
    } catch { /* show raw */ }
    pane.replaceChildren(h("pre", { class: "code" }, pretty));
    return;
  }
  if (["text", "xml", "script"].includes(t) || cat === "text") {
    const text = decodeText(bytes.subarray(0, 4 << 20));
    if (/\.(csv|tsv)$/i.test(report.name)) return previewCsv(pane, text, /\.tsv$/i.test(report.name) ? "\t" : ",");
    pane.replaceChildren(...(bytes.length > 4 << 20 ? [notice("Showing the first 4 MB.", "info")] : []), h("pre", { class: "code" }, text));
    return;
  }
  pane.replaceChildren(notice("No safe preview is available for this file type. See the Hex and Strings tabs.", "info"));
}

async function previewImage(pane, blob, type) {
  // Re-rendering through a canvas drops embedded metadata and any appended payload.
  let bitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    pane.replaceChildren(notice(`The ${type.toUpperCase()} image could not be decoded (corrupt or malformed). Malformed images are sometimes used to exploit viewers.`));
    return;
  }
  const canvas = h("canvas", { class: "preview-canvas", width: bitmap.width, height: bitmap.height });
  canvas.getContext("2d").drawImage(bitmap, 0, 0);
  cleanCanvas = canvas;
  $("#cleanCopy").hidden = false;
  const exif = current.report.details.exif;
  const meta = exif && Object.keys(exif).length ? h("div", { class: "notice info" }, icon("info", "icon icon-sm"),
    h("span", {}, `Embedded metadata: ${Object.entries(exif).map(([k, v]) => `${k}: ${v}`).join(" · ")}. “Clean copy” saves the image without it.`)) : null;
  pane.replaceChildren(...[meta, h("p", { class: "tiny muted center" }, `${bitmap.width} × ${bitmap.height}px, re-rendered safely`), canvas].filter(Boolean));
}

async function previewSvg(pane, bytes) {
  // SVG loaded as an <img> cannot run scripts or load external resources.
  const url = URL.createObjectURL(new Blob([bytes], { type: "image/svg+xml" }));
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
    const w = img.naturalWidth || 800, hgt = img.naturalHeight || 600;
    const canvas = h("canvas", { class: "preview-canvas", width: w, height: hgt });
    canvas.getContext("2d").drawImage(img, 0, 0, w, hgt);
    cleanCanvas = canvas;
    $("#cleanCopy").hidden = false;
    pane.replaceChildren(notice("SVG files can contain scripts. It was rasterised with scripting disabled. The source is in the Strings tab.", "info"), canvas);
  } catch {
    pane.replaceChildren(notice("This SVG could not be rendered safely."), h("pre", { class: "code" }, decodeText(bytes.subarray(0, 1 << 20))));
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function previewPdf(pane, bytes) {
  pane.replaceChildren(h("p", { class: "muted small" }, h("span", { class: "spinner" }), " Rendering PDF with scripting disabled…"));
  const pdfjs = await import("../vendor/pdfjs/pdf.min.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = extensionUrl("vendor/pdfjs/pdf.worker.min.mjs");
  const doc = await pdfjs.getDocument({
    data: bytes.slice(),
    isEvalSupported: false,
    enableXfa: false,
    stopAtErrors: false,
    cMapUrl: extensionUrl("vendor/pdfjs/cmaps/"),
    cMapPacked: true,
    standardFontDataUrl: extensionUrl("vendor/pdfjs/standard_fonts/"),
    wasmUrl: extensionUrl("vendor/pdfjs/wasm/"),
    iccUrl: extensionUrl("vendor/pdfjs/iccs/"),
  }).promise;
  let info = {};
  try {
    info = (await doc.getMetadata())?.info || {};
  } catch { /* none */ }
  const metaBits = ["Title", "Author", "Creator", "Producer", "CreationDate"].filter((k) => info[k]).map((k) => `${k}: ${info[k]}`);
  pane.replaceChildren(h("p", { class: "tiny muted" }, `${doc.numPages} page${doc.numPages === 1 ? "" : "s"}${metaBits.length ? ` · ${metaBits.join(" · ")}` : ""}. Links and embedded scripts are inactive in this preview.`));
  const width = Math.min(pane.clientWidth - 32, 900);
  let next = 1;
  const renderMore = async (count) => {
    const end = Math.min(doc.numPages, next + count - 1);
    for (; next <= end; next++) {
      const page = await doc.getPage(next);
      const base = page.getViewport({ scale: 1 });
      const scale = Math.max(0.5, Math.min(2.5, width / base.width)) * (window.devicePixelRatio || 1);
      const vp = page.getViewport({ scale });
      const canvas = h("canvas", { class: "pdf-page", width: Math.floor(vp.width), height: Math.floor(vp.height) });
      canvas.style.width = `${Math.floor(vp.width / (window.devicePixelRatio || 1))}px`;
      pane.appendChild(canvas);
      await page.render({ canvas, canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
    }
    moreBtn.hidden = next > doc.numPages;
    pane.appendChild(moreBtn);
  };
  const moreBtn = h("button", { class: "btn btn-block", onclick: () => renderMore(10) }, "Render more pages");
  await renderMore(5);
}

async function previewOffice(pane, bytes, kind) {
  const { unzipSync, strFromU8 } = await import("../vendor/fflate.mjs");
  const wanted = (name) => (kind === "docx" && name === "word/document.xml") ||
    (kind === "pptx" && /^ppt\/slides\/slide\d+\.xml$/.test(name)) ||
    (kind === "xlsx" && (name === "xl/sharedStrings.xml" || /^xl\/worksheets\/sheet1\.xml$/.test(name))) ||
    (kind === "odf" && name === "content.xml");
  const files = unzipSync(bytes, { filter: (f) => wanted(f.name) && f.originalSize < 64 * 1024 * 1024 });
  const parse = (name) => new DOMParser().parseFromString(strFromU8(files[name]), "application/xml");
  const wrap = h("div", { class: "doc-text" });
  if (kind === "docx" && files["word/document.xml"]) {
    for (const p of parse("word/document.xml").getElementsByTagNameNS("*", "p")) {
      const text = [...p.getElementsByTagNameNS("*", "t")].map((t) => t.textContent).join("");
      if (text.trim()) wrap.appendChild(h("p", {}, text));
    }
  } else if (kind === "pptx") {
    const slides = Object.keys(files).sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
    slides.forEach((name, i) => {
      wrap.appendChild(h("h4", {}, `Slide ${i + 1}`));
      for (const p of parse(name).getElementsByTagNameNS("*", "p")) {
        const text = [...p.getElementsByTagNameNS("*", "t")].map((t) => t.textContent).join("");
        if (text.trim()) wrap.appendChild(h("p", {}, text));
      }
    });
  } else if (kind === "xlsx" && files["xl/worksheets/sheet1.xml"]) {
    const shared = files["xl/sharedStrings.xml"] ? [...parse("xl/sharedStrings.xml").getElementsByTagNameNS("*", "si")].map((si) => si.textContent) : [];
    const rows = [...parse("xl/worksheets/sheet1.xml").getElementsByTagNameNS("*", "row")].slice(0, 500);
    const table = h("table", { class: "data" }, h("tbody", {}, ...rows.map((row) => h("tr", {}, ...[...row.getElementsByTagNameNS("*", "c")].slice(0, 40).map((c) => {
      const v = c.getElementsByTagNameNS("*", "v")[0]?.textContent ?? c.textContent;
      return h("td", {}, c.getAttribute("t") === "s" ? shared[Number(v)] ?? "" : v);
    })))));
    wrap.append(h("p", { class: "tiny muted" }, "First worksheet, first 500 rows. Formulas and macros are not evaluated."), table);
  } else if (kind === "odf" && files["content.xml"]) {
    for (const p of parse("content.xml").getElementsByTagNameNS("*", "p")) if (p.textContent.trim()) wrap.appendChild(h("p", {}, p.textContent));
  }
  if (!wrap.childNodes.length) wrap.appendChild(h("p", { class: "muted" }, "No readable text found."));
  pane.replaceChildren(notice("Text-only view: macros, embedded objects and external links are never executed or loaded.", "info"), wrap);
}

function previewHtml(pane, bytes) {
  const text = decodeText(bytes.subarray(0, 2 << 20));
  const frame = h("iframe", { class: "sandbox-frame", sandbox: "", referrerpolicy: "no-referrer", title: "Sanitized HTML preview" });
  const showRendered = () => {
    const clean = DOMPurify.sanitize(text, { FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "base", "meta", "link"], FORBID_ATTR: ["action", "formaction"] });
    frame.srcdoc = emailFrameDoc(clean, { allowRemote: false });
    pane.replaceChildren(notice("Rendered with scripts, forms and remote resources removed.", "info"), toggle, frame);
  };
  const showSource = () => pane.replaceChildren(toggle, h("pre", { class: "code" }, text));
  let rendered = false;
  const toggle = h("button", { class: "btn btn-sm", style: { marginBottom: "10px" }, onclick: () => { rendered = !rendered; toggle.textContent = rendered ? "Show source" : "Render safely"; rendered ? showRendered() : showSource(); } }, "Render safely");
  showSource();
}

function previewCsv(pane, text, sep) {
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < text.length && rows.length < 1000; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c;
    } else if (c === '"') q = true;
    else if (c === sep) { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head = [], ...body] = rows;
  pane.replaceChildren(h("p", { class: "tiny muted" }, `${rows.length >= 1000 ? "First 1000" : rows.length} rows. Spreadsheet formulas (=…) are shown as text, never evaluated.`),
    h("table", { class: "data" }, h("thead", {}, h("tr", {}, ...head.map((c) => h("th", {}, c)))), h("tbody", {}, ...body.map((r) => h("tr", {}, ...r.map((c) => h("td", { title: c }, c)))))));
}

function downloadCleanCopy() {
  if (!cleanCanvas) return;
  cleanCanvas.toBlob((blob) => {
    const a = h("a", { href: URL.createObjectURL(blob), download: current.name.replace(/\.[^.]+$/, "") + ".clean.png" });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    toast("Saved a clean PNG without metadata", "success");
  }, "image/png");
}

// --- Structure / strings / hex ------------------------------------------------------------

function renderStructure() {
  const pane = $("#pane-structure");
  const d = current.report.details;
  const parts = [];
  if (d.pe?.valid) {
    parts.push(h("h3", {}, "PE header"), h("dl", { class: "facts" },
      ...[["Machine", d.pe.machine], ["Kind", d.pe.isDll ? "DLL" : "Executable"], ["Subsystem", d.pe.subsystem], ["Compiled", d.pe.compiled || "n/a"],
        ["ASLR / DEP", `${d.pe.aslr ? "on" : "off"} / ${d.pe.dep ? "on" : "off"}`], ["Overlay", formatBytes(d.pe.overlayBytes)]].flatMap(([k, v]) => [h("dt", {}, k), h("dd", {}, v)])),
    h("h3", { style: { marginTop: "16px" } }, "Sections"),
    table(["Name", "Raw size", "Virtual size", "Entropy", "Flags"], d.pe.sections.map((s) => [s.name || "(none)", formatBytes(s.rawSize), formatBytes(s.virtualSize), s.entropy.toFixed(2), `${s.executable ? "X" : ""}${s.writable ? "W" : ""}`])));
  }
  if (d.elf) parts.push(h("h3", {}, "ELF header"), h("dl", { class: "facts" }, ...Object.entries(d.elf).flatMap(([k, v]) => [h("dt", {}, k), h("dd", {}, String(v))])));
  if (d.zip) {
    parts.push(h("h3", {}, `${d.zip.label} — ${d.zip.total} entr${d.zip.total === 1 ? "y" : "ies"}`),
      table(["Name", "Size", "Compressed", "Encrypted"], d.zip.entries.map((e) => [e.name, formatBytes(e.size), formatBytes(e.compressedSize), e.encrypted ? "yes" : ""])));
  }
  if (d.pdf) {
    parts.push(h("h3", {}, `PDF ${d.pdf.version || ""}`), h("p", { class: "small muted" }, `${d.pdf.pages} page objects · ${d.pdf.incrementalUpdates} incremental update(s)`),
      table(["Keyword", "Count"], Object.entries(d.pdf.counts).map(([k, v]) => [k, String(v)])));
  }
  if (d.ole) parts.push(h("h3", {}, "OLE compound file"), h("p", {}, d.ole.kinds.join(", ") || "Unknown streams"));
  if (d.exif) parts.push(h("h3", {}, "EXIF metadata"), h("dl", { class: "facts" }, ...Object.entries(d.exif).flatMap(([k, v]) => [h("dt", {}, k), h("dd", {}, v)])));
  pane.replaceChildren(...(parts.length ? parts : [h("p", { class: "muted" }, "No structured data for this format.")]));
}

function table(headers, rows) {
  return h("table", { class: "data" }, h("thead", {}, h("tr", {}, ...headers.map((x) => h("th", {}, x)))), h("tbody", {}, ...rows.map((r) => h("tr", {}, ...r.map((c) => h("td", { title: c }, c))))));
}

function renderStrings() {
  const s = current.report.strings;
  $("#pane-strings").replaceChildren(
    h("p", { class: "tiny muted" }, `${s.length} printable string${s.length === 1 ? "" : "s"} (ASCII and UTF-16, at least 6 characters).`),
    h("pre", { class: "code" }, s.join("\n")),
  );
}

function renderHex(offset) {
  const pane = $("#pane-hex");
  const { bytes } = current;
  const CHUNK = 64 * 1024;
  const end = Math.min(bytes.length, offset + CHUNK);
  const lines = [];
  for (let i = offset; i < end; i += 16) {
    const slice = bytes.subarray(i, Math.min(i + 16, end));
    const hex = [...slice].map((b) => b.toString(16).padStart(2, "0")).join(" ").padEnd(47, " ");
    const asc = [...slice].map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : ".")).join("");
    lines.push(`${i.toString(16).padStart(8, "0")}  ${hex}  ${asc}`);
  }
  const pre = h("pre", { class: "hexdump" }, lines.join("\n"));
  const nav = h("div", { class: "row", style: { marginBottom: "10px" } },
    h("button", { class: "btn btn-sm", disabled: offset === 0, onclick: () => renderHex(Math.max(0, offset - CHUNK)) }, icon("arrow-left", "icon icon-sm"), "Previous"),
    h("span", { class: "small muted" }, `0x${offset.toString(16)} – 0x${end.toString(16)} of ${formatBytes(bytes.length)}`),
    h("button", { class: "btn btn-sm", disabled: end >= bytes.length, onclick: () => renderHex(end) }, "Next", icon("arrow-right", "icon icon-sm")));
  pane.replaceChildren(nav, pre);
}

init().catch((err) => {
  console.error(err);
  toast(err.message, "error");
});
