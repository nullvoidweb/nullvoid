// Small, safe Markdown renderer for AI responses. Input is HTML-escaped
// first, so model output (which may echo attacker-controlled page text) can
// never inject markup; the result is then passed through DOMPurify by callers.

export function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function safeHref(url) {
  try {
    const u = new URL(url.replace(/&amp;/g, "&"));
    return /^https?:$/.test(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
}

function inline(text) {
  // Protect inline code spans first.
  const codes = [];
  let s = text.replace(/`([^`\n]+)`/g, (_, c) => {
    codes.push(c);
    return `\u0000${codes.length - 1}\u0000`;
  });
  s = s.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, (m, label, href) => {
    const safe = safeHref(href);
    return safe ? `<a href="${escapeHtml(safe)}" target="_blank" rel="noopener noreferrer">${label}</a>` : m;
  });
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, (m, pre, href) => {
    const safe = safeHref(href);
    return safe ? `${pre}<a href="${escapeHtml(safe)}" target="_blank" rel="noopener noreferrer">${href}</a>` : m;
  });
  s = s.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
  s = s.replace(/~~([^~\n]+)~~/g, "<del>$1</del>");
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[Number(i)]}</code>`);
}

/** Render Markdown to an HTML string (escaped; sanitize again before use). */
export function renderMarkdown(src) {
  const lines = escapeHtml(src).replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  let i = 0;
  let para = [];
  const flushPara = () => {
    if (para.length) out.push(`<p>${inline(para.join("<br>"))}</p>`);
    para = [];
  };
  while (i < lines.length) {
    const line = lines[i];
    const fence = line.match(/^\s*```\s*([\w+-]*)\s*$/);
    if (fence) {
      flushPara();
      const buf = [];
      i++;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out.push(`<pre><code${fence[1] ? ` data-lang="${fence[1]}"` : ""}>${buf.join("\n")}</code></pre>`);
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      flushPara();
      // Replies sit under the page h1, so "#" and "##" map to h2, "###" to h3, etc.
      const level = Math.max(2, Math.min(6, h[1].length));
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
      i++;
      continue;
    }
    if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) {
      flushPara();
      out.push("<hr>");
      i++;
      continue;
    }
    if (/^&gt;\s?/.test(line)) {
      flushPara();
      const buf = [];
      while (i < lines.length && /^&gt;\s?/.test(lines[i])) buf.push(lines[i++].replace(/^&gt;\s?/, ""));
      out.push(`<blockquote>${inline(buf.join("<br>"))}</blockquote>`);
      continue;
    }
    const list = line.match(/^\s*([-*+]|\d+[.)])\s+(.*)$/);
    if (list) {
      flushPara();
      const ordered = /\d/.test(list[1]);
      const items = [];
      while (i < lines.length) {
        const m = lines[i].match(/^\s*([-*+]|\d+[.)])\s+(.*)$/);
        if (!m) {
          if (/^\s{2,}\S/.test(lines[i]) && items.length) {
            items[items.length - 1] += `<br>${lines[i].trim()}`;
            i++;
            continue;
          }
          break;
        }
        items.push(m[2]);
        i++;
      }
      const tag = ordered ? "ol" : "ul";
      out.push(`<${tag}>${items.map((it) => `<li>${inline(it)}</li>`).join("")}</${tag}>`);
      continue;
    }
    if (/^\|.*\|\s*$/.test(line) && /^\|?\s*:?-{3,}/.test(lines[i + 1] || "")) {
      flushPara();
      const row = (l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const head = row(line);
      i += 2;
      const body = [];
      while (i < lines.length && /^\|.*\|\s*$/.test(lines[i])) body.push(row(lines[i++]));
      out.push(`<table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${
        body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
      continue;
    }
    if (!line.trim()) {
      flushPara();
      i++;
      continue;
    }
    para.push(line);
    i++;
  }
  flushPara();
  return out.join("\n");
}
