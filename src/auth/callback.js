// Receives the sign-in token from the NULL VOID website. The site redirects
// here with ?token=…&user=… (URL-encoded JSON), or posts an AUTH_SUCCESS
// message from one of its own origins.
import { call } from "../lib/messaging.js";
import { initTheme } from "../lib/ui.js";

const ALLOWED_ORIGINS = ["https://nullvoid.zone.id", "https://nullvoids.live", "https://nullvoidweb.vercel.app"];

const $ = (id) => document.getElementById(id);

function done(ok, message) {
  $("title").textContent = ok ? "You're signed in" : "Sign-in failed";
  $("message").textContent = message;
  $("close").hidden = false;
  if (ok) setTimeout(() => window.close(), 2500);
}

async function complete(token, user, domain) {
  try {
    const { profile } = await call("auth:complete", { token, user, domain });
    done(true, `Welcome${profile?.name ? `, ${profile.name}` : ""}! You can close this tab.`);
  } catch (err) {
    done(false, err.message);
  }
}

async function init() {
  await initTheme();
  $("close").addEventListener("click", () => window.close());
  if (window.top !== window) return done(false, "Sign-in cannot run inside a frame.");

  const params = new URLSearchParams(location.search);
  const hash = new URLSearchParams(location.hash.slice(1));
  const error = params.get("error") || hash.get("error");
  if (error) return done(false, error.slice(0, 200));
  const token = hash.get("token") || params.get("token");
  if (token) {
    let user = null;
    try {
      user = JSON.parse(hash.get("user") || params.get("user") || "null");
    } catch { /* ignore */ }
    // Remove the token from the address bar/history right away.
    history.replaceState(null, "", location.pathname);
    const ref = document.referrer ? new URL(document.referrer).origin : null;
    return complete(token, user, ALLOWED_ORIGINS.includes(ref) ? ref : null);
  }

  window.addEventListener("message", (event) => {
    if (!ALLOWED_ORIGINS.includes(event.origin)) return;
    if (event.data?.type === "AUTH_SUCCESS" && typeof event.data.token === "string") complete(event.data.token, event.data.user, event.origin);
    else if (event.data?.type === "AUTH_ERROR") done(false, String(event.data.error || "Authentication failed").slice(0, 200));
  });
  setTimeout(() => {
    if ($("close").hidden) done(false, "No sign-in information was received.");
  }, 15000);
}

init();
