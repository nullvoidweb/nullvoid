import { api, extensionUrl } from "../lib/browser.js";
import { call, onBroadcast } from "../lib/messaging.js";
import { $, h, icon, hydrateIcons, toast, copyText, initTheme, effectiveTheme, timeAgo, formatBytes } from "../lib/ui.js";
import { getMeta, getMailbox, mailClient, saveToken, getSeen, setSeen } from "../lib/mailboxes.js";
import { messageHtml } from "../lib/mailtm.js";
import { extractCodes, extractLinks } from "../lib/otp.js";
import { sanitizeEmail, emailFrameDoc, textToSafeHtml } from "../lib/sanitize.js";
import { analyzeEmailAuth } from "../lib/email-auth.js";
import { putHandoff } from "../lib/handoff.js";

const params = new URLSearchParams(location.search);
let settings, client;
let currentBox = null; // full mailbox incl. credentials
let messages = [];
let current = null; // full message
let allowRemote = false;
let liveAbort = null;
let pollTimer = null;
let windowId = null; // captured up front: sidePanel.open() must run inside the click gesture

async function init() {
  settings = await initTheme();
  hydrateIcons();
  client = await mailClient();
  allowRemote = settings.email.loadRemoteContent;
  windowId = (await api.windows.getCurrent())?.id ?? null;

  $("#newBox").addEventListener("click", newBox);
  $("#copyAddr").addEventListener("click", () => currentBox && copyText(currentBox.address, "Address copied"));
  $("#refresh").addEventListener("click", () => loadMessages(true));
  $("#deleteMsg").addEventListener("click", deleteCurrent);
  $("#viewSource").addEventListener("click", showSource);
  $("#closeSource").addEventListener("click", () => $("#sourceDialog").close());
  $("#askAi").addEventListener("click", askAi);
  $("#loadRemote").addEventListener("click", () => {
    allowRemote = !allowRemote;
    renderBody();
  });
  onBroadcast("email:updated", () => renderBoxes());

  const meta = await getMeta();
  if (!meta.boxes.length) {
    try {
      await call("email:ensure");
    } catch (err) {
      toast(err.message, "error");
    }
  }
  await renderBoxes();
  const target = params.get("box") || (await getMeta()).active;
  if (target) await selectBox(target, params.get("msg"));
}

// --- Mailboxes ------------------------------------------------------------------------

async function renderBoxes() {
  const meta = await getMeta();
  $("#boxList").replaceChildren(...meta.boxes.map((b) => h("div", {
    class: `box${currentBox?.id === b.id ? " active" : ""}`,
    onclick: () => selectBox(b.id),
    title: b.address,
  },
  h("span", { class: "addr" }, b.address),
  h("span", { class: "sub" }, `${b.unread ? `${b.unread} unread · ` : ""}${timeAgo(b.createdAt)}`),
  h("button", {
    class: "icon-btn del", title: "Delete address", "aria-label": `Delete ${b.address}`,
    onclick: async (e) => {
      e.stopPropagation();
      if (!confirm(`Delete ${b.address} and all its messages?`)) return;
      await call("email:delete", { id: b.id });
      if (currentBox?.id === b.id) {
        currentBox = null;
        const m = await getMeta();
        if (m.active) await selectBox(m.active);
        else clearView();
      }
      renderBoxes();
    },
  }, icon("trash", "icon icon-sm")))));
}

async function newBox() {
  const btn = $("#newBox");
  btn.disabled = true;
  try {
    const box = await call("email:create");
    await selectBox(box.id);
    copyText(box.address, "New address copied");
  } catch (err) {
    toast(err.message, "error");
  } finally {
    btn.disabled = false;
  }
}

function clearView() {
  $("#currentAddr").textContent = "—";
  $("#msgList").replaceChildren();
  $("#message").hidden = true;
  $("#readerEmpty").hidden = false;
}

async function selectBox(id, openMsgId) {
  const box = await getMailbox(id);
  if (!box) return toast("That inbox no longer exists", "warn");
  currentBox = box;
  call("email:setActive", { id }).catch(() => {});
  $("#currentAddr").textContent = box.address;
  $("#message").hidden = true;
  $("#readerEmpty").hidden = false;
  renderBoxes();
  await loadMessages();
  startLive();
  if (openMsgId) openMessage(openMsgId);
}

// --- Message list ------------------------------------------------------------------------

async function loadMessages(manual = false) {
  if (!currentBox) return;
  const list = $("#msgList");
  if (!messages.length || manual) list.replaceChildren(h("div", { class: "empty" }, h("span", { class: "spinner" }), "Loading…"));
  try {
    const before = currentBox.token;
    const { items } = await client.listMessages(currentBox);
    if (currentBox.token !== before) saveToken(currentBox.id, currentBox.token);
    messages = items;
    const seen = await getSeen(currentBox.id);
    items.forEach((m) => seen.add(m.id));
    await setSeen(currentBox.id, seen);
    renderList();
  } catch (err) {
    list.replaceChildren(h("div", { class: "empty" }, icon("info"), `Could not load messages: ${err.message}`));
  }
}

function renderList() {
  const list = $("#msgList");
  if (!messages.length) {
    list.replaceChildren(h("div", { class: "empty" }, icon("mail"),
      h("p", {}, "No messages yet."),
      h("p", { class: "tiny" }, "Mail sent to this address appears here instantly."),
      h("button", { class: "btn btn-sm", onclick: () => copyText(currentBox.address, "Address copied") }, icon("copy", "icon icon-sm"), "Copy address")));
    return;
  }
  list.replaceChildren(...messages.map((m) => {
    const codes = extractCodes(m.intro || "", m.subject || "");
    return h("div", { class: `msg${m.seen ? " seen" : ""}${current?.id === m.id ? " active" : ""}`, onclick: () => openMessage(m.id), dataset: { id: m.id } },
      h("span", { class: "unread" }),
      h("span", { class: "from" }, m.from?.name || m.from?.address || "Unknown sender"),
      h("span", { class: "time" }, m.hasAttachments ? "📎 " : "", timeAgo(m.createdAt)),
      h("span", { class: "subject" }, m.subject || "(no subject)"),
      h("span", { class: "intro" }, m.intro || ""),
      codes[0] ? h("span", { class: "badge badge-low code-chip mono" }, `code ${codes[0]}`) : null);
  }));
}

function startLive() {
  liveAbort?.abort();
  clearInterval(pollTimer);
  liveAbort = new AbortController();
  const state = $("#liveState");
  state.classList.add("on");
  state.querySelector("span:last-child").textContent = "live";
  const debounced = (() => {
    let t;
    return () => {
      clearTimeout(t);
      t = setTimeout(() => loadMessages(), 400);
    };
  })();
  client.subscribe(currentBox, (data) => {
    if (data?.["@type"] === "Message" || data?.msgid || data?.["@id"]?.startsWith?.("/messages")) debounced();
  }, liveAbort.signal).finally(() => {
    state.classList.remove("on");
    state.querySelector("span:last-child").textContent = "offline";
  });
  // Safety net in case the SSE stream silently stalls.
  pollTimer = setInterval(() => loadMessages(), 60000);
}

// --- Reader --------------------------------------------------------------------------------

async function openMessage(id) {
  try {
    current = await client.getMessage(currentBox, id);
  } catch (err) {
    return toast(`Could not open message: ${err.message}`, "error");
  }
  allowRemote = settings.email.loadRemoteContent;
  $("#readerEmpty").hidden = true;
  $("#message").hidden = false;
  $("#msgSubject").textContent = current.subject || "(no subject)";
  $("#msgFrom").textContent = current.from?.name || "";
  $("#msgFromAddr").textContent = current.from?.address ? `<${current.from.address}>` : "";
  $("#msgTo").textContent = (current.to || []).map((t) => t.address).join(", ");
  $("#msgDate").textContent = new Date(current.createdAt).toLocaleString();
  renderQuick();
  renderBody();
  renderAttachments();
  renderAuth();
  if (!current.seen) {
    client.markSeen(currentBox, id).catch(() => {});
    const m = messages.find((x) => x.id === id);
    if (m) m.seen = true;
  }
  renderList();
}

function renderQuick() {
  const html = messageHtml(current);
  const codes = extractCodes(current.text || html.replace(/<[^>]+>/g, " "), current.subject || "");
  const links = extractLinks(html, current.text || "").slice(0, 2);
  const quick = $("#quick");
  const items = [];
  if (codes.length) {
    items.push(h("span", { class: "small muted" }, "Verification code"));
    for (const c of codes.slice(0, 2)) items.push(h("button", { class: "code-btn", title: "Copy code", onclick: () => copyText(c, "Code copied") }, c, icon("copy", "icon icon-sm")));
  }
  for (const l of links) {
    items.push(h("a", {
      class: "btn btn-sm", target: "_blank", rel: "noopener noreferrer",
      href: `${extensionUrl("blocked/blocked.html")}?mode=link&url=${encodeURIComponent(l.url)}`, title: l.url,
    }, icon("shield-check", "icon icon-sm"), l.label ? `Open “${l.label.slice(0, 32)}”` : "Open verification link"));
  }
  quick.hidden = !items.length;
  quick.replaceChildren(...items);
}

function renderBody() {
  if (!current) return;
  const html = messageHtml(current);
  let body, remoteCount = 0, trackers = 0;
  if (html) {
    const res = sanitizeEmail(html, { allowRemote });
    body = res.html;
    remoteCount = res.remoteCount;
    trackers = res.trackers;
  } else {
    body = textToSafeHtml(current.text || "");
  }
  $("#bodyFrame").srcdoc = emailFrameDoc(body, { allowRemote, dark: effectiveTheme() === "dark" && !html });
  const bar = $("#remoteBar");
  bar.hidden = !remoteCount;
  $("#remoteText").textContent = allowRemote
    ? `Remote images loaded (${remoteCount}). Senders can see that you opened this message.`
    : `${remoteCount} remote image${remoteCount === 1 ? "" : "s"} blocked${trackers ? `, including ${trackers} tracking pixel${trackers === 1 ? "" : "s"}` : ""}.`;
  $("#loadRemote").textContent = allowRemote ? "Block images" : "Load images";
}

function renderAttachments() {
  const box = $("#attachments");
  const atts = current.attachments || [];
  box.hidden = !atts.length;
  box.replaceChildren(h("div", { class: "small muted" }, `${atts.length} attachment${atts.length === 1 ? "" : "s"}`), ...atts.map((a) => h("div", { class: "att" },
    icon("file-search"),
    h("div", { class: "grow" }, h("div", { class: "truncate" }, a.filename || "attachment"), h("div", { class: "tiny muted" }, `${a.contentType || "unknown type"} · ${formatBytes(a.size || 0)}`)),
    h("button", { class: "btn btn-sm btn-primary", onclick: () => analyzeAttachment(a) }, icon("shield-check", "icon icon-sm"), "Analyze safely"),
    h("button", { class: "btn btn-sm btn-ghost", onclick: () => saveAttachment(a) }, icon("download", "icon icon-sm"), "Save"))));
}

async function fetchAttachment(a) {
  return client.downloadAttachment(currentBox, a.downloadUrl);
}

async function analyzeAttachment(a) {
  try {
    const blob = await fetchAttachment(a);
    const id = await putHandoff(blob, { name: a.filename || "attachment", type: a.contentType || blob.type, source: `E-mail from ${current.from?.address || "unknown"}` });
    api.tabs.create({ url: `${extensionUrl("viewer/viewer.html")}?handoff=${id}` });
  } catch (err) {
    toast(`Could not fetch attachment: ${err.message}`, "error");
  }
}

async function saveAttachment(a) {
  if (!confirm(`Save "${a.filename}" to your computer?\n\nAttachments from unknown senders can contain malware. Use “Analyze safely” first.`)) return;
  try {
    const blob = await fetchAttachment(a);
    const link = h("a", { href: URL.createObjectURL(blob), download: a.filename || "attachment" });
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 10000);
  } catch (err) {
    toast(err.message, "error");
  }
}

async function renderAuth() {
  const box = $("#authBadges");
  box.replaceChildren(h("span", { class: "tiny muted" }, "Checking sender authentication…"));
  try {
    const src = await client.getSource(currentBox, current.id);
    current.__raw = src?.data || "";
    const auth = analyzeEmailAuth(current.__raw);
    const badge = (label, v) => {
      const cls = v === "pass" ? "badge-safe" : v === "fail" || v === "softfail" ? "badge-dangerous" : v ? "badge-suspicious" : "badge-info";
      return h("span", { class: `badge ${cls}`, title: `${label}: ${v || "not reported"}` }, `${label} ${v || "n/a"}`);
    };
    box.replaceChildren(badge("SPF", auth.spf), badge("DKIM", auth.dkim), badge("DMARC", auth.dmarc),
      ...auth.warnings.map((w) => h("span", { class: "badge badge-suspicious", title: w }, "⚠ ", w)));
  } catch {
    box.replaceChildren(h("span", { class: "tiny muted" }, "Authentication results unavailable."));
  }
}

async function showSource() {
  if (!current) return;
  if (!current.__raw) {
    try {
      current.__raw = (await client.getSource(currentBox, current.id))?.data || "";
    } catch (err) {
      return toast(err.message, "error");
    }
  }
  $("#sourceText").textContent = current.__raw;
  $("#sourceDialog").showModal();
}

async function deleteCurrent() {
  if (!current || !confirm("Delete this message?")) return;
  try {
    await client.deleteMessage(currentBox, current.id);
    messages = messages.filter((m) => m.id !== current.id);
    current = null;
    $("#message").hidden = true;
    $("#readerEmpty").hidden = false;
    renderList();
  } catch (err) {
    toast(err.message, "error");
  }
}

function askAi() {
  if (!current) return;
  const html = messageHtml(current);
  const prompt = {
    kind: "email",
    from: `${current.from?.name || ""} <${current.from?.address || ""}>`,
    to: (current.to || []).map((t) => t.address).join(", "),
    subject: current.subject || "",
    text: (current.text || html.replace(/<[^>]+>/g, " ")).slice(0, 12000),
    links: extractLinks(html, current.text || "").map((l) => l.url).slice(0, 15),
  };
  api.storage.session.set({ "nv.pendingAiPrompt": { ...prompt, ts: Date.now() } });
  if (api.sidePanel?.open && windowId != null) {
    api.sidePanel.open({ windowId }).catch(() => api.tabs.create({ url: extensionUrl("assistant/assistant.html") }));
  } else {
    api.tabs.create({ url: extensionUrl("assistant/assistant.html") });
  }
}

window.addEventListener("beforeunload", () => liveAbort?.abort());

init().catch((err) => {
  console.error(err);
  toast(err.message, "error");
});
