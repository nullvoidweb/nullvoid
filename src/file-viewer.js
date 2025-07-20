// NULL VOID File Viewer - Secure Document Viewing
// Safely display files in an isolated environment

const browserAPI = typeof browser !== "undefined" ? browser : chrome;

let currentFileData = null;

// Initialize file viewer when page loads
document.addEventListener("DOMContentLoaded", async () => {
  console.log("[File Viewer] Initializing...");

  try {
    // Get file data from storage
    const storage = await browserAPI.storage.local.get(["pendingFileData"]);

    if (storage.pendingFileData) {
      currentFileData = storage.pendingFileData;
      console.log("[File Viewer] File data loaded:", currentFileData.name);

      // Display file
      await displayFile(currentFileData);

      // Clear from storage
      await browserAPI.storage.local.remove(["pendingFileData"]);
    } else {
      showError("No file data found. Please try uploading the file again.");
    }
  } catch (error) {
    console.error("[File Viewer] Initialization error:", error);
    showError("Failed to load file data.");
  }
});

async function displayFile(fileData) {
  const { name, size, type, content } = fileData;

  // Update file info
  updateFileInfo(name, size, type);

  // Display file based on type
  const fileDisplay = document.getElementById("fileDisplay");
  const downloadSection = document.getElementById("downloadSection");

  try {
    if (type.startsWith("image/")) {
      await displayImage(content, fileDisplay);
    } else if (type === "application/pdf") {
      await displayPDF(content, fileDisplay);
    } else if (type.startsWith("text/") || isTextFile(name)) {
      await displayText(content, fileDisplay);
    } else if (type.startsWith("video/")) {
      await displayVideo(content, fileDisplay);
    } else if (type.startsWith("audio/")) {
      await displayAudio(content, fileDisplay);
    } else {
      await displayGeneric(content, fileDisplay, name, type);
    }

    // Show download section
    downloadSection.style.display = "block";
    setupDownloadButton(content, name);

    showSuccess("File loaded successfully in secure environment");
  } catch (error) {
    console.error("[File Viewer] Display error:", error);
    showError("Failed to display file: " + error.message);
  }
}

function updateFileInfo(name, size, type) {
  document.getElementById("fileName").textContent = name;
  document.getElementById("fileSize").textContent = formatFileSize(size);
  document.getElementById("fileType").textContent = type || "Unknown";

  // Update security status
  const securityLevel = assessSecurityLevel(name, type, size);
  const securityStatus = document.getElementById("securityStatus");
  securityStatus.textContent = securityLevel.text;
  securityStatus.className = `security-status ${securityLevel.level}`;
}

function assessSecurityLevel(name, type, size) {
  const dangerousExtensions = [
    ".exe",
    ".bat",
    ".cmd",
    ".scr",
    ".vbs",
    ".js",
    ".jar",
  ];
  const extension = name.toLowerCase().substring(name.lastIndexOf("."));

  if (dangerousExtensions.includes(extension)) {
    return { level: "high-risk", text: "HIGH RISK - Executable file" };
  } else if (size > 50 * 1024 * 1024) {
    // 50MB
    return { level: "medium-risk", text: "MEDIUM RISK - Large file" };
  } else if (type.startsWith("application/")) {
    return { level: "medium-risk", text: "MEDIUM RISK - Application file" };
  } else {
    return { level: "safe", text: "SAFE - Document file" };
  }
}

async function displayImage(content, container) {
  const img = document.createElement("img");
  img.src = content;
  img.style.maxWidth = "100%";
  img.style.maxHeight = "70vh";
  img.style.objectFit = "contain";
  img.style.border = "1px solid #ddd";
  img.style.borderRadius = "8px";

  img.onload = () => {
    console.log("[File Viewer] Image loaded successfully");
  };

  img.onerror = () => {
    throw new Error("Failed to load image");
  };

  container.appendChild(img);
}

async function displayPDF(content, container) {
  // For PDF files, we'll show an embedded viewer
  const iframe = document.createElement("iframe");
  iframe.src = content;
  iframe.style.width = "100%";
  iframe.style.height = "70vh";
  iframe.style.border = "1px solid #ddd";
  iframe.style.borderRadius = "8px";

  // Fallback for PDF display
  const pdfContainer = document.createElement("div");
  pdfContainer.style.textAlign = "center";
  pdfContainer.style.padding = "40px";
  pdfContainer.style.border = "2px dashed #ddd";
  pdfContainer.style.borderRadius = "8px";

  pdfContainer.innerHTML = `
    <div style="font-size: 48px; margin-bottom: 20px;">📄</div>
    <h3>PDF Document</h3>
    <p>PDF preview not available in this environment.</p>
    <p>Use the download button below to save and open with your PDF reader.</p>
  `;

  container.appendChild(pdfContainer);
}

async function displayText(content, container) {
  // Extract text content from data URL
  const base64Data = content.split(",")[1];
  const textContent = atob(base64Data);

  const pre = document.createElement("pre");
  pre.style.background = "#f8f9fa";
  pre.style.padding = "20px";
  pre.style.borderRadius = "8px";
  pre.style.border = "1px solid #e9ecef";
  pre.style.overflow = "auto";
  pre.style.maxHeight = "70vh";
  pre.style.whiteSpace = "pre-wrap";
  pre.style.fontSize = "14px";
  pre.style.fontFamily = 'Consolas, Monaco, "Courier New", monospace';

  // Limit text display to prevent performance issues
  const maxLength = 10000;
  const displayText =
    textContent.length > maxLength
      ? textContent.substring(0, maxLength) +
        "\n\n... (Content truncated for preview)"
      : textContent;

  pre.textContent = displayText;
  container.appendChild(pre);
}

async function displayVideo(content, container) {
  const video = document.createElement("video");
  video.src = content;
  video.controls = true;
  video.style.maxWidth = "100%";
  video.style.maxHeight = "70vh";
  video.style.borderRadius = "8px";

  container.appendChild(video);
}

async function displayAudio(content, container) {
  const audioContainer = document.createElement("div");
  audioContainer.style.textAlign = "center";
  audioContainer.style.padding = "40px";
  audioContainer.style.border = "2px solid #ddd";
  audioContainer.style.borderRadius = "8px";

  const audio = document.createElement("audio");
  audio.src = content;
  audio.controls = true;
  audio.style.width = "100%";
  audio.style.maxWidth = "400px";

  audioContainer.innerHTML = `
    <div style="font-size: 48px; margin-bottom: 20px;">🎵</div>
    <h3>Audio File</h3>
  `;
  audioContainer.appendChild(audio);

  container.appendChild(audioContainer);
}

async function displayGeneric(content, container, name, type) {
  const genericContainer = document.createElement("div");
  genericContainer.style.textAlign = "center";
  genericContainer.style.padding = "40px";
  genericContainer.style.border = "2px dashed #ddd";
  genericContainer.style.borderRadius = "8px";

  const icon = getFileIcon(name, type);

  genericContainer.innerHTML = `
    <div style="font-size: 64px; margin-bottom: 20px;">${icon}</div>
    <h3>File Preview Not Available</h3>
    <p>This file type cannot be previewed safely in the browser.</p>
    <p><strong>File:</strong> ${name}</p>
    <p><strong>Type:</strong> ${type}</p>
    <p>Use the download button below to save the file.</p>
  `;

  container.appendChild(genericContainer);
}

function getFileIcon(name, type) {
  const extension = name.toLowerCase().substring(name.lastIndexOf("."));

  const iconMap = {
    ".pdf": "📄",
    ".doc": "📝",
    ".docx": "📝",
    ".xls": "📊",
    ".xlsx": "📊",
    ".ppt": "📈",
    ".pptx": "📈",
    ".zip": "🗜️",
    ".rar": "🗜️",
    ".7z": "🗜️",
    ".exe": "⚙️",
    ".msi": "⚙️",
    ".mp3": "🎵",
    ".wav": "🎵",
    ".flac": "🎵",
    ".mp4": "🎬",
    ".avi": "🎬",
    ".mkv": "🎬",
    ".txt": "📄",
    ".log": "📄",
    ".html": "🌐",
    ".htm": "🌐",
    ".css": "🎨",
    ".js": "⚡",
  };

  return iconMap[extension] || "📁";
}

function setupDownloadButton(content, fileName) {
  const downloadBtn = document.getElementById("downloadBtn");

  downloadBtn.onclick = () => {
    try {
      // Create download link
      const link = document.createElement("a");
      link.href = content;
      link.download = fileName;
      link.style.display = "none";

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showSuccess("File download started");
    } catch (error) {
      console.error("[File Viewer] Download error:", error);
      showError("Failed to download file");
    }
  };
}

function isTextFile(fileName) {
  const textExtensions = [
    ".txt",
    ".log",
    ".csv",
    ".json",
    ".xml",
    ".html",
    ".htm",
    ".css",
    ".js",
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

function showError(message) {
  showNotification(message, "error");
}

function showNotification(message, type) {
  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    border-radius: 6px;
    color: white;
    font-weight: 500;
    z-index: 1000;
    max-width: 300px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    ${type === "success" ? "background: #10b981;" : "background: #ef4444;"}
  `;

  document.body.appendChild(notification);

  // Auto remove after 5 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 5000);
}

// Add CSS styles for security status
const style = document.createElement("style");
style.textContent = `
  .security-status {
    padding: 4px 8px;
    border-radius: 4px;
    font-weight: 600;
    font-size: 12px;
    text-transform: uppercase;
  }
  
  .security-status.safe {
    background: #d1fae5;
    color: #065f46;
  }
  
  .security-status.medium-risk {
    background: #fef3c7;
    color: #92400e;
  }
  
  .security-status.high-risk {
    background: #fee2e2;
    color: #991b1b;
  }
`;
document.head.appendChild(style);
