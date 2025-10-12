// NULL VOID Security AI - Validation Test
const https = require("https");

const AI_CONFIG = {
  apiKey: "AIzaSyB-j8iXAEg_W-I2l3PodnJMoO_wgai2VDU",
  baseUrl: "https://generativelanguage.googleapis.com/v1beta",
  model: "gemini-2.5-flash",
};

async function testSecurityAI() {
  console.log("🛡️ NULL VOID Security AI - Validation Test");
  console.log("=".repeat(50));

  const securityTests = [
    {
      name: "Disposable Browser Issue",
      query:
        "My NULL VOID extension shows 'Fallback Mode' error. How do I fix it?",
      expectKeywords: ["browserless", "api", "config", "credentials"],
    },
    {
      name: "AI Chat Not Working",
      query:
        "NULL VOID AI chat gives 'I apologize, but I encountered an error' message",
      expectKeywords: ["gemini-2.5-flash", "model", "api_config", "ai_config"],
    },
    {
      name: "Security Threat Detection",
      query: "How does NULL VOID protect me from phishing attacks?",
      expectKeywords: [
        "smart prevention",
        "disposable browser",
        "isolation",
        "protection",
      ],
    },
    {
      name: "Anti-Hallucination Test",
      query: "How do I enable NULL VOID's quantum encryption feature?",
      expectKeywords: ["not available", "verify", "actual features", "check"],
    },
  ];

  for (const test of securityTests) {
    console.log(`\n🧪 Testing: ${test.name}`);
    console.log(`Query: "${test.query}"`);

    try {
      const response = await callSecurityAI(test.query);

      // Check for expected keywords
      const responseText = response.toLowerCase();
      const foundKeywords = test.expectKeywords.filter((keyword) =>
        responseText.includes(keyword.toLowerCase())
      );

      const passRate =
        (foundKeywords.length / test.expectKeywords.length) * 100;

      console.log(`✅ Response received (${response.length} chars)`);
      console.log(
        `🎯 Keywords found: ${foundKeywords.length}/${
          test.expectKeywords.length
        } (${Math.round(passRate)}%)`
      );
      console.log(`📝 Found: [${foundKeywords.join(", ")}]`);

      if (passRate >= 50) {
        console.log(`🟢 TEST PASSED - Security AI provided relevant guidance`);
      } else {
        console.log(
          `🔴 TEST FAILED - Response lacks expected security context`
        );
      }

      // Show sample response
      console.log(`📋 Sample Response: "${response.substring(0, 150)}..."`);
    } catch (error) {
      console.log(`❌ TEST ERROR: ${error.message}`);
    }

    console.log("-".repeat(60));
  }

  console.log("\n🏁 Security AI Validation Complete!");
  console.log("✅ All tests evaluate AI response quality and security focus");
  console.log(
    "🛡️ NULL VOID Security AI is configured for cybersecurity expertise"
  );
}

async function callSecurityAI(message) {
  return new Promise((resolve, reject) => {
    const securityPrompt = `You are NULL VOID SECURITY AI, the definitive cybersecurity expert for the NULL VOID browser extension.

🛡️ CORE EXPERTISE:
- NULL VOID Extension troubleshooting and configuration
- Browser security, malware protection, privacy safeguards
- Disposable browser issues (Browserless API errors)
- AI chat problems (model configuration, API keys)
- Smart prevention system configuration
- Secure browsing best practices

⚠️ RESPONSE REQUIREMENTS:
- BE PRECISE: Give exact file names, settings, and verification steps
- NO HALLUCINATION: Only reference actual NULL VOID features and files
- SECURITY FIRST: Always prioritize user safety and privacy
- STEP-BY-STEP: Provide numbered, actionable instructions
- VERIFY: Include verification commands/checks for solutions

🎯 User Query: ${message}

Provide expert NULL VOID security guidance:`;

    const requestBody = {
      contents: [
        {
          parts: [{ text: securityPrompt }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 800,
        topP: 0.8,
        topK: 40,
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_ONLY_HIGH",
        },
      ],
    };

    const data = JSON.stringify(requestBody);
    const url = `${AI_CONFIG.baseUrl}/models/${AI_CONFIG.model}:generateContent?key=${AI_CONFIG.apiKey}`;

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

    const req = https.request(options, (res) => {
      let responseBody = "";
      res.on("data", (chunk) => (responseBody += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(responseBody);
          if (parsed.candidates && parsed.candidates[0]) {
            resolve(parsed.candidates[0].content.parts[0].text);
          } else {
            reject(new Error(`No valid response: ${responseBody}`));
          }
        } catch (error) {
          reject(new Error(`Parse error: ${responseBody}`));
        }
      });
    });

    req.on("error", (error) => {
      reject(new Error(`Request error: ${error.message}`));
    });

    req.write(data);
    req.end();
  });
}

// Run the validation test
testSecurityAI().catch(console.error);
