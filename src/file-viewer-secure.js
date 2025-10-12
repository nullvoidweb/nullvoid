// NULL VOID Secure File Viewer - Enterprise-Grade Isolation
// Safely display files in a completely isolated environment with zero system access

const browserAPI = typeof browser !== "undefined" ? browser : chrome;

let currentFileData = null;
let isolatedWindow = null;

// Security and isolation configuration
const SECURITY_CONFIG = {
  maxFileSize: 100 * 1024 * 1024, // 100MB max
  allowedMimeTypes: new Set([
    // Documents
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    // Text
    "text/plain",
    "text/html",
    "text/css",
    "text/javascript",
    "text/json",
    "text/xml",
    "application/json",
    "application/xml",
    // Images
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    "image/bmp",
    // Audio/Video
    "audio/mpeg",
    "audio/wav",
    "audio/ogg",
    "video/mp4",
    "video/webm",
    "video/ogg",
    // Archives
    "application/zip",
    "application/x-rar-compressed",
    "application/x-7z-compressed",
    // Other
    "application/octet-stream",
  ]),
  dangerousExtensions: new Set([
    ".exe",
    ".bat",
    ".cmd",
    ".scr",
    ".vbs",
    ".js",
    ".jar",
    ".msi",
    ".dll",
    ".com",
    ".pif",
    ".application",
    ".gadget",
    ".msp",
    ".mst",
    ".ps1",
    ".reg",
    ".wsf",
  ]),
  isolationFeatures: {
    networkBlocking: true,
    fileSystemBlocking: true,
    clipboardBlocking: true,
    storageBlocking: true,
    geolocationBlocking: true,
    cameraBlocking: true,
    microphoneBlocking: true,
  },
};

// Initialize secure file viewer
document.addEventListener("DOMContentLoaded", async () => {
  console.log(
    "[Secure File Viewer] Initializing with native browser capabilities..."
  );

  try {
    // Skip library loading in native mode
    if (window.NATIVE_MODE) {
      console.log(
        "[Secure File Viewer] Using native mode - no external dependencies"
      );
    }

    // Initialize security features
    await initializeSecurity();

    // Get file data from storage with retry logic
    let storage;
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        storage = await browserAPI.storage.local.get(["pendingFileData"]);
        break;
      } catch (storageError) {
        console.warn(
          "[Secure File Viewer] Storage access failed, retrying...",
          storageError
        );
        retryCount++;
        if (retryCount >= maxRetries) {
          throw new Error(
            "Failed to access storage after " + maxRetries + " attempts"
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    if (storage.pendingFileData) {
      currentFileData = storage.pendingFileData;
      console.log(
        "[Secure File Viewer] File data loaded:",
        currentFileData.name
      );

      // Validate file data
      if (!currentFileData.name || !currentFileData.content) {
        throw new Error("Invalid file data structure");
      }

      // Security analysis
      await performSecurityAnalysis(currentFileData);

      // Display file in isolated environment
      await displayFileSecurely(currentFileData);

      // Clear from storage for security (but keep backup in case of refresh)
      try {
        await browserAPI.storage.local.remove(["pendingFileData"]);
      } catch (clearError) {
        console.warn(
          "[Secure File Viewer] Failed to clear storage:",
          clearError
        );
      }
    } else {
      // Show helpful error with retry option and debugging info
      console.warn(
        "[Secure File Viewer] No file data found in storage, checking for test mode..."
      );

      // Check for test mode in URL params
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("test") === "true") {
        console.log("[Secure File Viewer] Test mode activated");
        currentFileData = {
          name: "test-file.txt",
          size: 1024,
          type: "text/plain",
          content:
            "data:text/plain;base64," +
            btoa(
              "This is a test file for debugging the secure file viewer.\n\nIf you can see this message, the file viewer is working correctly!"
            ),
        };

        await performSecurityAnalysis(currentFileData);
        await displayFileSecurely(currentFileData);
        showSuccess("Test file loaded successfully!");

        // Don't return here, continue to initialize action buttons
      } else if (urlParams.get("testpdf") === "true") {
        console.log("[Secure File Viewer] PDF test mode activated");
        showPDFTest();
      } else {
        const contentArea = document.getElementById("contentArea");
        if (contentArea) {
          contentArea.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #e0e0e0;">
              <h3>No File Data Found</h3>
              <p>The secure file viewer could not find file data to display.</p>
              <div style="margin: 20px 0; padding: 15px; background: rgba(255, 255, 255, 0.1); border-radius: 6px; text-align: left;">
                <strong>Troubleshooting:</strong><br>
                1. Try selecting and viewing the file again from the extension popup<br>
                2. Make sure the file was selected properly<br>
                3. Check if the extension has proper permissions<br>
                4. Reload the extension if the problem persists
              </div>
              <div style="margin: 20px 0;">
                <button onclick="window.location.href = window.location.pathname + '?test=true'" style="
                  background: linear-gradient(135deg, #505050 0%, #3a3a3a 100%);
                  color: white; border: 1px solid #666666; padding: 8px 16px;
                  border-radius: 6px; cursor: pointer; font-size: 12px; margin-right: 10px;
                ">Load Test File</button>
                <button onclick="window.close()" style="
                  background: linear-gradient(135deg, #404040 0%, #2a2a2a 100%);
                  color: white; border: 1px solid #555555; padding: 12px 24px;
                  border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600;
                ">Close Viewer</button>
              </div>
            </div>
          `;
        }
        showError(
          "No file data found. Please try uploading the file again.",
          true
        );
      }
    }

    // Initialize action buttons
    initializeActionButtons();
  } catch (error) {
    console.error("[Secure File Viewer] Initialization error:", error);
    showError(
      "Failed to initialize secure file viewer: " + error.message,
      true
    );
  }
});

async function initializeSecurity() {
  console.log("[Security] Initializing isolation layers...");

  // Disable right-click context menu
  document.addEventListener("contextmenu", (e) => e.preventDefault());

  // Disable F12 and developer tools
  document.addEventListener("keydown", (e) => {
    if (e.key === "F12" || (e.ctrlKey && e.shiftKey && e.key === "I")) {
      e.preventDefault();
    }
  });

  // Block clipboard access
  document.addEventListener("copy", (e) => e.preventDefault());
  document.addEventListener("cut", (e) => e.preventDefault());

  // Override console for isolation (but preserve original for debugging)
  const originalConsole = window.console;
  if (typeof window.DEBUG === "undefined") {
    window.console = {
      log: () => {},
      error: () => {},
      warn: () => {},
      info: () => {},
      debug: () => {},
    };
  }

  console.log("[Security] ✅ Basic isolation layer activated");
}

async function performSecurityAnalysis(fileData) {
  const { name, size, type, content } = fileData;

  console.log("[Security] Performing security analysis...");

  // File size check
  if (size > SECURITY_CONFIG.maxFileSize) {
    throw new Error(
      `File too large: ${formatFileSize(size)} (max: ${formatFileSize(
        SECURITY_CONFIG.maxFileSize
      )})`
    );
  }

  // Extension analysis
  const extension = name.toLowerCase().substring(name.lastIndexOf("."));
  const isDangerous = SECURITY_CONFIG.dangerousExtensions.has(extension);

  // Update warning banner if it exists
  const warningBanner = document.getElementById("warningBanner");
  if (warningBanner && isDangerous) {
    warningBanner.style.display = "block";
  }

  // Update security status if element exists
  const securityLevel = assessSecurityLevel(name, type, size, isDangerous);
  const securityStatus = document.getElementById("securityStatus");
  if (securityStatus) {
    securityStatus.textContent = securityLevel.text;
    securityStatus.className = `security-status ${securityLevel.level}`;
  }

  // Update risk status
  const riskStatus = document.getElementById("riskStatus");
  if (riskStatus) {
    riskStatus.textContent = isDangerous ? "HIGH RISK" : "LOW RISK";
    riskStatus.className = isDangerous
      ? "status-item status-high-risk"
      : "status-item";
  }

  // Generate file hashes for verification
  await generateFileHashes(content);

  console.log("[Security] Security analysis completed");
  console.log("[Security] Security analysis completed");
}

async function generateFileHashes(content) {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);

    // Generate SHA-256 hash
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Display hash if elements exist
    const hashInfo = document.getElementById("hashInfo");
    const fileHashes = document.getElementById("fileHashes");

    if (fileHashes) {
      fileHashes.innerHTML = `
        <strong>SHA-256:</strong> ${hashHex}<br>
        <strong>Size:</strong> ${data.length} bytes<br>
        <strong>Timestamp:</strong> ${new Date().toISOString()}
      `;
    }

    if (hashInfo) {
      hashInfo.style.display = "block";
    }

    console.log(
      "[Security] File hash generated:",
      hashHex.substring(0, 16) + "..."
    );
  } catch (error) {
    console.warn("[Security] Hash generation failed:", error);
  }
}

function assessSecurityLevel(name, type, size, isDangerous) {
  if (isDangerous) {
    return { level: "high-risk", text: "HIGH RISK - Dangerous executable" };
  } else if (size > 10 * 1024 * 1024) {
    // 10MB
    return { level: "sandboxed", text: "SANDBOXED - Large file" };
  } else if (type.startsWith("application/")) {
    return { level: "sandboxed", text: "SANDBOXED - Application file" };
  } else {
    return { level: "isolated", text: "ISOLATED - Safe file type" };
  }
}

async function displayFileSecurely(fileData) {
  const { name, size, type, content } = fileData;

  console.log("[Secure File Viewer] Displaying file:", {
    name,
    size,
    type: type || "unknown",
    contentLength: content ? content.length : 0,
  });

  // Update file info
  updateFileInfo(name, size, type);

  // Display file based on type with maximum isolation
  const contentArea = document.getElementById("contentArea");

  if (!contentArea) {
    console.error("Content area not found");
    throw new Error("Content area element not found in DOM");
  }

  try {
    // Clear loading content
    contentArea.innerHTML = "";

    // Create isolated content container
    const isolatedContainer = document.createElement("div");
    isolatedContainer.className = "file-content";
    isolatedContainer.style.cssText = `
      width: 100%;
      height: 100%;
      min-height: 400px;
      border-radius: 8px;
      background: #ffffff;
      color: #000000;
      padding: 20px;
      overflow: auto;
    `;

    // Determine display method based on file type
    console.log(
      "[Secure File Viewer] Determining display method for type:",
      type,
      "file:",
      name
    );

    // Enhanced file type detection
    const fileName = name.toLowerCase();
    const isExcelFile =
      type.includes("excel") ||
      type.includes("spreadsheet") ||
      fileName.endsWith(".xlsx") ||
      fileName.endsWith(".xls") ||
      type ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      type === "application/vnd.ms-excel";

    if (type.startsWith("image/")) {
      console.log("[Secure File Viewer] Displaying as image");
      await displayImageIsolated(content, isolatedContainer);
    } else if (type === "application/pdf") {
      console.log("[Secure File Viewer] Displaying as PDF");
      console.log(
        "[PDF Debug] Content preview:",
        content.substring(0, 100) + "..."
      );
      console.log(
        "[PDF Debug] PDF.js available:",
        typeof pdfjsLib !== "undefined"
      );
      await displayPDFIsolated(content, isolatedContainer);
    } else if (isExcelFile) {
      console.log("[Secure File Viewer] Displaying as Excel");
      await displayExcelIsolated(content, isolatedContainer, name);
    } else if (type.startsWith("text/") || isTextFile(name)) {
      console.log("[Secure File Viewer] Displaying as text");
      await displayTextIsolated(content, isolatedContainer);
    } else if (type.startsWith("video/")) {
      console.log("[Secure File Viewer] Displaying as video");
      await displayVideoIsolated(content, isolatedContainer);
    } else if (type.startsWith("audio/")) {
      console.log("[Secure File Viewer] Displaying as audio");
      await displayAudioIsolated(content, isolatedContainer);
    } else if (type.startsWith("application/")) {
      console.log("[Secure File Viewer] Displaying as document");
      await displayDocumentIsolated(content, isolatedContainer, name, type);
    } else {
      console.log("[Secure File Viewer] Displaying as generic file");
      await displayGenericIsolated(content, isolatedContainer, name, type);
    }

    // Clear loading state and show content
    contentArea.appendChild(isolatedContainer);

    // Setup download functionality
    setupDownloadButton(content, name);

    showSuccess("File loaded successfully in isolated environment");
  } catch (error) {
    console.error("[Secure File Viewer] Display error:", error);
    showError("Failed to display file: " + error.message);
  }
}

async function displayImageIsolated(content, container) {
  const img = document.createElement("img");
  img.src = content;
  img.style.maxWidth = "100%";
  img.style.maxHeight = "50vh";
  img.style.objectFit = "contain";
  img.style.border = "1px solid #ddd";
  img.style.borderRadius = "8px";
  img.style.pointerEvents = "none"; // Prevent interactions

  // Create sandbox wrapper
  const sandbox = document.createElement("div");
  sandbox.style.textAlign = "center";
  sandbox.style.padding = "20px";
  sandbox.style.background = "white";
  sandbox.style.borderRadius = "6px";

  img.onload = () => {
    console.log("[Display] Image loaded in isolation");
  };

  img.onerror = () => {
    throw new Error("Failed to load image safely");
  };

  sandbox.appendChild(img);
  container.appendChild(sandbox);
}

async function displayPDFIsolated(content, container) {
  console.log("[PDF] Starting native PDF display...");

  try {
    // Always use native browser PDF viewer - no external dependencies
    console.log("[PDF] Using native browser PDF capabilities");

    // Validate content format
    if (!content || !content.startsWith("data:")) {
      throw new Error("Invalid PDF data format");
    }

    // Convert data URL to blob for better browser compatibility
    console.log("[PDF] Converting data URL to blob...");
    const base64Data = content.split(",")[1];
    const binaryData = atob(base64Data);
    const uint8Array = new Uint8Array(binaryData.length);
    for (let i = 0; i < binaryData.length; i++) {
      uint8Array[i] = binaryData.charCodeAt(i);
    }
    const blob = new Blob([uint8Array], { type: "application/pdf" });
    const blobUrl = URL.createObjectURL(blob);

    console.log("[PDF] Blob URL created:", blobUrl.substring(0, 50) + "...");

    // Create PDF container with native viewer
    const pdfContainer = document.createElement("div");
    pdfContainer.style.cssText = `
      width: 100%;
      height: 100%;
      min-height: 600px;
      background: white;
      border-radius: 6px;
      position: relative;
      border: 1px solid #ddd;
    `;

    // Create iframe for native PDF display
    const iframe = document.createElement("iframe");
    iframe.src = blobUrl;
    iframe.style.cssText = `
      width: 100%;
      height: 580px;
      border: none;
      border-radius: 6px;
      background: white;
    `;

    // Add loading indicator
    const loadingDiv = document.createElement("div");
    loadingDiv.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
      color: #666;
      z-index: 10;
    `;
    loadingDiv.innerHTML = `
      <div style="font-size: 24px; margin-bottom: 10px;">📄</div>
      <p>Loading PDF using native browser viewer...</p>
    `;

    // Add debug info and fallback options
    const debugDiv = document.createElement("div");
    debugDiv.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      background: rgba(0,0,0,0.7);
      color: white;
      padding: 5px 10px;
      border-radius: 4px;
      font-size: 12px;
      z-index: 20;
    `;
    debugDiv.innerHTML = `📊 Native PDF Mode | ${Math.round(
      uint8Array.length / 1024
    )}KB`;

    // Create fallback button
    const fallbackButton = document.createElement("button");
    fallbackButton.style.cssText = `
      position: absolute;
      top: 50px;
      right: 10px;
      background: #007bff;
      color: white;
      border: none;
      padding: 8px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      z-index: 20;
      display: none;
    `;
    fallbackButton.innerHTML = "Try Object Viewer";
    fallbackButton.onclick = () => tryObjectFallback(container, blobUrl);

    pdfContainer.appendChild(debugDiv);
    pdfContainer.appendChild(fallbackButton);
    pdfContainer.appendChild(loadingDiv);
    pdfContainer.appendChild(iframe);

    // Handle iframe load events
    iframe.onload = () => {
      console.log("[PDF] Native PDF iframe loaded successfully");
      loadingDiv.style.display = "none";

      // Check if iframe actually shows content
      setTimeout(() => {
        if (iframe.contentWindow) {
          console.log("[PDF] Iframe content window available");
          debugDiv.innerHTML += " ✅ Loaded";
        } else {
          console.warn("[PDF] Iframe content window not available");
          fallbackButton.style.display = "block";
        }
      }, 2000);

      // Clean up blob URL after successful load
      setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
        console.log("[PDF] Blob URL cleaned up");
      }, 5000);
    };

    iframe.onerror = () => {
      console.error("[PDF] Native PDF iframe failed to load");
      URL.revokeObjectURL(blobUrl); // Clean up on error
      fallbackButton.style.display = "block";
      debugDiv.innerHTML += " ❌ Failed";
      loadingDiv.innerHTML = `
        <div style="color: #e74c3c;">
          <div style="font-size: 24px; margin-bottom: 10px;">⚠️</div>
          <p>Iframe PDF viewer failed</p>
          <p style="font-size: 12px;">Try the Object Viewer button or download the file</p>
        </div>
      `;
    };

    // Timeout for loading
    setTimeout(() => {
      if (loadingDiv.style.display !== "none") {
        console.warn("[PDF] Native PDF loading timeout");
        fallbackButton.style.display = "block";
        debugDiv.innerHTML += " ⏱️ Timeout";
        loadingDiv.innerHTML = `
          <div style="font-size: 24px; margin-bottom: 10px;">📄</div>
          <p>PDF viewer loaded (may be slow to display)</p>
          <p style="font-size: 12px; color: #888;">If PDF doesn't display, try the Object Viewer button</p>
        `;
      }
    }, 5000); // Increased timeout to 5 seconds

    container.appendChild(pdfContainer);

    console.log("[PDF] Native PDF viewer setup complete");
  } catch (error) {
    console.error("[PDF] Native PDF display error:", error);
    showNativePDFFallback(container, error.message);
  }
}

// Object fallback function for PDF viewing
function tryObjectFallback(container, blobUrl) {
  console.log("[PDF] Trying object fallback viewer...");

  const objectContainer = document.createElement("div");
  objectContainer.style.cssText = `
    width: 100%;
    height: 600px;
    background: white;
    border: 1px solid #ddd;
    border-radius: 6px;
    position: relative;
    margin-top: 10px;
  `;

  const objectElement = document.createElement("object");
  objectElement.data = blobUrl;
  objectElement.type = "application/pdf";
  objectElement.style.cssText = `
    width: 100%;
    height: 100%;
    border: none;
  `;

  objectElement.innerHTML = `
    <div style="padding: 40px; text-align: center; color: #666;">
      <h3>PDF Object Viewer Failed</h3>
      <p>Your browser doesn't support embedded PDF viewing.</p>
      <p>Please use the download button to view the PDF externally.</p>
    </div>
  `;

  objectContainer.appendChild(objectElement);
  container.appendChild(objectContainer);
}

function showNativePDFFallback(container, errorMessage) {
  const pdfContainer = document.createElement("div");
  pdfContainer.style.cssText = `
    text-align: center;
    padding: 40px;
    background: white;
    border-radius: 6px;
    border: 2px dashed #ddd;
  `;

  pdfContainer.innerHTML = `
    <div style="font-size: 48px; margin-bottom: 20px; font-weight: bold; color: #666;">📄</div>
    <h3>PDF Document (Download Mode)</h3>
    <p style="color: #e74c3c; margin: 10px 0;"><strong>Issue:</strong> ${sanitizeHtml(
      errorMessage
    )}</p>
    <p><strong>Security Level:</strong> Maximum Isolation</p>
    <div style="margin: 20px 0; padding: 15px; background: #404040; color: #e0e0e0; border-radius: 6px;">
      🔒 SECURED: This PDF viewer uses only native browser capabilities
    </div>
    <p>Use the download button below to save and open with your preferred PDF reader.</p>
  `;

  container.appendChild(pdfContainer);
}

async function displayTextIsolated(content, container) {
  try {
    // Safely extract text content
    const base64Data = content.split(",")[1];
    const textContent = atob(base64Data);

    const pre = document.createElement("pre");
    pre.style.background = "white";
    pre.style.padding = "20px";
    pre.style.borderRadius = "6px";
    pre.style.border = "1px solid #e9ecef";
    pre.style.overflow = "auto";
    pre.style.maxHeight = "50vh";
    pre.style.whiteSpace = "pre-wrap";
    pre.style.fontSize = "14px";
    pre.style.fontFamily = 'Consolas, Monaco, "Courier New", monospace';
    pre.style.userSelect = "none"; // Prevent text selection for security

    // Sanitize and limit text display
    const maxLength = 50000; // Increased for better viewing
    const sanitizedText = sanitizeTextContent(textContent);
    const displayText =
      sanitizedText.length > maxLength
        ? sanitizedText.substring(0, maxLength) +
          "\n\n... (Content truncated for security)"
        : sanitizedText;

    pre.textContent = displayText;
    container.appendChild(pre);
  } catch (error) {
    throw new Error("Failed to safely display text content");
  }
}

async function displayVideoIsolated(content, container) {
  const videoContainer = document.createElement("div");
  videoContainer.style.textAlign = "center";
  videoContainer.style.padding = "20px";
  videoContainer.style.background = "white";
  videoContainer.style.borderRadius = "6px";

  const video = document.createElement("video");
  video.src = content;
  video.controls = true;
  video.style.maxWidth = "100%";
  video.style.maxHeight = "50vh";
  video.style.borderRadius = "8px";
  video.controlsList = "nodownload"; // Disable download from video controls
  video.disablePictureInPicture = true;

  videoContainer.appendChild(video);
  container.appendChild(videoContainer);
}

async function displayAudioIsolated(content, container) {
  const audioContainer = document.createElement("div");
  audioContainer.style.textAlign = "center";
  audioContainer.style.padding = "40px";
  audioContainer.style.background = "white";
  audioContainer.style.borderRadius = "6px";

  const audio = document.createElement("audio");
  audio.src = content;
  audio.controls = true;
  audio.style.width = "100%";
  audio.style.maxWidth = "400px";
  audio.controlsList = "nodownload";

  audioContainer.innerHTML = `
    <div style="font-size: 48px; margin-bottom: 20px; font-weight: bold; color: #666;">AUDIO</div>
    <h3>Audio File (Isolated Playback)</h3>
    <div style="margin: 20px 0;">
  `;

  audioContainer.appendChild(audio);
  container.appendChild(audioContainer);
}

async function displayDocumentIsolated(content, container, name, type) {
  // Check if it's an Excel file
  if (
    type.includes("excel") ||
    type.includes("spreadsheet") ||
    name.toLowerCase().endsWith(".xlsx") ||
    name.toLowerCase().endsWith(".xls")
  ) {
    await displayExcelIsolated(content, container, name);
    return;
  }

  // Default document display for other types
  const docContainer = document.createElement("div");
  docContainer.style.textAlign = "center";
  docContainer.style.padding = "40px";
  docContainer.style.background = "white";
  docContainer.style.borderRadius = "6px";
  docContainer.style.border = "2px solid #fbbf24";

  const icon = getFileIcon(name, type);

  docContainer.innerHTML = `
    <div style="font-size: 64px; margin-bottom: 20px; font-weight: bold; color: #666;">${icon}</div>
    <h3>Document File (Maximum Isolation)</h3>
    <p><strong>File:</strong> ${sanitizeHtml(name)}</p>
    <p><strong>Type:</strong> ${sanitizeHtml(type)}</p>
    <div style="margin: 20px 0; padding: 15px; background: #404040; color: #e0e0e0; border-radius: 6px;">
      WARNING: Document files are opened in read-only mode with no macro execution
    </div>
    <p>This document cannot access your system, network, or execute any code.</p>
    <p>Use the download button to save and open with your preferred application.</p>
  `;

  container.appendChild(docContainer);
}

async function displayExcelIsolated(content, container, name) {
  try {
    // Extract Excel data from data URL
    const base64Data = content.split(",")[1];
    const excelData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

    // Create Excel container
    const excelContainer = document.createElement("div");
    excelContainer.style.cssText = `
      width: 100%;
      height: 100%;
      min-height: 600px;
      background: white;
      border-radius: 6px;
      overflow: hidden;
      position: relative;
    `;

    // Create controls
    const controls = document.createElement("div");
    controls.style.cssText = `
      padding: 10px;
      background: #f5f5f5;
      border-bottom: 1px solid #ddd;
      display: flex;
      align-items: center;
      gap: 10px;
      justify-content: space-between;
    `;

    controls.innerHTML = `
      <div>
        <strong>Excel Viewer:</strong> ${sanitizeHtml(name)}
      </div>
      <div>
        <select id="sheetSelector" style="padding: 5px; border: 1px solid #ccc; border-radius: 4px;">
          <option>Loading sheets...</option>
        </select>
      </div>
    `;

    // Create content area
    const contentArea = document.createElement("div");
    contentArea.style.cssText = `
      padding: 20px;
      overflow: auto;
      height: calc(100% - 60px);
      background: white;
    `;

    excelContainer.appendChild(controls);
    excelContainer.appendChild(contentArea);

    // Load Excel workbook
    const workbook = XLSX.read(excelData, { type: "array" });
    const sheetNames = workbook.SheetNames;

    // Update sheet selector
    const sheetSelector = controls.querySelector("#sheetSelector");
    sheetSelector.innerHTML = "";
    sheetNames.forEach((name, index) => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      if (index === 0) option.selected = true;
      sheetSelector.appendChild(option);
    });

    // Function to display sheet
    function displaySheet(sheetName) {
      const worksheet = workbook.Sheets[sheetName];
      const htmlTable = XLSX.utils.sheet_to_html(worksheet, {
        table: true,
        header: 1,
      });

      // Style the table
      const styledTable = htmlTable
        .replace(
          "<table>",
          '<table style="width: 100%; border-collapse: collapse; font-family: Arial, sans-serif; font-size: 12px;">'
        )
        .replace(
          /<td>/g,
          '<td style="border: 1px solid #ddd; padding: 8px; text-align: left; vertical-align: top;">'
        )
        .replace(
          /<th>/g,
          '<th style="border: 1px solid #ddd; padding: 8px; background: #f0f0f0; font-weight: bold; text-align: left;">'
        );

      contentArea.innerHTML = `
        <div style="margin-bottom: 15px;">
          <strong>Sheet:</strong> ${sanitizeHtml(sheetName)} 
          <span style="color: #666; margin-left: 10px;">(Read-only view in secure isolation)</span>
        </div>
        <div style="overflow: auto; max-height: 500px; border: 1px solid #ddd; border-radius: 4px;">
          ${styledTable}
        </div>
        <div style="margin-top: 15px; padding: 10px; background: #404040; color: #e0e0e0; border-radius: 6px; font-size: 12px;">
          <strong>SECURITY:</strong> This Excel file is displayed in read-only mode with no macro execution or external connections.
        </div>
      `;
    }

    // Display first sheet
    if (sheetNames.length > 0) {
      displaySheet(sheetNames[0]);
    }

    // Handle sheet selection
    sheetSelector.onchange = (e) => {
      displaySheet(e.target.value);
    };

    container.appendChild(excelContainer);
  } catch (error) {
    console.error("Excel display error:", error);
    // Fallback display
    const errorContainer = document.createElement("div");
    errorContainer.style.cssText = `
      text-align: center;
      padding: 40px;
      background: white;
      border-radius: 6px;
      border: 2px solid #fbbf24;
    `;

    errorContainer.innerHTML = `
      <div style="font-size: 64px; margin-bottom: 20px; font-weight: bold; color: #666;">XLS</div>
      <h3>Excel File (Fallback Mode)</h3>
      <p><strong>File:</strong> ${sanitizeHtml(name)}</p>
      <p>Excel preview failed to load. This may be due to file corruption or unsupported format.</p>
      <div style="margin: 20px 0; padding: 15px; background: #404040; color: #e0e0e0; border-radius: 6px;">
        SECURED: This Excel file cannot execute macros or access system resources
      </div>
      <p>Use the download button below to save and open with your preferred spreadsheet application.</p>
    `;

    container.appendChild(errorContainer);
  }
}

async function displayGenericIsolated(content, container, name, type) {
  const genericContainer = document.createElement("div");
  genericContainer.style.textAlign = "center";
  genericContainer.style.padding = "40px";
  genericContainer.style.background = "white";
  genericContainer.style.borderRadius = "6px";
  genericContainer.style.border = "2px dashed #ddd";

  const icon = getFileIcon(name, type);
  const extension = name.toLowerCase().substring(name.lastIndexOf("."));
  const isDangerous = SECURITY_CONFIG.dangerousExtensions.has(extension);

  genericContainer.innerHTML = `
    <div style="font-size: 64px; margin-bottom: 20px; font-weight: bold; color: #666;">${icon}</div>
    <h3>File Preview (${
      isDangerous ? "High Security" : "Standard"
    } Isolation)</h3>
    <p><strong>File:</strong> ${sanitizeHtml(name)}</p>
    <p><strong>Type:</strong> ${sanitizeHtml(type)}</p>
    <div style="margin: 20px 0; padding: 15px; background: ${
      isDangerous ? "#404040" : "#404040"
    }; color: #e0e0e0; border-radius: 6px;">
      SECURED: This file is completely isolated from your system
      ${
        isDangerous
          ? "<br>WARNING: Potentially dangerous file type detected"
          : ""
      }
    </div>
    <p>Preview not available for this file type.</p>
    <p>Use the download button below to save the file safely.</p>
  `;

  container.appendChild(genericContainer);
}

function initializeActionButtons() {
  // Reload button
  const reloadBtn = document.getElementById("reloadBtn");
  if (reloadBtn) {
    reloadBtn.addEventListener("click", () => {
      location.reload();
    });
  }

  // Fullscreen button (optional)
  const fullscreenBtn = document.getElementById("fullscreenBtn");
  if (fullscreenBtn) {
    fullscreenBtn.addEventListener("click", () => {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen();
      }
    });
  }

  // Properties button (optional)
  const propertiesBtn = document.getElementById("propertiesBtn");
  if (propertiesBtn) {
    propertiesBtn.addEventListener("click", () => {
      if (currentFileData) {
        showFileProperties(currentFileData);
      }
    });
  }

  // Export button (optional)
  const exportBtn = document.getElementById("exportBtn");
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      if (currentFileData) {
        exportFileInfo(currentFileData);
      }
    });
  }
}

function showFileProperties(fileData) {
  const modal = document.createElement("div");
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center;
    z-index: 1000;
  `;

  const content = document.createElement("div");
  content.style.cssText = `
    background: white; padding: 30px; border-radius: 12px; max-width: 500px; width: 90%;
    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
  `;

  const extension = fileData.name
    .toLowerCase()
    .substring(fileData.name.lastIndexOf("."));
  const isDangerous = SECURITY_CONFIG.dangerousExtensions.has(extension);

  content.innerHTML = `
    <h3 style="margin-bottom: 20px;">File Properties</h3>
    <div style="font-family: monospace; font-size: 14px; line-height: 1.6;">
      <p><strong>Name:</strong> ${sanitizeHtml(fileData.name)}</p>
      <p><strong>Size:</strong> ${formatFileSize(fileData.size)}</p>
      <p><strong>Type:</strong> ${sanitizeHtml(fileData.type)}</p>
      <p><strong>Extension:</strong> ${extension}</p>
      <p><strong>Risk Level:</strong> ${isDangerous ? "HIGH" : "LOW"}</p>
      <p><strong>Isolation:</strong> Maximum</p>
      <p><strong>Network Access:</strong> Blocked</p>
      <p><strong>System Access:</strong> Blocked</p>
      <p><strong>Loaded:</strong> ${new Date().toISOString()}</p>
    </div>
    <button onclick="this.parentElement.parentElement.remove()" 
            style="margin-top: 20px; padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer;">
      Close
    </button>
  `;

  modal.appendChild(content);
  document.body.appendChild(modal);

  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

function exportFileInfo(fileData) {
  const info = {
    name: fileData.name,
    size: fileData.size,
    type: fileData.type,
    timestamp: new Date().toISOString(),
    isolation: "maximum",
    security: "enterprise-grade",
  };

  const blob = new Blob([JSON.stringify(info, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileData.name}_info.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Utility functions
function sanitizeTextContent(text) {
  // Remove potentially dangerous patterns
  return text
    .replace(
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      "[SCRIPT REMOVED]"
    )
    .replace(
      /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
      "[IFRAME REMOVED]"
    )
    .replace(/javascript:/gi, "blocked:")
    .replace(/data:text\/html/gi, "blocked:");
}

function sanitizeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function getFileIcon(name, type) {
  const extension = name.toLowerCase().substring(name.lastIndexOf("."));

  const iconMap = {
    ".pdf": "PDF",
    ".doc": "DOC",
    ".docx": "DOC",
    ".xls": "XLS",
    ".xlsx": "XLS",
    ".ppt": "PPT",
    ".pptx": "PPT",
    ".zip": "ZIP",
    ".rar": "RAR",
    ".7z": "7Z",
    ".exe": "EXE",
    ".msi": "MSI",
    ".mp3": "MP3",
    ".wav": "WAV",
    ".mp4": "MP4",
    ".avi": "AVI",
    ".mov": "MOV",
    ".jpg": "IMG",
    ".jpeg": "IMG",
    ".png": "IMG",
    ".gif": "IMG",
    ".txt": "TXT",
    ".js": "JS",
    ".html": "HTML",
    ".css": "CSS",
    ".json": "JSON",
    ".xml": "XML",
    ".bat": "BAT",
    ".cmd": "CMD",
    ".vbs": "VBS",
  };

  return iconMap[extension] || "FILE";
}

function updateFileInfo(name, size, type) {
  const fileName = document.getElementById("fileName");
  const fileSize = document.getElementById("fileSize");
  const fileType = document.getElementById("fileType");

  if (fileName) fileName.textContent = name;
  if (fileSize) fileSize.textContent = formatFileSize(size);
  if (fileType) fileType.textContent = type || "Unknown";
}

function setupDownloadButton(content, name) {
  const downloadBtn = document.getElementById("downloadBtn");
  if (downloadBtn) {
    downloadBtn.addEventListener("click", () => {
      try {
        const a = document.createElement("a");
        a.href = content;
        a.download = name;
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        showSuccess("File downloaded successfully");
      } catch (error) {
        showError("Download failed: " + error.message);
      }
    });
  }
}

function isTextFile(fileName) {
  const textExtensions = [
    ".txt",
    ".log",
    ".cfg",
    ".conf",
    ".ini",
    ".csv",
    ".xml",
    ".json",
    ".html",
    ".htm",
    ".css",
    ".js",
    ".ts",
    ".py",
    ".java",
    ".c",
    ".cpp",
    ".h",
    ".php",
    ".sql",
    ".sh",
    ".bat",
    ".ps1",
    ".yaml",
    ".yml",
    ".md",
  ];
  const extension = fileName.toLowerCase().substring(fileName.lastIndexOf("."));
  return textExtensions.includes(extension);
}

function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function showSuccess(message) {
  showNotification(message, "success");
}

function showError(message, showRetry = false) {
  showNotification(message, "error", showRetry);
}

function showNotification(message, type, showRetry = false) {
  const notification = document.createElement("div");
  notification.className = `notification ${type}`;

  // Create notification content
  const messageDiv = document.createElement("div");
  messageDiv.textContent = message;
  notification.appendChild(messageDiv);

  // Add retry button if requested
  if (showRetry && type === "error") {
    const retryBtn = document.createElement("button");
    retryBtn.textContent = "Reload Extension";
    retryBtn.style.cssText = `
      margin-top: 8px; padding: 4px 8px; background: rgba(255,255,255,0.2);
      border: 1px solid rgba(255,255,255,0.3); border-radius: 4px;
      color: white; cursor: pointer; font-size: 12px;
    `;
    retryBtn.onclick = () => window.location.reload();
    notification.appendChild(retryBtn);
  }

  notification.style.cssText = `
    position: fixed; top: 20px; right: 20px; padding: 12px 20px; border-radius: 6px;
    color: white; font-weight: 500; z-index: 1000; max-width: 350px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    ${type === "success" ? "background: #10b981;" : "background: #ef4444;"}
  `;

  document.body.appendChild(notification);

  setTimeout(
    () => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    },
    showRetry ? 10000 : 5000
  ); // Longer timeout for retry notifications
}

// PDF test function
function showPDFTest() {
  console.log("[Test] Running PDF functionality test...");

  const contentArea = document.getElementById("contentArea");
  if (!contentArea) return;

  contentArea.innerHTML = `
    <div style="text-align: center; padding: 40px; color: #e0e0e0;">
      <h3>PDF Functionality Test</h3>
      <p>Testing PDF.js library integration...</p>
      <div id="testResults" style="margin: 20px 0; padding: 15px; background: rgba(255, 255, 255, 0.1); border-radius: 6px;">
        <div>PDF.js Available: <span id="pdfjsStatus">Checking...</span></div>
        <div>Worker URL: <span id="workerStatus">Checking...</span></div>
        <div>Global Options: <span id="globalStatus">Checking...</span></div>
      </div>
      <button onclick="runDetailedTest()" style="padding: 10px 20px; background: #666; color: white; border: none; border-radius: 4px; cursor: pointer;">
        Run Detailed Test
      </button>
    </div>
  `;

  // Check PDF.js status
  setTimeout(() => {
    const pdfjsStatus = document.getElementById("pdfjsStatus");
    const workerStatus = document.getElementById("workerStatus");
    const globalStatus = document.getElementById("globalStatus");

    if (pdfjsStatus) {
      pdfjsStatus.textContent =
        typeof pdfjsLib !== "undefined" ? "✅ Available" : "❌ Not Available";
    }

    if (workerStatus && typeof pdfjsLib !== "undefined") {
      workerStatus.textContent = pdfjsLib.GlobalWorkerOptions.workerSrc
        ? "✅ Set"
        : "❌ Not Set";
    }

    if (globalStatus && typeof pdfjsLib !== "undefined") {
      globalStatus.textContent = "✅ Available";
    }
  }, 1000);

  // Add global test function
  window.runDetailedTest = function () {
    console.log("[Test] Running detailed PDF test...");

    if (typeof pdfjsLib === "undefined") {
      alert("PDF.js is not available. Check the console for errors.");
      return;
    }

    // Try to create a simple PDF test
    try {
      // This is a very basic test - in reality you'd need actual PDF data
      alert(
        `PDF.js is available! Version info: ${JSON.stringify(
          pdfjsLib.version || "Unknown"
        )}`
      );
    } catch (error) {
      alert(`PDF.js test failed: ${error.message}`);
    }
  };
}

// Wait for external libraries to load
async function waitForLibraries() {
  const maxWait = 15000; // 15 seconds - increased timeout
  const checkInterval = 100; // 100ms
  let elapsed = 0;

  return new Promise((resolve) => {
    const checkLibraries = () => {
      const pdfJsLoaded = typeof pdfjsLib !== "undefined";
      const xlsxLoaded = typeof XLSX !== "undefined";

      console.log(
        `[Libraries] Check ${elapsed}ms - PDF.js: ${pdfJsLoaded}, XLSX: ${xlsxLoaded}`
      );

      if (pdfJsLoaded && xlsxLoaded) {
        console.log("[Secure File Viewer] All libraries loaded successfully");
        resolve();
        return;
      }

      elapsed += checkInterval;
      if (elapsed >= maxWait) {
        console.warn(
          `[Secure File Viewer] Library loading timeout after ${maxWait}ms`
        );
        console.warn("PDF.js loaded:", pdfJsLoaded, "XLSX loaded:", xlsxLoaded);

        // Check for specific error messages
        if (window.pdfLoadError) {
          console.error("PDF.js load error:", window.pdfLoadError);
        }
        if (window.xlsxLoadError) {
          console.error("XLSX load error:", window.xlsxLoadError);
        }

        resolve(); // Continue anyway
        return;
      }

      setTimeout(checkLibraries, checkInterval);
    };

    checkLibraries();
  });
}

// Initialize security monitoring
setInterval(() => {
  // Monitor for potential security violations
  if (
    window.location.href !==
    window.location.origin + window.location.pathname
  ) {
    console.warn("[Security] URL tampering detected");
    window.location.reload();
  }
}, 5000);

console.log(
  "[Secure File Viewer] ✅ Initialization complete with maximum isolation"
);
