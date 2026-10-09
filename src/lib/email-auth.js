// Parses the raw RFC 5322 header block of a message to surface sender
// authentication (SPF / DKIM / DMARC verdicts recorded by the receiving
// server) and classic spoofing tells (Reply-To or Return-Path on a different
// domain than From).
import { registrableDomain } from "./domain.js";

/** Unfold and split headers into [name, value] pairs (first block only). */
export function parseHeaders(raw) {
  const head = String(raw || "").split(/\r?\n\r?\n/)[0];
  const unfolded = head.replace(/\r?\n[ \t]+/g, " ");
  const out = [];
  for (const line of unfolded.split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i > 0) out.push([line.slice(0, i).trim().toLowerCase(), line.slice(i + 1).trim()]);
  }
  return out;
}

const header = (headers, name) => headers.find(([n]) => n === name)?.[1] ?? "";
const allHeaders = (headers, name) => headers.filter(([n]) => n === name).map(([, v]) => v);

function addrDomain(value) {
  const m = String(value).match(/<([^>]+)>/) || String(value).match(/([^\s<>"']+@[^\s<>"']+)/);
  const addr = (m ? m[1] : value).trim();
  const at = addr.lastIndexOf("@");
  return at > 0 ? addr.slice(at + 1).toLowerCase().replace(/[>\s]+$/, "") : "";
}

/**
 * @returns {{ spf: string|null, dkim: string|null, dmarc: string|null, warnings: string[], fromDomain: string }}
 */
export function analyzeEmailAuth(raw) {
  const headers = parseHeaders(raw);
  const results = allHeaders(headers, "authentication-results").join("; ") + "; " + allHeaders(headers, "arc-authentication-results").join("; ");
  const pick = (mech) => {
    const m = results.match(new RegExp(`\\b${mech}\\s*=\\s*([a-z]+)`, "i"));
    return m ? m[1].toLowerCase() : null;
  };
  let spf = pick("spf");
  if (!spf) {
    const rs = header(headers, "received-spf").match(/^([a-z]+)/i);
    spf = rs ? rs[1].toLowerCase() : null;
  }
  const dkim = pick("dkim");
  const dmarc = pick("dmarc");

  const from = header(headers, "from");
  const fromDomain = addrDomain(from);
  const warnings = [];
  const replyTo = header(headers, "reply-to");
  if (replyTo && fromDomain && registrableDomain(addrDomain(replyTo)) !== registrableDomain(fromDomain)) {
    warnings.push(`Replies go to a different domain (${addrDomain(replyTo)}) than the sender (${fromDomain}).`);
  }
  const returnPath = header(headers, "return-path");
  if (returnPath && fromDomain && addrDomain(returnPath) && registrableDomain(addrDomain(returnPath)) !== registrableDomain(fromDomain) && dmarc !== "pass") {
    warnings.push(`Envelope sender (${addrDomain(returnPath)}) differs from the From domain.`);
  }
  const displayName = from.replace(/<[^>]*>/, "").replace(/"/g, "").trim();
  const nameDomain = displayName.match(/[a-z0-9-]+\.[a-z]{2,}/i)?.[0];
  if (nameDomain && fromDomain && registrableDomain(nameDomain.toLowerCase()) !== registrableDomain(fromDomain)) {
    warnings.push(`The display name mentions "${nameDomain}" but the message was sent from ${fromDomain}.`);
  }
  if (dmarc === "fail") warnings.push("DMARC failed: the sender's domain did not authorise this message.");
  else if (spf === "fail" || spf === "softfail") warnings.push(`SPF ${spf}: the sending server is not authorised for this domain.`);
  if (dkim === "fail") warnings.push("DKIM signature is invalid; the message may have been altered.");
  return { spf, dkim, dmarc, warnings, fromDomain };
}
