// Context menu integrations.
import { api, extensionUrl, isFirefox, isRestrictedUrl } from "../lib/browser.js";
import { ensureActiveMailbox } from "../lib/mailboxes.js";
import { logEvent } from "../lib/events.js";

const menus = api.contextMenus ?? api.menus;
const PENDING_AI_KEY = "nv.pendingAiPrompt";

export function createMenus() {
  if (!menus) return;
  menus.removeAll(() => {
    menus.create({ id: "nv-open-rbi", title: "Open link in Disposable Browser", contexts: ["link"] });
    menus.create({ id: "nv-check-link", title: "Check link safety", contexts: ["link"] });
    menus.create({ id: "nv-analyze-file", title: "Analyze link target in Secure File Viewer", contexts: ["link"] });
    menus.create({ id: "nv-sep-1", type: "separator", contexts: ["link"] });
    menus.create({ id: "nv-fill-email", title: "Insert disposable e-mail address", contexts: ["editable"] });
    menus.create({ id: "nv-ask-ai", title: "Ask NULL VOID AI about “%s”", contexts: ["selection"] });
    menus.create({ id: "nv-analyze-page", title: "Analyze this page with NULL VOID AI", contexts: ["page"] });
  });
}

// sidePanel.open()/sidebarAction.open() only work while the click's user
// gesture is still active, so they are called before anything is awaited. The
// assistant picks up the pending prompt on load or via storage.onChanged.
function openAssistant(tab, prompt) {
  const saved = api.storage.session.set({ [PENDING_AI_KEY]: { ...prompt, ts: Date.now() } });
  const fallback = () => api.tabs.create({ url: extensionUrl("assistant/assistant.html") });
  if (api.sidePanel?.open && tab?.windowId != null) {
    api.sidePanel.open({ windowId: tab.windowId }).catch(fallback);
  } else if (isFirefox && api.sidebarAction?.open) {
    api.sidebarAction.open().catch(fallback);
  } else {
    fallback();
  }
  return saved;
}

async function fillEmail(tab, frameId) {
  const box = await ensureActiveMailbox();
  await api.scripting.executeScript({
    target: { tabId: tab.id, frameIds: [frameId ?? 0] },
    args: [box.address],
    func: (address) => {
      const el = document.activeElement;
      if (!el) return false;
      if (el.isContentEditable) {
        document.execCommand("insertText", false, address);
        return true;
      }
      if ("value" in el) {
        const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
        setter ? setter.call(el, address) : (el.value = address);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }
      return false;
    },
  });
  await logEvent({ type: "email-fill", severity: "info", title: `Inserted ${box.address}`, url: tab.url });
}

menus?.onClicked.addListener(async (info, tab) => {
  try {
    switch (info.menuItemId) {
      case "nv-open-rbi":
        await api.tabs.create({ url: `${extensionUrl("rbi/rbi.html")}?url=${encodeURIComponent(info.linkUrl)}` });
        break;
      case "nv-check-link":
        await api.tabs.create({ url: `${extensionUrl("blocked/blocked.html")}?mode=link&url=${encodeURIComponent(info.linkUrl)}` });
        break;
      case "nv-analyze-file":
        await api.tabs.create({ url: `${extensionUrl("viewer/viewer.html")}?url=${encodeURIComponent(info.linkUrl)}` });
        break;
      case "nv-fill-email":
        if (tab && !isRestrictedUrl(tab.url)) await fillEmail(tab, info.frameId);
        break;
      case "nv-ask-ai":
        await openAssistant(tab, { kind: "selection", text: info.selectionText, pageUrl: info.pageUrl });
        break;
      case "nv-analyze-page":
        await openAssistant(tab, { kind: "page", tabId: tab?.id, pageUrl: info.pageUrl });
        break;
      default:
        break;
    }
  } catch (err) {
    console.warn("[NULL VOID] context menu action failed", err);
  }
});
