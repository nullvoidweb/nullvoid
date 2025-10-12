// List available models script
const https = require("https");

const AI_CONFIG = {
  apiKey: "AIzaSyB-j8iXAEg_W-I2l3PodnJMoO_wgai2VDU",
  baseUrl: "https://generativelanguage.googleapis.com/v1beta",
};

const url = `${AI_CONFIG.baseUrl}/models?key=${AI_CONFIG.apiKey}`;

// Parse URL for request options
const urlObj = new URL(url);
const options = {
  hostname: urlObj.hostname,
  port: 443,
  path: urlObj.pathname + urlObj.search,
  method: "GET",
  headers: {
    "Content-Type": "application/json",
  },
};

console.log("Listing available Gemini models...");
console.log("URL:", url);

const req = https.request(options, (res) => {
  console.log(`Status Code: ${res.statusCode}`);

  let responseBody = "";
  res.on("data", (chunk) => {
    responseBody += chunk;
  });

  res.on("end", () => {
    console.log("\nResponse:");
    try {
      const parsed = JSON.parse(responseBody);

      if (parsed.models) {
        console.log("\n✅ Available Models:");
        parsed.models.forEach((model) => {
          console.log(`- ${model.name} (${model.displayName})`);
          if (
            model.supportedGenerationMethods &&
            model.supportedGenerationMethods.includes("generateContent")
          ) {
            console.log("  ✓ Supports generateContent");
          }
        });
      } else {
        console.log("Raw response:", JSON.stringify(parsed, null, 2));
      }
    } catch (error) {
      console.log("Raw response:", responseBody);
      console.log("\n❌ FAILED! Invalid JSON response");
    }
  });
});

req.on("error", (error) => {
  console.error("\n❌ Request Error:", error);
});

req.end();
