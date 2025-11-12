/*
 * Quick sanity check for VirusTotal integration logic by stubbing fetch responses.
 */

// Stub extension globals so requiring the content script does not crash in Node.
global.browser = {
  storage: {
    local: {
      async get() {
        return {};
      },
    },
    onChanged: {
      addListener() {},
    },
  },
};

global.chrome = global.browser;

global.document = {
  readyState: "loading",
  addEventListener() {},
};

global.window = {};

global.fetch = async () => {
  throw new Error("Test fetch handler not initialised");
};

const { VirusTotalAPI } = require("../src/smart-prevention-system.js");

// Skip waiting in poll logic to keep the test fast.
VirusTotalAPI.delay = () => Promise.resolve();

function createResponse(status, body) {
  return {
    status,
    ok: status >= 200 && status < 300,
    async json() {
      return body;
    },
  };
}

async function runSuccessfulScanScenario() {
  const urlToScan = "http://malicious.example";
  const encodedUrl = VirusTotalAPI.encodeUrl(urlToScan);

  const sequence = [
    {
      match: (url, options = {}) =>
        url.endsWith(`/urls/${encodedUrl}`) &&
        (!options.method || options.method === "GET"),
      response: createResponse(404),
    },
    {
      match: (url, options = {}) =>
        url.endsWith("/urls") && options.method === "POST",
      response: createResponse(200, { data: { id: "analysis-1" } }),
    },
    {
      match: (url) => url.endsWith("/analyses/analysis-1"),
      response: createResponse(200, {
        data: {
          attributes: { status: "queued" },
        },
      }),
    },
    {
      match: (url) => url.endsWith("/analyses/analysis-1"),
      response: createResponse(200, {
        data: {
          attributes: {
            status: "completed",
            stats: {
              malicious: 2,
              suspicious: 1,
              harmless: 35,
              undetected: 3,
            },
          },
        },
      }),
    },
  ];

  global.fetch = async (url, options) => {
    if (!sequence.length) {
      throw new Error(`Unexpected fetch call for ${url}`);
    }

    const next = sequence.shift();
    if (!next.match(url, options)) {
      throw new Error(`Fetch matcher did not align for ${url}`);
    }

    return next.response;
  };

  const result = await VirusTotalAPI.scanUrl(urlToScan);

  if (
    !result.isMalicious ||
    result.detections !== 3 ||
    result.totalEngines !== 41
  ) {
    throw new Error(
      `Scan result did not match expectations: ${JSON.stringify(result)}`
    );
  }

  if (!sequence.length) {
    console.log("[TEST] Successful scan scenario: PASS");
  } else {
    throw new Error("Not all mocked fetch calls were consumed");
  }
}

async function runPendingScanScenario() {
  const urlToScan = "http://pending.example";
  const encodedUrl = VirusTotalAPI.encodeUrl(urlToScan);

  const sequence = [
    {
      match: (url, options = {}) =>
        url.endsWith(`/urls/${encodedUrl}`) &&
        (!options.method || options.method === "GET"),
      response: createResponse(404),
    },
    {
      match: (url, options = {}) =>
        url.endsWith("/urls") && options.method === "POST",
      response: createResponse(200, { data: { id: "analysis-pending" } }),
    },
    // Provide multiple queued statuses to exhaust polling attempts
    ...Array.from({ length: 6 }, () => ({
      match: (url) => url.endsWith("/analyses/analysis-pending"),
      response: createResponse(200, {
        data: {
          attributes: { status: "queued" },
        },
      }),
    })),
  ];

  global.fetch = async (url, options) => {
    if (!sequence.length) {
      throw new Error(`Unexpected fetch call for ${url}`);
    }

    const next = sequence.shift();
    if (!next.match(url, options)) {
      throw new Error(`Fetch matcher did not align for ${url}`);
    }

    return next.response;
  };

  const result = await VirusTotalAPI.scanUrl(urlToScan);

  if (!result.isPending) {
    throw new Error(
      `Pending scan scenario did not return pending status: ${JSON.stringify(
        result
      )}`
    );
  }

  console.log("[TEST] Pending scan scenario: PASS");
}

(async () => {
  try {
    await runSuccessfulScanScenario();
    await runPendingScanScenario();
    console.log("All VirusTotal tests passed");
    process.exit(0);
  } catch (error) {
    console.error("VirusTotal tests failed", error);
    process.exit(1);
  }
})();
