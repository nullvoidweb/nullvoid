// 📝 Clean Formatting Validation Test
// Tests AI responses for clean, natural formatting without asterisks

async function testCleanFormatting() {
  console.log("\n📝 Testing AI Clean Formatting...\n");

  const AI_CONFIG = {
    apiKey: "AIzaSyB-j8iXAEg_W-I2l3PodnJMoO_wgai2VDU",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    model: "gemini-2.5-flash",
  };

  async function sendCleanFormattedAI(message) {
    const prompt = `You are NULL VOID AI, a helpful assistant for users of the NULL VOID browser extension.

🛡️ YOUR ROLE:
- Help users understand and use NULL VOID extension features
- Provide simple, easy-to-follow guidance
- Keep explanations user-friendly and accessible
- Focus on what users can see and do in the extension

🎯 RESPONSE FORMATTING RULES:
- Write in clean, natural sentences without asterisks or special formatting
- Use simple bullet points with hyphens (-) when listing steps
- Write clear paragraph breaks for easy reading
- Use everyday language that flows naturally
- Avoid markdown formatting, asterisks, or special characters in responses
- Make responses feel like friendly conversation, not technical documentation

🎯 RESPONSE GUIDELINES:
- Use simple, clear language that anyone can understand
- Give step-by-step instructions using the extension's buttons and menus
- Focus on user interface elements, not technical details
- Never mention file names, code, or internal configurations
- Be encouraging and helpful
- Keep cybersecurity advice practical and easy to follow
- Format responses as natural, readable text without special characters

⚠️ IMPORTANT:
- NO technical jargon or developer terms
- NO file names or internal system details
- NO asterisks (*) or markdown formatting in responses
- Focus on visible buttons, menus, and options in the extension
- Explain what features do for users, not how they work internally
- Write like you're having a friendly conversation

User Question: ${message}

Provide helpful, user-friendly guidance with clean formatting:`;

    try {
      const response = await fetch(
        `${AI_CONFIG.baseUrl}/models/${AI_CONFIG.model}:generateContent?key=${AI_CONFIG.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 1200,
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();
      return data.candidates[0].content.parts[0].text;
    } catch (error) {
      throw new Error(`AI API Error: ${error.message}`);
    }
  }

  function analyzeFormatting(response) {
    const issues = [];
    let formattingScore = 100;

    // Count problematic asterisks
    const asteriskCount = (response.match(/\*/g) || []).length;
    if (asteriskCount > 0) {
      issues.push(`${asteriskCount} asterisks found`);
      formattingScore -= asteriskCount * 10;
    }

    // Check for markdown-style formatting
    const markdownPatterns = [
      { pattern: /\*\*[^*]+\*\*/g, name: "bold markdown" },
      { pattern: /\*[^*]+\*/g, name: "italic markdown" },
      { pattern: /#+ /g, name: "header markdown" },
      { pattern: /```/g, name: "code blocks" },
      { pattern: /`[^`]+`/g, name: "inline code" },
    ];

    markdownPatterns.forEach(({ pattern, name }) => {
      const matches = response.match(pattern);
      if (matches) {
        issues.push(`${matches.length} ${name} patterns`);
        formattingScore -= matches.length * 5;
      }
    });

    // Check for awkward formatting patterns
    const awkwardPatterns = [
      { pattern: /How to use:\*/g, name: "awkward asterisk placement" },
      { pattern: /\*[A-Z]/g, name: "asterisk at sentence start" },
      { pattern: /\.\*/g, name: "asterisk at sentence end" },
      { pattern: /:\s*\*/g, name: "asterisk after colon" },
    ];

    awkwardPatterns.forEach(({ pattern, name }) => {
      const matches = response.match(pattern);
      if (matches) {
        issues.push(`${matches.length} ${name} instances`);
        formattingScore -= matches.length * 15;
      }
    });

    // Check for natural language features (positive scoring)
    const naturalFeatures = [
      { pattern: /\. [A-Z]/g, name: "natural sentence breaks", bonus: 2 },
      { pattern: /\n\n/g, name: "paragraph breaks", bonus: 3 },
      { pattern: /^[A-Z][a-z]/gm, name: "natural sentence starts", bonus: 1 },
    ];

    naturalFeatures.forEach(({ pattern, name, bonus }) => {
      const matches = response.match(pattern);
      if (matches) {
        formattingScore += matches.length * bonus;
      }
    });

    formattingScore = Math.max(0, Math.min(100, formattingScore));
    const isCleanlyFormatted = formattingScore >= 80 && asteriskCount === 0;

    return {
      formattingScore: Math.round(formattingScore),
      isCleanlyFormatted,
      issues,
      asteriskCount,
      details: `Score: ${Math.round(
        formattingScore
      )}%, Asterisks: ${asteriskCount}, Issues: ${issues.length}`,
    };
  }

  function logTest(testName, result, analysis) {
    const timestamp = new Date().toLocaleTimeString();
    const status = analysis.isCleanlyFormatted ? "✅ PASS" : "❌ FAIL";

    console.log(`\n${"=".repeat(60)}`);
    console.log(`🧪 ${testName} [${timestamp}]`);
    console.log(`Status: ${status}`);
    console.log(`Formatting Score: ${analysis.formattingScore}%`);
    console.log(`Asterisk Count: ${analysis.asteriskCount}`);
    console.log(
      `Issues Found: ${
        analysis.issues.length > 0 ? analysis.issues.join(", ") : "None"
      }`
    );
    console.log(`\n📝 Response Preview:`);
    console.log(`"${result.substring(0, 200)}..."`);

    if (!analysis.isCleanlyFormatted) {
      console.log(`\n⚠️  Formatting Issues:`);
      analysis.issues.forEach((issue) => console.log(`   - ${issue}`));
    }
  }

  // Test Cases
  const testCases = [
    {
      name: "Basic Feature Explanation",
      question: "How does NULL VOID protect me from dangerous websites?",
    },
    {
      name: "Step-by-Step Instructions",
      question: "How do I use the disposable browser feature?",
    },
    {
      name: "Complex Feature List",
      question:
        "Can you explain all the features of NULL VOID and how to use them?",
    },
    {
      name: "Troubleshooting Help",
      question: "What should I do if I see a yellow 'Fallback Mode' warning?",
    },
    {
      name: "Safety Guidance",
      question:
        "How do I use the temporary email feature for safe online registrations?",
    },
  ];

  console.log("🎯 Starting Clean Formatting Validation Tests...");
  console.log(
    `Testing ${testCases.length} scenarios for clean, natural formatting`
  );

  let passCount = 0;
  let totalAsterisks = 0;
  let totalFormattingScore = 0;

  for (const testCase of testCases) {
    try {
      console.log(`\n🔄 Running: ${testCase.name}...`);
      const result = await sendCleanFormattedAI(testCase.question);
      const analysis = analyzeFormatting(result);

      logTest(testCase.name, result, analysis);

      if (analysis.isCleanlyFormatted) passCount++;
      totalAsterisks += analysis.asteriskCount;
      totalFormattingScore += analysis.formattingScore;

      // Brief pause between tests
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.log(`\n❌ ${testCase.name} FAILED: ${error.message}`);
    }
  }

  // Final Summary
  console.log(`\n${"=".repeat(60)}`);
  console.log(`📊 CLEAN FORMATTING TEST SUMMARY`);
  console.log(`${"=".repeat(60)}`);
  console.log(
    `Tests Passed: ${passCount}/${testCases.length} (${Math.round(
      (passCount / testCases.length) * 100
    )}%)`
  );
  console.log(
    `Average Formatting Score: ${Math.round(
      totalFormattingScore / testCases.length
    )}%`
  );
  console.log(`Total Asterisks Found: ${totalAsterisks}`);
  console.log(
    `Clean Formatting Goal: ${
      totalAsterisks === 0 ? "✅ ACHIEVED" : "❌ NEEDS WORK"
    }`
  );

  if (passCount === testCases.length && totalAsterisks === 0) {
    console.log(
      `\n🎉 ALL TESTS PASSED! AI responses have clean, natural formatting.`
    );
  } else {
    console.log(
      `\n⚠️  Some tests need attention. Check formatting rules in AI system.`
    );
  }
}

// Run the test
if (typeof window !== "undefined") {
  // Browser environment
  window.testCleanFormatting = testCleanFormatting;
  console.log(
    "📝 Clean formatting test loaded. Call testCleanFormatting() to run."
  );
} else {
  // Node.js environment
  testCleanFormatting().catch(console.error);
}
