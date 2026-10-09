// Small DOM helpers shared by extension pages. `h()` builds elements with
// textContent, never innerHTML, so untrusted strings cannot inject markup.
import { api } from "./browser.js";
import { getSettings, onSettingsChanged } from "./settings.js";

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/**
 * h("div", { class: "x", onclick: fn, dataset: { id: 1 } }, "text", childNode)
 */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "dataset") Object.assign(el.dataset, v);
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k === "html") throw new Error("h(): raw HTML is not allowed");
    else if (v === true) el.setAttribute(k, "");
    else el.setAttribute(k, String(v));
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

const SVG_NS = "http://www.w3.org/2000/svg";
/** <svg class="icon"><use href="../ui/icons.svg#name"></svg> */
export function icon(name, cls = "icon") {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", cls);
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS(SVG_NS, "use");
  use.setAttribute("href", `${api.runtime.getURL("ui/icons.svg")}#${name}`);
  svg.appendChild(use);
  return svg;
}

/** Replace <i data-icon="name"> placeholders in static HTML. */
export function hydrateIcons(root = document) {
  for (const el of root.querySelectorAll("i[data-icon]")) {
    el.replaceWith(icon(el.dataset.icon, el.className || "icon"));
  }
}

let toastBox;
const TOAST_ICON = { success: "check", error: "shield-alert", warn: "info", info: "info" };

/**
 * Transient notification. Errors are announced assertively and stay longer;
 * every type carries an icon so meaning never depends on colour alone.
 */
export function toast(message, type = "info", ms) {
  if (!toastBox) {
    toastBox = h("div", { class: "toasts" });
    document.body.appendChild(toastBox);
  }
  const duration = ms ?? (type === "error" ? 6000 : 3500);
  const t = h("div", { class: `toast ${type}`, role: type === "error" ? "alert" : "status", title: "Click to dismiss" },
    icon(TOAST_ICON[type] || "info", "icon icon-sm toast-icon"), h("span", { class: "grow" }, message));
  const dismiss = () => {
    if (!t.isConnected || t.classList.contains("leaving")) return;
    t.classList.add("leaving");
    setTimeout(() => t.remove(), 140);
  };
  t.addEventListener("click", dismiss);
  toastBox.appendChild(t);
  setTimeout(dismiss, duration);
}

export async function copyText(text, label = "Copied") {
  try {
    await navigator.clipboard.writeText(text);
    toast(`${label} to clipboard`, "success", 2000);
    return true;
  } catch {
    toast("Clipboard access was denied", "error");
    return false;
  }
}

export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === "light" || theme === "dark") root.dataset.theme = theme;
  else delete root.dataset.theme;
}

export function effectiveTheme() {
  const t = document.documentElement.dataset.theme;
  if (t) return t;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Apply the saved theme now and whenever it changes. */
export async function initTheme() {
  const s = await getSettings();
  applyTheme(s.ui.theme);
  onSettingsChanged((next) => applyTheme(next.ui.theme));
  return s;
}

export function formatBytes(n) {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i ? 1 : 0)} ${u[i]}`;
}

export function timeAgo(ts) {
  const d = (Date.now() - new Date(ts).getTime()) / 1000;
  if (!Number.isFinite(d)) return "";
  if (d < 45) return "just now";
  if (d < 3600) return `${Math.round(d / 60)}m ago`;
  if (d < 86400) return `${Math.round(d / 3600)}h ago`;
  if (d < 604800) return `${Math.round(d / 86400)}d ago`;
  return new Date(ts).toLocaleDateString();
}

export const LEVEL_LABEL = { safe: "Safe", low: "Low risk", suspicious: "Suspicious", dangerous: "Dangerous" };

export function levelBadge(level, extra = "") {
  return h("span", { class: `badge badge-${level}` }, LEVEL_LABEL[level] || level, extra ? ` ${extra}` : "");
}

export async function activeTab() {
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  return tab;
}

export function openPage(path, params) {
  const url = api.runtime.getURL(path) + (params ? `?${new URLSearchParams(params)}` : "");
  return api.tabs.create({ url });
}

export function debounce(fn, ms = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
