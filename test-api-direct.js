// Direct API test script for Node.js
const https = require("https");

const AI_CONFIG = {
  apiKey: "AIzaSyB-j8iXAEg_W-I2l3PodnJMoO_wgai2VDU",
  baseUrl: "https://generativelanguage.googleapis.com/v1beta",
  model: "gemini-2.5-flash",
};

const requestBody = {
  contents: [
    {
      parts: [
        {
          text: "Hello, this is a test message. Please respond with 'API test successful!'",
        },
      ],
    },
  ],
  generationConfig: {
    temperature: 0.7,
    maxOutputTokens: 100,
  },
};

const data = JSON.stringify(requestBody);
const url = `${AI_CONFIG.baseUrl}/models/${AI_CONFIG.model}:generateContent?key=${AI_CONFIG.apiKey}`;

// Parse URL for request options
const urlObj = new URL(url);
const options = {
  hostname: urlObj.hostname,
  port: 443,
  path: urlObj.pathname + urlObj.search,
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Content-Length": data.length,
  },
};

console.log("Testing Gemini API...");
console.log("URL:", url);
console.log("Request body:", JSON.stringify(requestBody, null, 2));

const req = https.request(options, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  console.log(`Headers:`, res.headers);

  let responseBody = "";
  res.on("data", (chunk) => {
    responseBody += chunk;
  });

  res.on("end", () => {
    console.log("\nResponse Body:");
    try {
      const parsed = JSON.parse(responseBody);
      console.log(JSON.stringify(parsed, null, 2));

      if (
        parsed.candidates &&
        parsed.candidates[0] &&
        parsed.candidates[0].content
      ) {
        console.log(
          "\n✅ SUCCESS! AI Response:",
          parsed.candidates[0].content.parts[0].text
        );
      } else {
        console.log("\n❌ FAILED! No valid response received");
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

req.write(data);
req.end();
