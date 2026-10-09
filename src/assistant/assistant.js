import { api, extensionUrl } from "../lib/browser.js";
import { onSettingsChanged } from "../lib/settings.js";
import { getSecrets } from "../lib/vault.js";
import { call } from "../lib/messaging.js";
import { $, $$, h, icon, hydrateIcons, toast, copyText, initTheme, activeTab, timeAgo } from "../lib/ui.js";
import { renderMarkdown } from "../lib/markdown.js";
import { sanitizeRichFragment } from "../lib/sanitize.js";
import { streamChat, AiConfigError } from "../lib/ai/providers.js";
import { ANTHROPIC_MODELS } from "../lib/ai/models.js";
import { SYSTEM_PROMPT, pageAnalysisPrompt, emailAnalysisPrompt, fileReportPrompt, selectionPrompt } from "../lib/ai/prompts.js";
import { randomId } from "../lib/crypto.js";

const CHATS_KEY = "nv.ai.chats";
const PENDING_KEY = "nv.pendingAiPrompt";
const MAX_CHATS = 30;
const MAX_TURNS = 40;

let settings;
let chat = newChatObject();
let abort = null;

function newChatObject() {
  return { id: randomId(12), title: "New chat", updated: Date.now(), messages: [] };
}

// --- Persistence -------------------------------------------------------------------------

async function loadChats() {
  const { [CHATS_KEY]: chats = [] } = await api.storage.local.get(CHATS_KEY);
  return chats;
}

async function saveChat() {
  if (!chat.messages.length) return;
  chat.updated = Date.now();
  const chats = (await loadChats()).filter((c) => c.id !== chat.id);
  chats.unshift({ ...chat, messages: chat.messages.slice(-MAX_TURNS) });
  await api.storage.local.set({ [CHATS_KEY]: chats.slice(0, MAX_CHATS) });
}

// --- Rendering ---------------------------------------------------------------------------

function modelLabel() {
  const ai = settings.ai;
  if (ai.provider === "anthropic") return `Claude · ${ANTHROPIC_MODELS.find((m) => m.id === ai.anthropicModel)?.label.split(" (")[0] || ai.anthropicModel}`;
  if (ai.provider === "openai") return `OpenAI-compatible · ${ai.openaiModel || "no model set"}`;
  return `Gemini · ${ai.geminiModel || "no model set"}`;
}

function renderAll() {
  $("#welcome").hidden = chat.messages.length > 0;
  $("#messages").replaceChildren(...chat.messages.map((m) => messageEl(m)));
  scrollDown();
}

function messageEl(m) {
  const wrap = h("div", { class: `msg ${m.role}` });
  if (m.role === "user") {
    if (m.context) wrap.append(h("span", { class: "context-tag" }, icon(m.context.icon || "info", "icon icon-sm"), m.context.label));
    wrap.append(h("div", { class: "bubble" }, m.display ?? m.content));
    return wrap;
  }
  if (m.thinking) {
    wrap.append(h("details", { class: "thinking" }, h("summary", {}, "Reasoning summary"), h("div", {}, m.thinking)));
  }
  const bubble = h("div", { class: `bubble${m.error ? " error" : ""}` });
  if (m.error) bubble.textContent = m.content;
  else setRich(bubble, m.content);
  wrap.append(bubble);
  if (!m.error) {
    wrap.append(h("div", { class: "msg-tools" },
      h("button", { class: "icon-btn", title: "Copy", "aria-label": "Copy response", onclick: () => copyText(m.content, "Response copied") }, icon("copy", "icon icon-sm"))));
  }
  return wrap;
}

function setRich(el, md) {
  // renderMarkdown escapes everything; DOMPurify is a second, allow-list layer.
  el.replaceChildren(sanitizeRichFragment(renderMarkdown(md)));
}

function scrollDown() {
  const c = $("#chat");
  c.scrollTop = c.scrollHeight;
}

// --- Sending -------------------------------------------------------------------------------

async function send(content, { display, context } = {}) {
  if (abort) return;
  content = content.trim();
  if (!content) return;
  $("#welcome").hidden = true;
  const userMsg = { role: "user", content, display, context };
  chat.messages.push(userMsg);
  if (chat.title === "New chat") chat.title = (display || content).slice(0, 60);
  $("#messages").append(messageEl(userMsg));

  const reply = { role: "assistant", content: "", thinking: "" };
  const wrap = h("div", { class: "msg assistant" });
  const thinkingEl = h("details", { class: "thinking", hidden: true }, h("summary", {}, "Reasoning…"), h("div", {}));
  const bubble = h("div", { class: "bubble cursor" }, h("span", { class: "muted" }, "Thinking…"));
  wrap.append(thinkingEl, bubble);
  $("#messages").append(wrap);
  scrollDown();

  abort = new AbortController();
  setSending(true);
  let raf = 0;
  const paint = () => {
    raf = 0;
    setRich(bubble, reply.content);
    const nearBottom = $("#chat").scrollHeight - $("#chat").scrollTop - $("#chat").clientHeight < 120;
    if (nearBottom) scrollDown();
  };
  try {
    const secrets = await getSecrets(["anthropicKey", "openaiKey", "geminiKey"]);
    const history = chat.messages.slice(-MAX_TURNS).filter((m) => !m.error).map((m) => ({ role: m.role, content: m.content }));
    for await (const ev of streamChat({ settings, secrets, system: SYSTEM_PROMPT, messages: history, signal: abort.signal })) {
      if (ev.type === "text") {
        reply.content += ev.text;
        if (!raf) raf = requestAnimationFrame(paint);
      } else if (ev.type === "thinking") {
        reply.thinking += ev.text;
        thinkingEl.hidden = false;
        thinkingEl.lastChild.textContent = reply.thinking;
      } else if (ev.type === "refusal") {
        reply.content += `${reply.content ? "\n\n" : ""}_${ev.message}_`;
      } else if (ev.type === "done" && ev.stopReason === "max_tokens") {
        reply.content += "\n\n_(Response truncated at the length limit.)_";
      }
    }
    if (raf) cancelAnimationFrame(raf);
    paint();
    bubble.classList.remove("cursor");
    if (!reply.content.trim()) reply.content = "_(No response.)_";
    chat.messages.push(reply);
    wrap.replaceWith(messageEl(reply));
  } catch (err) {
    if (raf) cancelAnimationFrame(raf);
    const aborted = err?.name === "AbortError" || /abort|stopped/i.test(err?.message || "");
    if (aborted && reply.content) {
      reply.content += "\n\n_(Stopped.)_";
      chat.messages.push(reply);
      wrap.replaceWith(messageEl(reply));
    } else {
      const msg = { role: "assistant", content: aborted ? "Stopped." : err.message, error: true };
      chat.messages.push(msg);
      const el = messageEl(msg);
      if (err instanceof AiConfigError || /api key|settings/i.test(err.message)) {
        el.append(h("button", { class: "btn btn-sm", onclick: () => api.tabs.create({ url: `${extensionUrl("options/options.html")}#ai` }) }, icon("settings", "icon icon-sm"), "Open AI settings"));
      }
      wrap.replaceWith(el);
    }
  } finally {
    abort = null;
    setSending(false);
    scrollDown();
    saveChat();
  }
}

function setSending(on) {
  const btn = $("#send");
  btn.classList.toggle("stop", on);
  btn.replaceChildren(icon(on ? "stop" : "send"));
  btn.title = on ? "Stop" : "Send (Enter)";
}

// --- Context-aware prompts -------------------------------------------------------------------

async function analyzePage(tabId) {
  try {
    const id = tabId ?? (await activeTab())?.id;
    const snap = await call("page:snapshot", { tabId: id });
    if (!settings.ai.sendPageContext) snap.text = "(Page text not shared. The user disabled page context in settings.)";
    await send(pageAnalysisPrompt(snap), { display: `Is this page safe? ${snap.url}`, context: { icon: "globe", label: new URL(snap.url).hostname } });
  } catch (err) {
    toast(err.message, "error");
  }
}

async function handlePending(pending) {
  if (!pending || Date.now() - pending.ts > 5 * 60 * 1000) return;
  await api.storage.session.remove(PENDING_KEY);
  if (abort) return;
  chat = newChatObject();
  renderAll();
  switch (pending.kind) {
    case "page":
      await analyzePage(pending.tabId);
      break;
    case "selection":
      await send(selectionPrompt(pending.text, pending.pageUrl), { display: `Explain: “${pending.text.slice(0, 160)}${pending.text.length > 160 ? "…" : ""}”`, context: { icon: "info", label: "Selected text" } });
      break;
    case "email":
      await send(emailAnalysisPrompt(pending), { display: `Is this e-mail phishing? “${pending.subject || "(no subject)"}” from ${pending.from}`, context: { icon: "mail", label: "Disposable inbox" } });
      break;
    case "file":
      await send(fileReportPrompt(pending.report), { display: `Explain the analysis of ${pending.report.name}`, context: { icon: "file-search", label: "Secure File Viewer" } });
      break;
    default:
      break;
  }
}

// --- History ---------------------------------------------------------------------------------

async function toggleHistory() {
  const panel = $("#history");
  if (!panel.hidden) {
    panel.hidden = true;
    return;
  }
  const chats = await loadChats();
  panel.replaceChildren(
    ...(chats.length ? chats.map((c) => h("div", { class: `item${c.id === chat.id ? " active" : ""}`, onclick: () => { chat = c; renderAll(); panel.hidden = true; } },
      h("div", { class: "grow" }, h("div", { class: "truncate small" }, c.title), h("div", { class: "tiny muted" }, `${timeAgo(c.updated)} · ${c.messages.length} messages`)),
      h("button", {
        class: "icon-btn", title: "Delete chat", "aria-label": "Delete chat",
        onclick: async (e) => {
          e.stopPropagation();
          const rest = (await loadChats()).filter((x) => x.id !== c.id);
          await api.storage.local.set({ [CHATS_KEY]: rest });
          if (chat.id === c.id) { chat = newChatObject(); renderAll(); }
          panel.hidden = true;
          toggleHistory();
        },
      }, icon("trash", "icon icon-sm")))) : [h("div", { class: "empty small" }, "No saved chats yet.")]),
    chats.length ? h("button", {
      class: "btn btn-sm btn-ghost btn-block",
      onclick: async () => {
        if (!confirm("Delete all saved chats?")) return;
        await api.storage.local.remove(CHATS_KEY);
        chat = newChatObject();
        renderAll();
        panel.hidden = true;
      },
    }, "Clear history") : null,
  );
  panel.hidden = false;
}

// --- Init ------------------------------------------------------------------------------------

async function init() {
  settings = await initTheme();
  hydrateIcons();
  $("#modelChip").textContent = modelLabel();
  onSettingsChanged((next) => {
    settings = next;
    $("#modelChip").textContent = modelLabel();
  });

  const input = $("#input");
  const autosize = () => {
    input.style.height = "auto";
    input.style.height = `${Math.min(200, input.scrollHeight)}px`;
  };
  input.addEventListener("input", autosize);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      $("#form").requestSubmit();
    }
  });
  $("#form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (abort) {
      abort.abort();
      return;
    }
    const text = input.value;
    input.value = "";
    autosize();
    send(text);
  });
  $("#newChat").addEventListener("click", () => {
    abort?.abort();
    chat = newChatObject();
    renderAll();
    input.focus();
  });
  $("#historyBtn").addEventListener("click", toggleHistory);
  $("#modelChip").addEventListener("click", () => api.tabs.create({ url: `${extensionUrl("options/options.html")}#ai` }));
  for (const btn of $$(".suggest")) {
    btn.addEventListener("click", () => {
      if (btn.dataset.action === "page") return analyzePage();
      input.value = btn.dataset.prompt;
      autosize();
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    });
  }

  renderAll();
  const { [PENDING_KEY]: pending } = await api.storage.session.get(PENDING_KEY);
  if (pending) handlePending(pending);
  api.storage.onChanged.addListener((changes, area) => {
    if (area === "session" && changes[PENDING_KEY]?.newValue) handlePending(changes[PENDING_KEY].newValue);
  });
  input.focus();
}

init().catch((err) => {
  console.error(err);
  toast(err.message, "error");
});
