// Optional NULL VOID account sign-in. The website redirects to
// auth/callback.html, which hands the token to this module.
import { api } from "../lib/browser.js";
import { getRecord, setRecord, deleteRecord } from "../lib/vault.js";
import { broadcast } from "../lib/messaging.js";
import { handle } from "./router.js";

export const AUTH_DOMAINS = ["https://nullvoid.zone.id", "https://nullvoids.live", "https://nullvoidweb.vercel.app"];
const PROFILE_KEY = "nv.auth.profile";

function cleanProfile(user) {
  if (!user || typeof user !== "object") return null;
  const str = (v, max = 120) => (typeof v === "string" ? v.slice(0, max) : "");
  const avatar = str(user.avatar, 500);
  return {
    name: str(user.name) || str(user.username) || "User",
    email: str(user.email),
    avatar: /^https:\/\//i.test(avatar) ? avatar : "",
  };
}

handle("auth:complete", async ({ token, user, domain }) => {
  if (typeof token !== "string" || token.length < 10 || token.length > 4096) throw new Error("Invalid token");
  const origin = AUTH_DOMAINS.includes(domain) ? domain : AUTH_DOMAINS[0];
  await setRecord("auth", { token, domain: origin, ts: Date.now() });
  const profile = cleanProfile(user);
  await api.storage.local.set({ [PROFILE_KEY]: profile });
  broadcast("auth:changed", { profile });
  return { profile };
});

handle("auth:state", async () => {
  const auth = await getRecord("auth");
  const { [PROFILE_KEY]: profile = null } = await api.storage.local.get(PROFILE_KEY);
  return { signedIn: Boolean(auth?.token), profile, domain: auth?.domain || AUTH_DOMAINS[0] };
});

handle("auth:logout", async () => {
  const auth = await getRecord("auth");
  if (auth?.token) {
    fetch(`${auth.domain}/api/auth/logout`, { method: "POST", headers: { Authorization: `Bearer ${auth.token}` } }).catch(() => {});
  }
  await deleteRecord("auth");
  await api.storage.local.remove(PROFILE_KEY);
  broadcast("auth:changed", { profile: null });
  return { ok: true };
});
