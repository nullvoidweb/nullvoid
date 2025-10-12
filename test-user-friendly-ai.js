// User-Friendly AI Response Test
const https = require("https");

const AI_CONFIG = {
  apiKey: "AIzaSyB-j8iXAEg_W-I2l3PodnJMoO_wgai2VDU",
  baseUrl: "https://generativelanguage.googleapis.com/v1beta",
  model: "gemini-2.5-flash",
};

async function testUserFriendlyAI() {
  console.log("🤖 NULL VOID User-Friendly AI Test");
  console.log("=".repeat(50));

  const testQuestions = [
    {
      name: "Disposable Browser Issue (User Perspective)",
      question:
        "I see a yellow warning that says 'Fallback Mode' when I try to use the disposable browser. What does this mean and how do I fix it?",
      shouldAvoid: [
        "browserless-config.js",
        "API key",
        "manifest.json",
        "file",
      ],
      shouldInclude: ["click", "button", "setting", "option", "menu"],
    },
    {
      name: "AI Chat Problem (User Perspective)",
      question:
        "The AI chat keeps saying 'I apologize, but I encountered an error'. How do I fix this?",
      shouldAvoid: ["gemini-2.5-flash", "AI_CONFIG", "model", "api"],
      shouldInclude: ["try", "restart", "refresh", "reload", "check"],
    },
    {
      name: "Feature Question (User Perspective)",
      question: "What is the disposable browser and how do I use it?",
      shouldAvoid: ["RBI", "browserless.io", "API", "isolation", "technical"],
      shouldInclude: ["safe", "protect", "click", "use", "browse"],
    },
  ];

  for (const test of testQuestions) {
    console.log(`\n🧪 Testing: ${test.name}`);
    console.log(`Question: "${test.question}"`);

    try {
      const response = await callUserFriendlyAI(test.question);

      // Check for technical terms that should be avoided
      const foundBadTerms = test.shouldAvoid.filter((term) =>
        response.toLowerCase().includes(term.toLowerCase())
      );

      // Check for user-friendly terms that should be included
      const foundGoodTerms = test.shouldInclude.filter((term) =>
        response.toLowerCase().includes(term.toLowerCase())
      );

      const badTermsScore = foundBadTerms.length;
      const goodTermsScore = foundGoodTerms.length;
      const userFriendliness = Math.max(
        0,
        100 - badTermsScore * 20 + goodTermsScore * 15
      );

      console.log(
        `📊 User-Friendliness Score: ${Math.min(100, userFriendliness)}%`
      );
      console.log(
        `❌ Technical terms found: [${foundBadTerms.join(", ") || "None"}]`
      );
      console.log(
        `✅ User-friendly terms found: [${foundGoodTerms.join(", ") || "None"}]`
      );

      if (userFriendliness >= 70) {
        console.log(`🟢 TEST PASSED - Response is user-friendly`);
      } else {
        console.log(`🔴 TEST FAILED - Response too technical`);
      }

      // Show sample response
      console.log(`📝 Sample Response: "${response.substring(0, 200)}..."`);
    } catch (error) {
      console.log(`❌ TEST ERROR: ${error.message}`);
    }

    console.log("-".repeat(60));
  }

  console.log("\n🏁 User-Friendly AI Test Complete!");
  console.log("✅ AI should now respond in simple, accessible terms");
  console.log("🚫 No more technical file names or developer jargon");
  console.log("👥 Responses focused on what users can see and do");
}

async function callUserFriendlyAI(message) {
  return new Promise((resolve, reject) => {
    const userFriendlyPrompt = `You are NULL VOID AI, a helpful assistant for users of the NULL VOID browser extension.

🛡️ YOUR ROLE:
- Help users understand and use NULL VOID extension features
- Provide simple, easy-to-follow guidance
- Keep explanations user-friendly and accessible
- Focus on what users can see and do in the extension

🎯 RESPONSE GUIDELINES:
- Use simple, clear language that anyone can understand
- Give step-by-step instructions using the extension's buttons and menus
- Focus on user interface elements, not technical details
- Never mention file names, code, or internal configurations
- Be encouraging and helpful
- Keep cybersecurity advice practical and easy to follow

⚠️ IMPORTANT:
- NO technical jargon or developer terms
- NO file names or internal system details
- Focus on visible buttons, menus, and options in the extension
- Explain what features do for users, not how they work internally

User Question: ${message}

Provide helpful, user-friendly guidance:`;

    const requestBody = {
      contents: [
        {
          parts: [{ text: userFriendlyPrompt }],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 800,
      },
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

// Run the test
testUserFriendlyAI().catch(console.error);
