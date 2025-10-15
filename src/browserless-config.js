// Browserless.io configuration loader
// Supports runtime overrides via .env files, injected globals, or process.env

(function initBrowserlessConfig() {
  const globalScope = typeof globalThis !== "undefined" ? globalThis : window;

  const defaultConfig = {
    apiKey: "",
    baseUrl: "https://production-sfo.browserless.io",
    wsUrl: "wss://production-sfo.browserless.io",
    workspaceUrl: "https://chrome.browserless.io",
    timeout: 30000,
    maxRetries: 3,
    endpoints: {
      screenshot: "/screenshot",
      content: "/content",
      pdf: "/pdf",
      function: "/function",
      scrape: "/scrape",
      version: "/json/version",
    },
    defaultOptions: {
      screenshot: {
        type: "png",
        quality: 90,
        fullPage: false,
      },
      gotoOptions: {
        waitUntil: "networkidle2",
        timeout: 30000,
      },
    },
  };

  function parseEnvContent(content) {
    const overrides = {};

    if (!content) {
      return overrides;
    }

    const lines = content.split(/\r?\n/);

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) {
        continue;
      }

      const separatorIndex = line.indexOf("=");
      if (separatorIndex === -1) {
        continue;
      }

      const key = line.slice(0, separatorIndex).trim();
      let value = line.slice(separatorIndex + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      overrides[key] = value;
    }

    return overrides;
  }

  async function tryFetch(path) {
    try {
      const response = await fetch(path, { cache: "no-store" });
      if (!response.ok) {
        return null;
      }
      const text = await response.text();
      return parseEnvContent(text);
    } catch (error) {
      console.warn("[Browserless Config] Failed to fetch", path, error.message);
      return null;
    }
  }

  async function loadEnvOverrides() {
    const overrides = {};

    const injected = globalScope.__BROWSERLESS_ENV__;
    if (injected && typeof injected === "object") {
      Object.assign(overrides, injected);
    }

    if (typeof process !== "undefined" && process.env) {
      const envKey = process.env.BROWSERLESS_API_KEY;
      const envBase = process.env.BROWSERLESS_BASE_URL;
      const envWs = process.env.BROWSERLESS_WS_URL;
      if (envKey) {
        overrides.BROWSERLESS_API_KEY = envKey;
      }
      if (envBase) {
        overrides.BROWSERLESS_BASE_URL = envBase;
      }
      if (envWs) {
        overrides.BROWSERLESS_WS_URL = envWs;
      }
    }

    const candidatePaths = [];
    try {
      if (
        typeof chrome !== "undefined" &&
        chrome.runtime &&
        chrome.runtime.getURL
      ) {
        candidatePaths.push(chrome.runtime.getURL(".env"));
      }
    } catch (error) {
      console.warn(
        "[Browserless Config] Unable to resolve chrome extension path",
        error.message
      );
    }

    candidatePaths.push(".env", "/.env", "../.env");

    for (const path of candidatePaths) {
      if (!path || overrides.__source === path) {
        continue;
      }

      const result = await tryFetch(path);
      if (result && Object.keys(result).length > 0) {
        Object.assign(overrides, result, { __source: path });
        break;
      }
    }

    return overrides;
  }

  function applyOverrides(config, overrides) {
    if (!overrides) {
      return config;
    }

    const apiKey = (
      overrides.BROWSERLESS_API_KEY ||
      overrides.browserless_api_key ||
      ""
    ).trim();
    const baseUrl = (
      overrides.BROWSERLESS_BASE_URL ||
      overrides.browserless_base_url ||
      ""
    ).trim();
    const wsUrl = (
      overrides.BROWSERLESS_WS_URL ||
      overrides.browserless_ws_url ||
      ""
    ).trim();
    const workspaceUrl = (
      overrides.BROWSERLESS_WORKSPACE_URL ||
      overrides.browserless_workspace_url ||
      ""
    ).trim();
    if (apiKey) {
      config.apiKey = apiKey;
    }
    if (baseUrl) {
      config.baseUrl = baseUrl;
    }
    if (wsUrl) {
      config.wsUrl = wsUrl;
    }
    if (workspaceUrl) {
      config.workspaceUrl = workspaceUrl;
    }
    return config;
  }

  const configPromise = (async () => {
    const overrides = await loadEnvOverrides();
    return applyOverrides({ ...defaultConfig }, overrides);
  })()
    .catch((error) => {
      console.warn(
        "[Browserless Config] Using default configuration",
        error.message
      );
      return { ...defaultConfig };
    })
    .then((resolvedConfig) => {
      Object.assign(defaultConfig, resolvedConfig);
      if (!defaultConfig.apiKey) {
        console.warn(
          "[Browserless Config] No Browserless API key detected. Set BROWSERLESS_API_KEY in your .env file."
        );
      }
      return defaultConfig;
    });

  globalScope.BROWSERLESS_CONFIG = defaultConfig;
  globalScope.BROWSERLESS_CONFIG_PROMISE = configPromise;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      BROWSERLESS_CONFIG: defaultConfig,
      BROWSERLESS_CONFIG_PROMISE: configPromise,
    };
  }
})();
