// Static file triage that runs entirely on-device. Nothing here executes or
// renders the file: we only read bytes. The checks mirror what malware analysts
// do first with an unknown sample — true-type identification by magic bytes,
// extension tricks, entropy (packing/encryption), PE/ELF/Mach-O headers,
// pdfid-style PDF keyword counts, Office macro and OLE object detection, ZIP
// directory inspection (without decompression), and IOC extraction.

export const SEVERITY_WEIGHT = { info: 0, low: 5, medium: 15, high: 35, critical: 60 };

export const DANGEROUS_EXTENSIONS = new Set([
  "exe", "scr", "com", "pif", "bat", "cmd", "msi", "msp", "mst", "ps1", "psm1", "psd1", "vbs", "vbe",
  "js", "jse", "wsf", "wsh", "hta", "cpl", "jar", "lnk", "reg", "dll", "sys", "iso", "img", "vhd", "vhdx",
  "appx", "appxbundle", "msix", "msixbundle", "apk", "app", "dmg", "pkg", "sh", "command", "scf", "url",
  "inf", "chm", "xll", "gadget", "application", "settingcontent-ms", "library-ms", "one", "wsc", "sct",
]);
export const MACRO_EXTENSIONS = new Set(["docm", "dotm", "xlsm", "xltm", "xlam", "pptm", "potm", "ppam", "sldm"]);
const ARCHIVE_EXTENSIONS = new Set(["zip", "rar", "7z", "gz", "tgz", "bz2", "xz", "cab", "tar", "ace", "arj"]);

const ascii = (bytes, start, len) => {
  let s = "";
  for (let i = start; i < Math.min(bytes.length, start + len); i++) s += String.fromCharCode(bytes[i]);
  return s;
};
const startsWith = (bytes, sig, offset = 0) => sig.every((b, i) => bytes[offset + i] === b);

/** Identify the real file type from its leading bytes. */
export function detectType(bytes) {
  const b = bytes;
  const t = (type, mime, label, category) => ({ type, mime, label, category });
  if (b.length < 4) return t("empty", "application/octet-stream", b.length ? "Tiny file" : "Empty file", "unknown");
  if (startsWith(b, [0x4d, 0x5a])) return t("pe", "application/vnd.microsoft.portable-executable", "Windows executable (PE)", "executable");
  if (startsWith(b, [0x7f, 0x45, 0x4c, 0x46])) return t("elf", "application/x-elf", "Linux/Unix executable (ELF)", "executable");
  const m32 = (b[0] << 24 | b[1] << 16 | b[2] << 8 | b[3]) >>> 0;
  if ([0xfeedface, 0xfeedfacf, 0xcefaedfe, 0xcffaedfe].includes(m32)) return t("macho", "application/x-mach-binary", "macOS executable (Mach-O)", "executable");
  if (m32 === 0xcafebabe) return b[7] > 40 ? t("java-class", "application/java-vm", "Java class file", "executable") : t("macho", "application/x-mach-binary", "macOS universal binary", "executable");
  if (startsWith(b, [0x00, 0x61, 0x73, 0x6d])) return t("wasm", "application/wasm", "WebAssembly module", "executable");
  if (startsWith(b, [0x64, 0x65, 0x78, 0x0a])) return t("dex", "application/vnd.android.dex", "Android DEX bytecode", "executable");
  if (startsWith(b, [0x4c, 0x00, 0x00, 0x00, 0x01, 0x14, 0x02, 0x00])) return t("lnk", "application/x-ms-shortcut", "Windows shortcut (LNK)", "executable");
  if (startsWith(b, [0x25, 0x50, 0x44, 0x46])) return t("pdf", "application/pdf", "PDF document", "document");
  if (startsWith(b, [0x50, 0x4b, 0x03, 0x04]) || startsWith(b, [0x50, 0x4b, 0x05, 0x06])) return t("zip", "application/zip", "ZIP container", "archive");
  if (startsWith(b, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return t("ole", "application/x-ole-storage", "OLE compound file (legacy Office / MSI)", "document");
  if (startsWith(b, [0x7b, 0x5c, 0x72, 0x74, 0x66])) return t("rtf", "application/rtf", "Rich Text Format", "document");
  if (startsWith(b, [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07])) return t("rar", "application/vnd.rar", "RAR archive", "archive");
  if (startsWith(b, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c])) return t("7z", "application/x-7z-compressed", "7-Zip archive", "archive");
  if (startsWith(b, [0x1f, 0x8b])) return t("gzip", "application/gzip", "GZIP archive", "archive");
  if (startsWith(b, [0x42, 0x5a, 0x68])) return t("bzip2", "application/x-bzip2", "BZIP2 archive", "archive");
  if (startsWith(b, [0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00])) return t("xz", "application/x-xz", "XZ archive", "archive");
  if (startsWith(b, [0x4d, 0x53, 0x43, 0x46])) return t("cab", "application/vnd.ms-cab-compressed", "Cabinet archive", "archive");
  if (startsWith(b, [0x49, 0x54, 0x53, 0x46])) return t("chm", "application/vnd.ms-htmlhelp", "Compiled HTML Help (CHM)", "executable");
  if (b.length > 0x8006 && ascii(b, 0x8001, 5) === "CD001") return t("iso", "application/x-iso9660-image", "ISO disk image", "archive");
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47])) return t("png", "image/png", "PNG image", "image");
  if (startsWith(b, [0xff, 0xd8, 0xff])) return t("jpeg", "image/jpeg", "JPEG image", "image");
  if (ascii(b, 0, 4) === "GIF8") return t("gif", "image/gif", "GIF image", "image");
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") return t("webp", "image/webp", "WebP image", "image");
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WAVE") return t("wav", "audio/wav", "WAV audio", "audio");
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "AVI ") return t("avi", "video/x-msvideo", "AVI video", "video");
  if (ascii(b, 0, 2) === "BM") return t("bmp", "image/bmp", "BMP image", "image");
  if (startsWith(b, [0x00, 0x00, 0x01, 0x00])) return t("ico", "image/x-icon", "Icon", "image");
  if (startsWith(b, [0x49, 0x49, 0x2a, 0x00]) || startsWith(b, [0x4d, 0x4d, 0x00, 0x2a])) return t("tiff", "image/tiff", "TIFF image", "image");
  if (ascii(b, 4, 4) === "ftyp") {
    const brand = ascii(b, 8, 4);
    if (/^(heic|heix|mif1|msf1|avif)/.test(brand)) return t("heif", brand === "avif" ? "image/avif" : "image/heic", "HEIF/AVIF image", "image");
    if (/^(M4A |M4B )/.test(brand)) return t("m4a", "audio/mp4", "MPEG-4 audio", "audio");
    return t("mp4", "video/mp4", "MPEG-4 video", "video");
  }
  if (startsWith(b, [0x1a, 0x45, 0xdf, 0xa3])) return t("webm", "video/webm", "WebM / Matroska video", "video");
  if (ascii(b, 0, 4) === "OggS") return t("ogg", "audio/ogg", "Ogg media", "audio");
  if (ascii(b, 0, 3) === "ID3" || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return t("mp3", "audio/mpeg", "MP3 audio", "audio");
  if (ascii(b, 0, 4) === "fLaC") return t("flac", "audio/flac", "FLAC audio", "audio");
  if (ascii(b, 0, 16) === "SQLite format 3\0") return t("sqlite", "application/vnd.sqlite3", "SQLite database", "data");
  if (startsWith(b, [0xe4, 0x52, 0x5c, 0x7b, 0x8c, 0xd8, 0xa7, 0x4d])) return t("onenote", "application/onenote", "OneNote section", "document");

  // Text-ish formats: sniff the first few KB.
  const head = decodeText(b.subarray(0, 4096)).replace(/^\uFEFF/, "");
  const trimmed = head.trimStart();
  if (/^#!/.test(trimmed)) return t("script", "text/x-shellscript", "Script with shebang", "script");
  if (/^<\?xml[\s\S]{0,300}<svg/i.test(trimmed) || /^<svg[\s>]/i.test(trimmed)) return t("svg", "image/svg+xml", "SVG image (XML, may contain script)", "image");
  if (/^(<!doctype html|<html|<head|<body|<script|<meta|<iframe)/i.test(trimmed)) return t("html", "text/html", "HTML document", "web");
  if (/^<\?xml/.test(trimmed)) return t("xml", "application/xml", "XML document", "text");
  if (/^[[{]/.test(trimmed) && looksJson(head)) return t("json", "application/json", "JSON data", "text");
  if (isMostlyText(b.subarray(0, 8192))) return t("text", "text/plain", "Plain text", "text");
  return t("binary", "application/octet-stream", "Unknown binary data", "unknown");
}

function looksJson(s) {
  try {
    JSON.parse(s);
    return true;
  } catch {
    return /^\s*[[{]\s*["{[\]0-9tfn-]/.test(s);
  }
}

export function decodeText(bytes) {
  try {
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  } catch {
    return ascii(bytes, 0, bytes.length);
  }
}

export function isMostlyText(bytes) {
  if (!bytes.length) return true;
  let printable = 0;
  for (const c of bytes) {
    if (c === 9 || c === 10 || c === 13 || (c >= 32 && c < 127) || c >= 0x80) printable++;
    else if (c === 0) return false;
  }
  return printable / bytes.length > 0.95;
}

/** Shannon entropy in bits/byte (0–8). */
export function byteEntropy(bytes) {
  if (!bytes.length) return 0;
  const freq = new Uint32Array(256);
  for (const b of bytes) freq[b]++;
  let h = 0;
  for (const c of freq) {
    if (!c) continue;
    const p = c / bytes.length;
    h -= p * Math.log2(p);
  }
  return h;
}

export function entropyProfile(bytes, blocks = 64) {
  const size = Math.max(256, Math.ceil(bytes.length / blocks));
  const out = [];
  for (let i = 0; i < bytes.length; i += size) out.push(+byteEntropy(bytes.subarray(i, i + size)).toFixed(3));
  return { overall: +byteEntropy(bytes).toFixed(3), max: Math.max(0, ...out), blocks: out, blockSize: size };
}

// --- Filename tricks ---------------------------------------------------------
export function analyzeName(name) {
  const findings = [];
  const add = (id, severity, title, detail) => findings.push({ id, severity, title, detail });
  const clean = String(name || "");
  if (/[\u202A-\u202E\u2066-\u2069\u200E\u200F]/.test(clean)) {
    add("bidi-override", "critical", "Unicode direction override in file name",
      "The name contains right-to-left override characters, which make e.g. 'invoice[RLO]fdp.exe' display as 'invoiceexe.pdf'.");
  }
  const parts = clean.toLowerCase().split(".");
  const ext = parts.length > 1 ? parts.pop().trim() : "";
  const prev = parts.length > 1 ? parts[parts.length - 1].trim() : "";
  const docLike = /^(pdf|docx?|xlsx?|pptx?|txt|jpe?g|png|gif|mp4|mp3|csv|rtf|zip|html?)$/;
  if (prev && docLike.test(prev) && (DANGEROUS_EXTENSIONS.has(ext) || ext === "html" || ext === "htm")) {
    add("double-extension", "critical", "Deceptive double extension", `"${clean}" pretends to be .${prev} but is really .${ext}.`);
  }
  if (/\s{3,}\.[a-z0-9]{2,5}$/i.test(clean)) {
    add("padded-name", "high", "Whitespace-padded file name", "Long runs of spaces push the real extension out of view.");
  }
  if (DANGEROUS_EXTENSIONS.has(ext)) add("dangerous-extension", "high", `Executable file type (.${ext})`, "Opening this type can run code on your computer.");
  else if (MACRO_EXTENSIONS.has(ext)) add("macro-extension", "high", `Macro-enabled Office file (.${ext})`, "Macro-enabled documents are a top malware delivery vector.");
  else if (ext === "html" || ext === "htm" || ext === "svg" || ext === "shtml") {
    add("web-attachment", "medium", `Web file attachment (.${ext})`, "HTML/SVG attachments are widely used for credential phishing and HTML smuggling.");
  }
  if (clean.length > 150) add("long-name", "low", "Unusually long file name", `${clean.length} characters.`);
  return { ext, findings };
}

// --- ZIP central directory (no decompression) -------------------------------
export function parseZipEntries(bytes, limit = 5000) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) return { entries: [], error: "End of central directory not found (truncated or not a ZIP)" };
  const total = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const zip64 = offset === 0xffffffff || total === 0xffff;
  const entries = [];
  for (let n = 0; n < total && n < limit; n++) {
    if (offset + 46 > bytes.length || view.getUint32(offset, true) !== 0x02014b50) break;
    const flags = view.getUint16(offset + 8, true);
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const size = view.getUint32(offset + 24, true);
    const nameLen = view.getUint16(offset + 28, true);
    const extraLen = view.getUint16(offset + 30, true);
    const commentLen = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const nameBytes = bytes.subarray(offset + 46, offset + 46 + nameLen);
    const name = (flags & 0x800) ? new TextDecoder().decode(nameBytes) : ascii(nameBytes, 0, nameBytes.length);
    entries.push({ name, method, compressedSize, size, encrypted: Boolean(flags & 1), localOffset });
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return { entries, total, zip64, truncated: total > entries.length };
}

/** Classify a ZIP container (OOXML, ODF, JAR, APK, plain archive). */
export function classifyZip(entries) {
  const names = new Set(entries.map((e) => e.name));
  const has = (p) => entries.some((e) => e.name.startsWith(p));
  if (names.has("[Content_Types].xml")) {
    if (has("word/")) return { kind: "docx", label: "Word document (OOXML)" };
    if (has("xl/")) return { kind: "xlsx", label: "Excel workbook (OOXML)" };
    if (has("ppt/")) return { kind: "pptx", label: "PowerPoint presentation (OOXML)" };
    if (has("visio/")) return { kind: "vsdx", label: "Visio drawing (OOXML)" };
    return { kind: "ooxml", label: "Office Open XML package" };
  }
  if (names.has("mimetype") && has("META-INF/manifest.xml")) return { kind: "odf", label: "OpenDocument file" };
  if (names.has("AndroidManifest.xml") && has("classes")) return { kind: "apk", label: "Android application (APK)" };
  if (names.has("META-INF/MANIFEST.MF") || entries.some((e) => e.name.endsWith(".class"))) return { kind: "jar", label: "Java archive (JAR)" };
  if (names.has("AppxManifest.xml")) return { kind: "msix", label: "Windows app package (MSIX/APPX)" };
  if (names.has("manifest.json") && entries.some((e) => /\.(js)$/.test(e.name))) return { kind: "crx-like", label: "Browser extension package" };
  return { kind: "zip", label: "ZIP archive" };
}

function analyzeZip(bytes, report) {
  const zip = parseZipEntries(bytes);
  const cls = classifyZip(zip.entries);
  const add = report.add;
  report.details.zip = { ...cls, total: zip.total ?? zip.entries.length, entries: zip.entries.slice(0, 500), zip64: zip.zip64, error: zip.error };
  report.detected.label = cls.label;
  if (zip.error) add("zip-corrupt", "medium", "Malformed ZIP structure", zip.error);
  let totalSize = 0, totalCompressed = 0;
  for (const e of zip.entries) {
    totalSize += e.size;
    totalCompressed += e.compressedSize;
    const lower = e.name.toLowerCase();
    const ext = lower.includes(".") ? lower.split(".").pop() : "";
    if (lower.includes("../") || lower.startsWith("/") || /^[a-z]:/i.test(lower)) add("zip-slip", "high", "Path traversal entry", `Entry "${e.name}" escapes the extraction folder (Zip Slip).`);
    if (/vbaproject\.bin$/i.test(lower)) add("vba-macros", "high", "Contains VBA macros", `${e.name} — macros run code when enabled in Office.`);
    if (/\/embeddings\/.*\.(bin|exe|ole)/i.test(lower) || /oleobject\d*\.bin$/i.test(lower)) add("ole-embedding", "medium", "Embedded OLE object", e.name);
    if (/activex/i.test(lower)) add("activex", "medium", "ActiveX controls present", e.name);
    if (/externallink/i.test(lower)) add("external-link", "low", "External workbook links", e.name);
    if (cls.kind === "zip" && DANGEROUS_EXTENSIONS.has(ext)) add("archived-executable", "high", "Executable inside archive", `${e.name} (.${ext})`);
    if (cls.kind === "zip" && ARCHIVE_EXTENSIONS.has(ext)) add("nested-archive", "low", "Nested archive", e.name);
    if (e.encrypted) report.flags.encryptedEntries = (report.flags.encryptedEntries || 0) + 1;
  }
  if (report.flags.encryptedEntries) {
    add("encrypted-archive", "medium", "Password-protected entries", `${report.flags.encryptedEntries} encrypted entries — a common trick to evade e-mail scanners.`);
  }
  if (totalCompressed > 0 && totalSize / totalCompressed > 100 && totalSize > 100 * 1024 * 1024) {
    add("zip-bomb", "high", "Possible decompression bomb", `Expands ${Math.round(totalSize / totalCompressed)}× to ${(totalSize / 1048576).toFixed(0)} MB.`);
  }
  if (cls.kind === "apk" || cls.kind === "jar" || cls.kind === "msix") add("app-package", "high", `${cls.label}`, "Installing this package runs third-party code.");
  return cls;
}

// --- PE ----------------------------------------------------------------------
const PE_MACHINES = { 0x14c: "x86", 0x8664: "x64", 0xaa64: "ARM64", 0x1c0: "ARM", 0x1c4: "ARMv7", 0x200: "IA-64" };
const PE_SUBSYSTEMS = { 1: "Native", 2: "Windows GUI", 3: "Windows console", 9: "Windows CE", 10: "EFI application", 14: "Xbox", 16: "Boot application" };

export function parsePE(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 0x40) return null;
  const peOff = view.getUint32(0x3c, true);
  if (peOff + 24 > bytes.length || view.getUint32(peOff, true) !== 0x00004550) return { valid: false };
  const machine = view.getUint16(peOff + 4, true);
  const nSections = view.getUint16(peOff + 6, true);
  const timestamp = view.getUint32(peOff + 8, true);
  const optSize = view.getUint16(peOff + 20, true);
  const characteristics = view.getUint16(peOff + 22, true);
  const opt = peOff + 24;
  const magic = opt + 2 <= bytes.length ? view.getUint16(opt, true) : 0;
  const is64 = magic === 0x20b;
  const subsystem = opt + 70 <= bytes.length ? view.getUint16(opt + 68, true) : 0;
  const dllChars = opt + 72 <= bytes.length ? view.getUint16(opt + 70, true) : 0;
  const sections = [];
  let secOff = opt + optSize;
  for (let i = 0; i < Math.min(nSections, 96) && secOff + 40 <= bytes.length; i++, secOff += 40) {
    const name = ascii(bytes, secOff, 8).replace(/\0+$/, "");
    const vsize = view.getUint32(secOff + 8, true);
    const rawSize = view.getUint32(secOff + 16, true);
    const rawPtr = view.getUint32(secOff + 20, true);
    const chars = view.getUint32(secOff + 36, true);
    const data = bytes.subarray(rawPtr, Math.min(bytes.length, rawPtr + rawSize));
    sections.push({
      name, virtualSize: vsize, rawSize, entropy: +byteEntropy(data).toFixed(3),
      executable: Boolean(chars & 0x20000000), writable: Boolean(chars & 0x80000000),
    });
  }
  const lastSection = sections.reduce((end, s, i) => {
    const off = view.getUint32(opt + optSize + i * 40 + 20, true);
    return Math.max(end, off + s.rawSize);
  }, 0);
  return {
    valid: true,
    machine: PE_MACHINES[machine] || `0x${machine.toString(16)}`,
    is64,
    isDll: Boolean(characteristics & 0x2000),
    subsystem: PE_SUBSYSTEMS[subsystem] || `#${subsystem}`,
    compiled: timestamp ? new Date(timestamp * 1000).toISOString() : null,
    aslr: Boolean(dllChars & 0x40),
    dep: Boolean(dllChars & 0x100),
    sections,
    overlayBytes: lastSection && bytes.length > lastSection ? bytes.length - lastSection : 0,
  };
}

function analyzePE(bytes, report) {
  const pe = parsePE(bytes);
  report.details.pe = pe;
  const add = report.add;
  add("pe-executable", "high", pe?.isDll ? "Windows DLL" : "Windows executable", "Programs run with your user's full permissions.");
  if (!pe?.valid) {
    add("pe-malformed", "medium", "Malformed PE header", "MZ header without a valid PE signature.");
    return;
  }
  const packers = pe.sections.filter((s) => /^(upx|\.upx|\.aspack|\.adata|\.packed|\.themida|\.vmp|\.enigma|\.mpress|petite|\.nsp)/i.test(s.name));
  if (packers.length) add("packer-sections", "high", "Packer section names", packers.map((s) => s.name).join(", "));
  const wx = pe.sections.filter((s) => s.executable && s.writable);
  if (wx.length) add("wx-sections", "medium", "Writable + executable sections", wx.map((s) => s.name || "(unnamed)").join(", "));
  const hot = pe.sections.filter((s) => s.entropy > 7.2 && s.rawSize > 4096);
  if (hot.length) add("packed-sections", "medium", "High-entropy (packed/encrypted) sections", hot.map((s) => `${s.name} ${s.entropy}`).join(", "));
  if (pe.overlayBytes > 1024) add("pe-overlay", "low", "Data appended after the last section (overlay)", `${pe.overlayBytes} bytes — common in installers and droppers.`);
  if (!pe.aslr || !pe.dep) add("pe-no-mitigations", "low", "Missing exploit mitigations", `${pe.aslr ? "" : "ASLR off. "}${pe.dep ? "" : "DEP off."}`.trim());
  const year = pe.compiled ? new Date(pe.compiled).getUTCFullYear() : null;
  if (year && (year < 2000 || year > new Date().getUTCFullYear() + 1)) add("pe-timestamp", "low", "Forged compile timestamp", pe.compiled);
}

function analyzeELF(bytes, report) {
  const cls = bytes[4] === 2 ? "64-bit" : "32-bit";
  const le = bytes[5] === 1;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const type = bytes.length > 18 ? view.getUint16(16, le) : 0;
  const machine = bytes.length > 20 ? view.getUint16(18, le) : 0;
  const machines = { 3: "x86", 62: "x86-64", 40: "ARM", 183: "AArch64", 8: "MIPS", 243: "RISC-V" };
  const types = { 1: "relocatable", 2: "executable", 3: "shared object / PIE", 4: "core dump" };
  report.details.elf = { class: cls, endian: le ? "little" : "big", type: types[type] || type, machine: machines[machine] || machine };
  report.add("elf-executable", "high", "Unix/Linux executable", `${cls} ${machines[machine] || "unknown arch"} ${types[type] || ""}`.trim());
}

// --- PDF (pdfid-style keyword census) ----------------------------------------
const PDF_KEYWORDS = ["/JavaScript", "/JS", "/OpenAction", "/AA", "/Launch", "/EmbeddedFile", "/RichMedia", "/XFA", "/AcroForm", "/URI", "/SubmitForm", "/GoToR", "/ObjStm", "/Encrypt", "/JBIG2Decode", "/Colors"];

export function pdfKeywordCounts(bytes) {
  const text = ascii(bytes, 0, bytes.length);
  const counts = {};
  for (const kw of PDF_KEYWORDS) {
    const re = new RegExp(kw.replace("/", "\\/") + "(?![A-Za-z])", "g");
    counts[kw] = (text.match(re) || []).length;
  }
  const version = (text.match(/^%PDF-(\d\.\d)/) || [])[1] || null;
  const pages = (text.match(/\/Type\s*\/Page(?!s)/g) || []).length;
  const eofCount = (text.match(/%%EOF/g) || []).length;
  return { counts, version, pages, incrementalUpdates: Math.max(0, eofCount - 1) };
}

function analyzePDF(bytes, report) {
  const info = pdfKeywordCounts(bytes);
  report.details.pdf = info;
  const c = info.counts;
  const add = report.add;
  if (c["/JavaScript"] || c["/JS"]) add("pdf-javascript", "high", "Embedded JavaScript", `${c["/JavaScript"] + c["/JS"]} JavaScript references.`);
  if (c["/OpenAction"] || c["/AA"]) add("pdf-auto-action", (c["/JavaScript"] || c["/JS"] || c["/Launch"]) ? "high" : "low", "Automatic actions on open", "/OpenAction or /AA triggers run when the document is opened.");
  if (c["/Launch"]) add("pdf-launch", "critical", "Launch action", "/Launch can start external programs.");
  if (c["/EmbeddedFile"]) add("pdf-embedded-file", "medium", "Embedded files", `${c["/EmbeddedFile"]} attachment(s) hidden inside the PDF.`);
  if (c["/RichMedia"]) add("pdf-richmedia", "medium", "Rich media (Flash/3D)", "Historically abused for exploits.");
  if (c["/XFA"]) add("pdf-xfa", "medium", "XFA forms", "XML forms with a large attack surface.");
  if (c["/SubmitForm"]) add("pdf-submitform", "low", "Form submission action", "May send typed data to a remote server.");
  if (c["/JBIG2Decode"]) add("pdf-jbig2", "low", "JBIG2 images", "This decoder has been the target of zero-click exploits.");
  if (c["/Encrypt"]) add("pdf-encrypted", "low", "Encrypted PDF", "Encryption can hide content from scanners.");
  if (c["/URI"] > 0) add("pdf-links", "info", "Contains links", `${c["/URI"]} URI action(s).`);
  if (c["/ObjStm"] > 0 && (c["/JavaScript"] || c["/JS"])) add("pdf-objstm", "medium", "Object streams with script", "Object streams can hide script objects from simple scanners.");
}

// --- OLE / RTF / web / scripts ------------------------------------------------
function utf16Includes(bytes, word) {
  const needle = new Uint8Array(word.length * 2);
  for (let i = 0; i < word.length; i++) needle[i * 2] = word.charCodeAt(i);
  outer: for (let i = 0; i <= bytes.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) if (bytes[i + j] !== needle[j]) continue outer;
    return true;
  }
  return false;
}

function analyzeOLE(bytes, report) {
  const add = report.add;
  const kinds = [];
  if (utf16Includes(bytes, "WordDocument")) kinds.push("Word 97-2003 document");
  if (utf16Includes(bytes, "Workbook") || utf16Includes(bytes, "Book")) kinds.push("Excel 97-2003 workbook");
  if (utf16Includes(bytes, "PowerPoint Document")) kinds.push("PowerPoint 97-2003 presentation");
  if (utf16Includes(bytes, "!_StringPool") || ascii(bytes, 0, Math.min(bytes.length, 1 << 20)).includes("Windows Installer")) kinds.push("Windows Installer (MSI)");
  report.details.ole = { kinds };
  if (kinds.length) report.detected.label = kinds.join(" / ");
  if (utf16Includes(bytes, "_VBA_PROJECT") || utf16Includes(bytes, "VBA")) add("vba-macros", "high", "Contains VBA macros", "Legacy Office file with a VBA project.");
  if (utf16Includes(bytes, "Ole10Native") || utf16Includes(bytes, "\u0001Ole10Native")) add("ole-package", "high", "Embedded OLE package", "Packager objects can carry executables.");
  if (kinds.includes("Windows Installer (MSI)")) add("msi", "high", "Windows installer package", "Installers run with elevated permissions.");
  const text = ascii(bytes, 0, Math.min(bytes.length, 4 << 20));
  if (/Equation\.3/.test(text)) add("equation-editor", "critical", "Equation Editor object", "Equation Editor (CVE-2017-11882) objects are a classic exploit vector.");
}

function analyzeRTF(bytes, report) {
  const text = ascii(bytes, 0, Math.min(bytes.length, 8 << 20));
  const add = report.add;
  if (/\\objdata/i.test(text)) add("rtf-objdata", "high", "Embedded OLE object data", "\\objdata payloads are used by RTF exploits.");
  if (/\\objupdate/i.test(text)) add("rtf-objupdate", "high", "Auto-updating object", "\\objupdate loads embedded objects without user interaction.");
  if (/\\objocx|\\objautlink|\\objlink/i.test(text)) add("rtf-objlink", "medium", "Linked/ActiveX object", "Linked objects can fetch remote content.");
  if (/Equation\.3/i.test(text) || /4571756174696f6e2e33/i.test(text)) add("equation-editor", "critical", "Equation Editor object", "Equation Editor (CVE-2017-11882) objects are a classic exploit vector.");
}

function analyzeWeb(text, report, kind) {
  const add = report.add;
  const scripts = (text.match(/<script\b/gi) || []).length;
  if (scripts) add(`${kind}-script`, kind === "svg" ? "high" : "medium", `${scripts} <script> element(s)`, "Active content runs when the file is opened in a browser.");
  if (/\son[a-z]+\s*=/i.test(text)) add(`${kind}-handlers`, "medium", "Inline event handlers", "on* attributes execute JavaScript.");
  if (/javascript:/i.test(text)) add(`${kind}-js-uri`, "medium", "javascript: URLs", "");
  if (/<input[^>]+type\s*=\s*["']?password/i.test(text)) add("credential-form", "high", "Password form", "Local HTML files that ask for passwords are almost always phishing.");
  if (/<form[^>]+action\s*=\s*["']?https?:/i.test(text)) add("remote-form", "medium", "Form posts to a remote server", "");
  if (/(atob\(|fromCharCode|unescape\(|eval\()/i.test(text)) add("obfuscation", "medium", "Obfuscation primitives", "atob/eval/unescape/fromCharCode are typical of obfuscated loaders.");
  if (/(new Blob|msSaveOrOpenBlob|URL\.createObjectURL)[\s\S]{0,400}(download|click\(\))/i.test(text) || /data:application\/(octet-stream|x-msdownload|zip)/i.test(text)) {
    add("html-smuggling", "critical", "HTML smuggling pattern", "Builds a file in the browser and triggers a download — used to sneak malware past gateways.");
  }
  if (/<meta[^>]+http-equiv\s*=\s*["']?refresh/i.test(text)) add("meta-refresh", "low", "Auto-redirect", "Meta refresh sends you to another page.");
  if (/<iframe/i.test(text)) add(`${kind}-iframe`, "low", "Embedded frames", "");
}

const SCRIPT_PATTERNS = [
  [/-e(nc|ncodedcommand)\s+[A-Za-z0-9+/=]{20,}/i, "critical", "Encoded PowerShell command"],
  [/(DownloadString|DownloadFile|Invoke-WebRequest|iwr |wget |curl\s+-[sSkLo])/i, "high", "Downloads content from the internet"],
  [/(IEX|Invoke-Expression|eval\s*\()/i, "high", "Executes dynamically built code"],
  [/(WScript\.Shell|Shell\.Application|ActiveXObject|CreateObject\()/i, "high", "Spawns shell / COM objects"],
  [/FromBase64String|base64\s+-d|atob\(/i, "medium", "Decodes base64 payloads"],
  [/-w(indowstyle)?\s+hidden|-nop\b|-noni\b|bypass/i, "high", "Hidden / policy-bypassing PowerShell"],
  [/(reg add|schtasks|New-ScheduledTask|HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run)/i, "high", "Sets up persistence"],
  [/(vssadmin\s+delete|bcdedit|wbadmin\s+delete|cipher\s+\/w)/i, "critical", "Destroys backups (ransomware behaviour)"],
  [/(certutil\s+-decode|certutil\s+-urlcache|bitsadmin|mshta|rundll32|regsvr32)/i, "high", "Living-off-the-land binary abuse"],
];

function analyzeScript(text, report) {
  for (const [re, sev, title] of SCRIPT_PATTERNS) {
    const m = text.match(re);
    if (m) report.add(`script-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`, sev, title, `Matched: ${m[0].slice(0, 80)}`);
  }
}

// --- EXIF (JPEG) -------------------------------------------------------------
export function parseExif(bytes) {
  if (!(bytes[0] === 0xff && bytes[1] === 0xd8)) return null;
  let off = 2;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  while (off + 4 < bytes.length) {
    if (bytes[off] !== 0xff) break;
    const marker = bytes[off + 1];
    const len = view.getUint16(off + 2);
    if (marker === 0xe1 && ascii(bytes, off + 4, 6) === "Exif\0\0") {
      const tiff = off + 10;
      const le = ascii(bytes, tiff, 2) === "II";
      const g16 = (o) => view.getUint16(o, le);
      const g32 = (o) => view.getUint32(o, le);
      const tags = { 0x010f: "Make", 0x0110: "Model", 0x0131: "Software", 0x0132: "DateTime", 0x013b: "Artist", 0x8298: "Copyright" };
      const out = {};
      try {
        const ifd0 = tiff + g32(tiff + 4);
        const count = g16(ifd0);
        for (let i = 0; i < count && i < 200; i++) {
          const e = ifd0 + 2 + i * 12;
          const tag = g16(e);
          if (tag === 0x8825) out.GPS = "present (location embedded)";
          if (!tags[tag]) continue;
          const type = g16(e + 2);
          const n = g32(e + 4);
          if (type === 2) {
            const valOff = n <= 4 ? e + 8 : tiff + g32(e + 8);
            out[tags[tag]] = ascii(bytes, valOff, Math.min(n, 120)).replace(/\0+$/, "");
          }
        }
      } catch { /* truncated EXIF */ }
      return out;
    }
    if (marker === 0xda) break;
    off += 2 + len;
  }
  return null;
}

// --- Strings & IOCs ------------------------------------------------------------
export function extractStrings(bytes, { min = 6, max = 3000 } = {}) {
  const out = [];
  let cur = "";
  const limit = Math.min(bytes.length, 32 << 20);
  for (let i = 0; i < limit && out.length < max; i++) {
    const c = bytes[i];
    if (c >= 32 && c < 127) cur += String.fromCharCode(c);
    else {
      if (cur.length >= min) out.push(cur);
      cur = "";
    }
  }
  if (cur.length >= min && out.length < max) out.push(cur);
  // UTF-16LE strings (common in Windows binaries).
  cur = "";
  for (let i = 0; i + 1 < limit && out.length < max; i += 2) {
    const c = bytes[i];
    if (bytes[i + 1] === 0 && c >= 32 && c < 127) cur += String.fromCharCode(c);
    else {
      if (cur.length >= min) out.push(cur);
      cur = "";
    }
  }
  return out;
}

const COMMON_DOMAINS = /(^|\.)(w3\.org|xmlsoap\.org|microsoft\.com|schemas\.openxmlformats\.org|adobe\.com|purl\.org|apache\.org|mozilla\.org|verisign\.com|digicert\.com|globalsign\.com|sectigo\.com|symantec\.com|thawte\.com|example\.(com|org))$/i;

export function extractIOCs(strings) {
  const urls = new Set(), ips = new Set(), emails = new Set(), domains = new Set();
  for (const s of strings) {
    for (const m of s.matchAll(/\bhttps?:\/\/[^\s"'<>`)\]]{4,300}/gi)) {
      try {
        const u = new URL(m[0]);
        if (!COMMON_DOMAINS.test(u.hostname)) urls.add(u.href);
      } catch { /* invalid */ }
    }
    for (const m of s.matchAll(/\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g)) {
      const octets = m[0].split(".").map(Number);
      const looksLikeVersion = octets.every((o) => o < 10); // e.g. 1.0.0.0 in PE version info
      if (!looksLikeVersion && ![0, 127, 255].includes(octets[0])) ips.add(m[0]);
    }
    for (const m of s.matchAll(/\b[\w.+-]{1,64}@[\w-]{1,63}(?:\.[\w-]{1,63})+\b/g)) emails.add(m[0]);
    for (const m of s.matchAll(/\b(?:[a-z0-9-]{1,63}\.)+(?:com|net|org|io|ru|cn|xyz|top|info|biz|co|me|tk|su|onion|online|site|club|live|app|dev)\b/gi)) {
      const d = m[0].toLowerCase();
      if (!COMMON_DOMAINS.test(d) && !/\.(dll|exe|sys)$/i.test(d)) domains.add(d);
    }
  }
  const cap = (set, n = 200) => [...set].slice(0, n);
  return { urls: cap(urls), ips: cap(ips), emails: cap(emails), domains: cap(domains) };
}

// --- Verdict -------------------------------------------------------------------
export function verdictFor(findings) {
  let score = 0;
  for (const f of findings) score += SEVERITY_WEIGHT[f.severity] ?? 0;
  score = Math.min(100, score);
  const level = score >= 70 ? "critical" : score >= 40 ? "high" : score >= 15 ? "medium" : "low";
  const label = { critical: "Very likely malicious", high: "High risk", medium: "Use caution", low: "No obvious threats" }[level];
  return { score, level, label };
}

/**
 * Full static analysis.
 * @param {{ name: string, type?: string, bytes: Uint8Array }} file
 */
export function analyzeFile({ name, type = "", bytes }) {
  const findings = [];
  const report = {
    name,
    size: bytes.length,
    declaredMime: type || "unknown",
    detected: detectType(bytes),
    details: {},
    flags: {},
    findings,
    add: (id, severity, title, detail = "") => {
      if (!findings.some((f) => f.id === id)) findings.push({ id, severity, title, detail });
    },
  };

  const nameInfo = analyzeName(name);
  report.extension = nameInfo.ext;
  nameInfo.findings.forEach((f) => report.add(f.id, f.severity, f.title, f.detail));

  const det = report.detected;
  const textTypes = new Set(["html", "svg", "xml", "json", "text", "script"]);
  const text = textTypes.has(det.type) ? decodeText(bytes.subarray(0, 8 << 20)) : "";

  switch (det.type) {
    case "pe": analyzePE(bytes, report); break;
    case "elf": analyzeELF(bytes, report); break;
    case "macho": report.add("macho-executable", "high", "macOS executable", "Programs run with your user's permissions."); break;
    case "lnk": report.add("lnk-file", "critical", "Windows shortcut file", "LNK files can launch hidden commands; they are a top malware loader since macros were blocked."); break;
    case "chm": report.add("chm-file", "high", "Compiled HTML Help", "CHM files can run scripts and executables."); break;
    case "java-class": case "dex": case "wasm": report.add("bytecode", "medium", det.label, "Executable bytecode."); break;
    case "iso": report.add("disk-image", "high", "Disk image container", "ISO/IMG containers are used to bypass Mark-of-the-Web protections."); break;
    case "onenote": report.add("onenote", "medium", "OneNote section", "OneNote files were widely abused to deliver malware via embedded attachments."); break;
    case "zip": analyzeZip(bytes, report); break;
    case "pdf": analyzePDF(bytes, report); break;
    case "ole": analyzeOLE(bytes, report); break;
    case "rtf": analyzeRTF(bytes, report); break;
    case "html": analyzeWeb(text, report, "html"); break;
    case "svg": analyzeWeb(text, report, "svg"); break;
    case "script": case "text": analyzeScript(text, report); break;
    case "jpeg": report.details.exif = parseExif(bytes); break;
    default: break;
  }
  if (["js", "jse", "vbs", "vbe", "ps1", "psm1", "bat", "cmd", "sh", "hta", "wsf"].includes(nameInfo.ext) && det.type !== "script") analyzeScript(text || decodeText(bytes.subarray(0, 4 << 20)), report);
  if (report.details.exif?.GPS) report.add("exif-gps", "info", "Photo contains GPS location", "Sharing this image may reveal where it was taken. Use “Download clean copy” to strip metadata.");

  // Extension vs. real type.
  const ext = nameInfo.ext;
  const expectations = {
    pdf: ["pdf"], doc: ["ole"], xls: ["ole"], ppt: ["ole"], docx: ["zip"], xlsx: ["zip"], pptx: ["zip"], zip: ["zip"],
    jpg: ["jpeg"], jpeg: ["jpeg"], png: ["png"], gif: ["gif"], webp: ["webp"], mp4: ["mp4"], mp3: ["mp3"], txt: ["text", "json", "xml", "script"],
    rtf: ["rtf"], rar: ["rar"], "7z": ["7z"], exe: ["pe"], dll: ["pe"], html: ["html", "text"], htm: ["html", "text"], svg: ["svg", "xml"],
  };
  if (expectations[ext] && !expectations[ext].includes(det.type) && det.type !== "empty") {
    const severe = det.category === "executable";
    report.add("type-mismatch", severe ? "critical" : "medium", "Extension does not match content",
      `Named .${ext} but the bytes are a ${det.label}.`);
  }

  const ent = entropyProfile(bytes);
  report.entropy = ent;
  const compressedType = ["zip", "rar", "7z", "gzip", "bzip2", "xz", "cab", "jpeg", "png", "gif", "webp", "mp4", "mp3", "webm", "ogg", "heif", "pdf", "flac", "m4a"].includes(det.type);
  if (!compressedType && ent.overall > 7.5 && bytes.length > 4096) {
    report.add("high-entropy", "medium", "Very high entropy", `${ent.overall.toFixed(2)} bits/byte — content is compressed or encrypted, which can hide payloads.`);
  }

  const strings = det.category === "image" || det.category === "video" || det.category === "audio" ? [] : extractStrings(bytes);
  report.strings = strings.slice(0, 1500);
  report.iocs = extractIOCs(strings);
  if (report.iocs.urls.length && ["executable", "script"].includes(det.category)) {
    report.add("embedded-urls", "low", "Embedded URLs", `${report.iocs.urls.length} URL(s) found in the file body.`);
  }

  const order = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  findings.sort((a, b) => order[a.severity] - order[b.severity]);
  delete report.add;
  report.verdict = verdictFor(findings);
  return report;
}
