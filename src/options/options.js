import { api, ensureDataConsent } from "../lib/browser.js";
import { getSettings, updateSettings, saveSettings, migrate, onSettingsChanged } from "../lib/settings.js";
import { getSecret, setSecret, getSecrets } from "../lib/vault.js";
import { call } from "../lib/messaging.js";
import { $, $$, h, icon, hydrateIcons, toast, initTheme, timeAgo, debounce } from "../lib/ui.js";
import { ANTHROPIC_MODELS } from "../lib/ai/models.js";
import { CdpConnection, resolveBrowserEndpoint, browserlessEndpoint } from "../lib/cdp-client.js";
import { registrableDomain, normalizeHost } from "../lib/domain.js";

let settings;

const getPath = (obj, path) => path.split(".").reduce((o, k) => o?.[k], obj);
function patchFor(path, value) {
  const keys = path.split(".");
  const patch = {};
  let cur = patch;
  keys.forEach((k, i) => {
    cur[k] = i === keys.length - 1 ? value : {};
    cur = cur[k];
  });
  return patch;
}

// --- Navigation -------------------------------------------------------------------

function showSection() {
  const id = (location.hash || "#welcome").slice(1);
  const target = document.getElementById(id) ? id : "welcome";
  for (const s of $$(".section")) s.hidden = s.id !== target;
  for (const a of $$("#nav a")) {
    if (a.dataset.section === target) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
  if (target === "activity") renderActivity();
  if (target === "email") renderInboxes();
  if (target === "protection") renderRulesetInfo();
  window.scrollTo(0, 0);
}

// --- Generic setting binding --------------------------------------------------------

function readInput(el) {
  if (el.type === "checkbox") return el.checked;
  if (el.type === "number" || el.type === "range" || el.dataset.type === "number") return Number(el.value);
  return el.value.trim();
}

function writeInput(el, value) {
  if (el.type === "checkbox") el.checked = Boolean(value);
  else el.value = value ?? "";
  const out = $(`output[data-output="${el.dataset.setting}"]`);
  if (out) out.textContent = el.value;
}

function refreshBindings() {
  for (const el of $$("[data-setting]")) {
    if (document.activeElement !== el) writeInput(el, getPath(settings, el.dataset.setting));
  }
  for (const el of $$("[data-show]")) {
    const [path, val] = el.dataset.show.split("=");
    el.hidden = String(getPath(settings, path)) !== val;
  }
}

function bindSettings() {
  for (const el of $$("[data-setting]")) {
    const save = async () => {
      let value = readInput(el);
      if (el.type === "number") {
        const min = Number(el.min || -Infinity), max = Number(el.max || Infinity);
        value = Math.min(max, Math.max(min, value || min));
      }
      settings = await updateSettings(patchFor(el.dataset.setting, value));
      refreshBindings();
      toast("Saved", "success", 1200);
    };
    if (el.type === "checkbox") {
      el.addEventListener("change", async () => {
        // Firefox data-collection consent must be requested inside the gesture.
        if (el.checked && el.dataset.consent && !(await ensureDataConsent(el.dataset.consent))) {
          el.checked = false;
          toast("Permission was not granted", "warn");
          return;
        }
        save();
      });
    } else if (el.type === "range") {
      el.addEventListener("input", () => { $(`output[data-output="${el.dataset.setting}"]`).textContent = el.value; });
      el.addEventListener("change", save);
    } else if (el.tagName === "SELECT") {
      el.addEventListener("change", save);
    } else {
      el.addEventListener("change", save);
    }
  }
}

// --- Secrets ---------------------------------------------------------------------------

async function buildSecrets() {
  for (const box of $$(".secret[data-secret]")) {
    const name = box.dataset.secret;
    const input = h("input", { type: "password", autocomplete: "off", spellcheck: "false", placeholder: "Paste key…", "aria-label": `${name}` });
    const state = h("span", { class: "state muted" });
    const show = h("button", { class: "icon-btn", type: "button", title: "Show / hide", "aria-label": "Show or hide key" }, icon("eye"));
    const saveBtn = h("button", { class: "btn btn-sm btn-primary", type: "button" }, "Save");
    const clearBtn = h("button", { class: "btn btn-sm btn-ghost", type: "button" }, "Remove");
    const parts = [input, show, saveBtn, clearBtn];
    if (box.dataset.test) {
      parts.push(h("button", {
        class: "btn btn-sm", type: "button",
        onclick: async (e) => {
          e.target.disabled = true;
          try {
            const r = await call("intel:testKey", { service: box.dataset.test });
            toast(r.detail, "success");
          } catch (err) {
            toast(err.message, "error");
          } finally {
            e.target.disabled = false;
          }
        },
      }, "Test"));
    }
    box.replaceChildren(...parts, state);
    const refresh = async () => {
      const val = await getSecret(name);
      state.textContent = val ? `Saved · ends in …${val.slice(-4)}` : "Not set";
      input.value = "";
      input.placeholder = val ? "•••••••••••• (saved, paste to replace)" : "Paste key…";
    };
    show.addEventListener("click", async () => {
      if (input.type === "password") {
        input.type = "text";
        if (!input.value) input.value = await getSecret(name);
      } else {
        input.type = "password";
      }
    });
    saveBtn.addEventListener("click", async () => {
      const v = input.value.trim();
      if (!v) return toast("Paste a key first", "warn");
      if (/\s/.test(v)) return toast("Keys can't contain spaces", "error");
      await setSecret(name, v);
      input.type = "password";
      await refresh();
      toast("Key saved (encrypted on this device)", "success");
    });
    clearBtn.addEventListener("click", async () => {
      await setSecret(name, "");
      await refresh();
      toast("Key removed", "success");
    });
    await refresh();
  }
}

// --- Domain lists ------------------------------------------------------------------------

function renderDomainLists() {
  const render = (listEl, domains, action) => {
    listEl.replaceChildren(...(domains.length ? domains.map((d) => h("span", { class: "chip" }, d,
      h("button", { type: "button", title: `Remove ${d}`, "aria-label": `Remove ${d}`, onclick: () => action(d, false) }, icon("x", "icon icon-sm")))) : [h("span", { class: "muted small" }, "None")]));
  };
  render($("#trustedList"), settings.protection.trustedSites, (d, on) => call("protection:setTrusted", { host: d, trusted: on }));
  render($("#blockedList"), settings.protection.blockedSites, (d, on) => call("protection:setBlocked", { host: d, blocked: on }));
}

function parseDomain(input) {
  const raw = input.trim();
  if (!raw) return null;
  try {
    const host = /^[a-z]+:\/\//i.test(raw) ? new URL(raw).hostname : raw.split("/")[0];
    const n = normalizeHost(host);
    return /^[a-z0-9.-]+\.[a-z0-9-]{2,}$/i.test(n) ? registrableDomain(n) : null;
  } catch {
    return null;
  }
}

function bindDomainForms() {
  const bind = (formSel, inputSel, action) => {
    $(formSel).addEventListener("submit", async (e) => {
      e.preventDefault();
      const d = parseDomain($(inputSel).value);
      if (!d) return toast("Enter a valid domain like example.com", "error");
      await action(d);
      $(inputSel).value = "";
    });
  };
  bind("#trustedForm", "#trustedInput", (d) => call("protection:setTrusted", { host: d, trusted: true }));
  bind("#blockedForm", "#blockedInput", (d) => call("protection:setBlocked", { host: d, blocked: true }));
}

async function renderRulesetInfo() {
  try {
    const st = await call("protection:status", {});
    const n = st.availableStaticRules;
    $("#rulesetInfo").textContent = `Active rulesets: ${st.rulesets.join(", ") || "none"}${n != null ? ` · ${n.toLocaleString()} static rules of headroom left` : ""}.`;
  } catch { /* ignore */ }
}

// --- RBI ---------------------------------------------------------------------------------

async function testRbi() {
  const out = $("#rbiTestResult");
  out.replaceChildren(h("span", { class: "spinner" }), " Connecting…");
  try {
    let ws;
    if (settings.rbi.provider === "browserless") {
      const token = await getSecret("rbiToken");
      if (!token) throw new Error("Save a Browserless token first.");
      ws = browserlessEndpoint({ region: settings.rbi.region, token, timeoutMs: 60000 });
    } else {
      ws = await resolveBrowserEndpoint(settings.rbi.customEndpoint);
    }
    const t0 = performance.now();
    const conn = await CdpConnection.connect(ws);
    const v = await conn.send("Browser.getVersion");
    const ms = Math.round(performance.now() - t0);
    conn.close();
    out.textContent = `✓ Connected to ${v.product} in ${ms} ms`;
    toast("Remote browser reachable", "success");
  } catch (err) {
    out.textContent = `✗ ${err.message}`;
    toast(err.message, "error");
  }
}

// --- AI ----------------------------------------------------------------------------------

async function loadModels(provider) {
  try {
    const { listModels } = await import("../lib/ai/providers.js");
    const secrets = await getSecrets(["openaiKey", "geminiKey"]);
    const models = await listModels(provider, provider === "openai"
      ? { baseUrl: settings.ai.openaiBaseUrl, apiKey: secrets.openaiKey }
      : { apiKey: secrets.geminiKey });
    const dl = $(provider === "openai" ? "#openaiModels" : "#geminiModels");
    dl.replaceChildren(...models.map((m) => h("option", { value: m })));
    toast(`${models.length} models available — start typing in the Model field`, "success");
  } catch (err) {
    toast(`Could not list models: ${err.message}`, "error");
  }
}

async function testAi() {
  const out = $("#aiTestResult");
  out.replaceChildren(h("span", { class: "spinner" }), " Waiting for a reply…");
  try {
    const { streamChat } = await import("../lib/ai/providers.js");
    const secrets = await getSecrets(["anthropicKey", "openaiKey", "geminiKey"]);
    let text = "";
    for await (const ev of streamChat({
      settings: { ...settings, ai: { ...settings.ai, effort: "low" } },
      secrets,
      system: "You are a connectivity test. Reply with one short sentence.",
      messages: [{ role: "user", content: "Say hello to the NULL VOID user in under ten words." }],
    })) {
      if (ev.type === "text") text += ev.text;
      if (ev.type === "done") text += ev.model ? `  (${ev.model})` : "";
    }
    out.textContent = `✓ ${text.trim()}`;
  } catch (err) {
    out.textContent = `✗ ${err.message}`;
  }
}

// --- Email -------------------------------------------------------------------------------

async function renderInboxes() {
  const list = $("#inboxList");
  try {
    const state = await call("email:state");
    if (!state.boxes.length) {
      list.replaceChildren(h("div", { class: "empty" }, icon("mail"), "No inboxes yet."));
      return;
    }
    list.replaceChildren(...state.boxes.map((b) => h("div", { class: "list-item" },
      h("span", { class: `dot ${b.error ? "warn" : "ok"}` }),
      h("div", { class: "grow" },
        h("div", { class: "mono truncate" }, b.address, b.id === state.active ? h("span", { class: "badge badge-low", style: { marginLeft: "8px" } }, "active") : null),
        h("div", { class: "tiny muted" }, `created ${timeAgo(b.createdAt)} · ${b.total || 0} messages${b.unread ? ` · ${b.unread} unread` : ""}${b.error ? ` · ${b.error}` : ""}`)),
      h("button", { class: "btn btn-sm", onclick: () => api.tabs.create({ url: api.runtime.getURL(`inbox/inbox.html?box=${b.id}`) }) }, "Open"),
      h("button", {
        class: "icon-btn", title: "Delete inbox", "aria-label": `Delete ${b.address}`,
        onclick: async () => {
          if (!confirm(`Delete ${b.address}? Its messages are removed permanently.`)) return;
          await call("email:delete", { id: b.id });
          renderInboxes();
        },
      }, icon("trash")))));
  } catch (err) {
    list.replaceChildren(h("p", { class: "muted card-pad" }, err.message));
  }
}

// --- Activity ----------------------------------------------------------------------------

let allEvents = [];
async function renderActivity() {
  const [stats, events] = await Promise.all([call("stats:get"), call("events:list", { limit: 500 })]);
  allEvents = events;
  const cards = [
    ["Threats blocked", (stats.heuristicBlocks || 0) + (stats.listBlocks || 0) + (stats.intelBlocks || 0) + (stats.customBlocks || 0)],
    ["Look-alike sites", stats.heuristicBlocks || 0],
    ["Phishing warnings", stats.pageWarnings || 0],
    ["Risky downloads", stats.downloadsFlagged || 0],
    ["Warnings overridden", stats.warningsOverridden || 0],
  ];
  $("#statGrid").replaceChildren(...cards.map(([label, n]) => h("div", { class: "card stat" }, h("span", { class: "muted small" }, label), h("strong", {}, n.toLocaleString()))));
  renderEvents();
}

function renderEvents() {
  const q = $("#eventFilter").value.trim().toLowerCase();
  const rows = allEvents.filter((e) => !q || `${e.title} ${e.url || ""} ${e.detail || ""} ${e.type}`.toLowerCase().includes(q));
  $("#eventList").replaceChildren(...(rows.length ? rows.map((e) => h("div", { class: "event" },
    h("div", { class: "when", title: new Date(e.ts).toLocaleString() }, timeAgo(e.ts)),
    h("div", { class: "what" }, h("div", {}, e.title), e.url ? h("div", { class: "url" }, e.url) : null, e.detail ? h("div", { class: "detail" }, e.detail) : null),
    h("span", { class: `badge badge-${e.severity}` }, e.severity))) : [h("div", { class: "empty" }, icon("activity"), "No events yet.")]));
}

function download(name, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = h("a", { href: URL.createObjectURL(blob), download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// --- Init ---------------------------------------------------------------------------------

async function init() {
  settings = await initTheme();
  hydrateIcons();
  $("#version").textContent = `Version ${api.runtime.getManifest().version}`;
  $("#extOrigin").textContent = new URL(api.runtime.getURL("")).origin;
  $("#anthropicModel").replaceChildren(...ANTHROPIC_MODELS.map((m) => h("option", { value: m.id }, m.label)));
  refreshBindings();
  bindSettings();
  await buildSecrets();
  renderDomainLists();
  bindDomainForms();

  onSettingsChanged((next) => {
    settings = next;
    refreshBindings();
    renderDomainLists();
  });

  $("#rbiTest").addEventListener("click", testRbi);
  $("#aiTest").addEventListener("click", testAi);
  for (const b of $$("[data-load-models]")) b.addEventListener("click", () => loadModels(b.dataset.loadModels));
  $("#newInbox").addEventListener("click", async () => {
    try {
      await call("email:create");
      renderInboxes();
      toast("Inbox created", "success");
    } catch (err) {
      toast(err.message, "error");
    }
  });
  $("#eventFilter").addEventListener("input", debounce(renderEvents, 150));
  $("#exportEvents").addEventListener("click", () => download(`nullvoid-activity-${Date.now()}.json`, allEvents));
  $("#clearEvents").addEventListener("click", async () => {
    if (!confirm("Clear the activity log and counters?")) return;
    await call("events:clear");
    renderActivity();
  });
  $("#exportSettings").addEventListener("click", async () => download(`nullvoid-settings-${Date.now()}.json`, await getSettings()));
  $("#importSettings").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      settings = await saveSettings(migrate(data));
      refreshBindings();
      renderDomainLists();
      toast("Settings imported", "success");
    } catch (err) {
      toast(`Import failed: ${err.message}`, "error");
    }
    e.target.value = "";
  });
  $("#wipeData").addEventListener("click", async () => {
    if (!confirm("Delete ALL NULL VOID data? This cannot be undone.")) return;
    if (!confirm("Really delete everything, including your disposable inboxes?")) return;
    await call("data:wipe", { deleteRemoteMailboxes: true });
    toast("All data deleted", "success");
    setTimeout(() => location.reload(), 800);
  });

  try {
    const cmds = await api.commands.getAll();
    $("#shortcuts").replaceChildren(...cmds.filter((c) => c.description || c.name === "_execute_action").map((c) =>
      h("div", {}, h("span", {}, c.description || "Open the NULL VOID popup"), h("span", { class: "kbd" }, c.shortcut || "not set"))));
  } catch { /* unsupported */ }

  window.addEventListener("hashchange", showSection);
  showSection();
}

init().catch((err) => {
  console.error(err);
  toast(`Failed to load settings: ${err.message}`, "error");
});
