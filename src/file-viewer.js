// File Viewer Tab JavaScript
console.log("File Viewer Tab loaded");

// Use browser-specific API namespace
const browserAPI = typeof browser !== "undefined" ? browser : chrome;

let currentFile = null;
let fileData = null;

// Get file data from URL parameters or extension storage
async function initializeFileViewer() {
  console.log("Initializing file viewer...");

  try {
    // Get the file data passed from the popup
    console.log("Getting pending file data from storage...");
    const result = await browserAPI.storage.local.get(["pendingFileData"]);
    console.log("Storage result:", result);

    if (result.pendingFileData) {
      console.log("Found pending file data:", result.pendingFileData);
      currentFile = result.pendingFileData.file;
      fileData = result.pendingFileData.data;

      console.log("Current file:", currentFile);
      console.log("File data length:", fileData ? fileData.length : 0);

      // Clear the pending data
      await browserAPI.storage.local.remove(["pendingFileData"]);
      console.log("Cleared pending data from storage");

      // Display the file
      console.log("Displaying file info and content...");
      displayFileInfo();
      displayFileContent();
    } else {
      // No file data found
      console.error("No file data found in storage");
      showError("No file data found. Please try opening the file again.");
    }
  } catch (error) {
    console.error("Error initializing file viewer:", error);
    showError("Failed to load file data: " + error.message);
  }
}

// Display file information
function displayFileInfo() {
  if (!currentFile) return;

  const fileDetails = document.getElementById("fileDetails");
  const downloadBtn = document.getElementById("downloadBtn");

  fileDetails.innerHTML = `
        <div class="file-detail-row">
            <span class="file-detail-label">File Name:</span>
            <span class="file-detail-value">${escapeHtml(
              currentFile.name
            )}</span>
        </div>
        <div class="file-detail-row">
            <span class="file-detail-label">File Size:</span>
            <span class="file-detail-value">${formatFileSize(
              currentFile.size
            )}</span>
        </div>
        <div class="file-detail-row">
            <span class="file-detail-label">File Type:</span>
            <span class="file-detail-value">${
              currentFile.type || "Unknown"
            }</span>
        </div>
        <div class="file-detail-row">
            <span class="file-detail-label">Last Modified:</span>
            <span class="file-detail-value">${new Date(
              currentFile.lastModified
            ).toLocaleString()}</span>
        </div>
    `;

  // Set up download button
  if (downloadBtn) {
    downloadBtn.onclick = () => downloadCurrentFile();
  }
}

// Display file content based on type
function displayFileContent() {
  console.log("Starting displayFileContent...");

  if (!currentFile || !fileData) {
    console.error("Missing file data:", {
      currentFile,
      fileDataLength: fileData?.length,
    });
    showError("Missing file data. Please try again.");
    return;
  }

  const fileContent = document.getElementById("fileContent");
  if (!fileContent) {
    console.error("File content container not found");
    showError("File content container not found");
    return;
  }

  const fileType = currentFile.type.toLowerCase();
  const fileName = currentFile.name.toLowerCase();

  console.log("File details:", {
    name: fileName,
    type: fileType,
    size: currentFile.size,
  });

  try {
    if (fileType.startsWith("image/")) {
      console.log("Displaying as image...");
      displayImage(fileContent, fileData);
    } else if (fileType.startsWith("video/")) {
      console.log("Displaying as video...");
      displayVideo(fileContent, fileData, fileType);
    } else if (fileType.startsWith("audio/")) {
      console.log("Displaying as audio...");
      displayAudio(fileContent, fileData, fileType);
    } else if (fileType === "application/pdf") {
      console.log("Displaying as PDF...");
      displayPDF(fileContent, fileData);
    } else if (fileType.startsWith("text/") || isTextFile(fileName)) {
      console.log("Displaying as text...");
      displayText(fileContent, fileData);
    } else if (isOfficeFile(fileType, fileName)) {
      console.log("Displaying as Office document...");
      displayOfficeDocument(fileContent, currentFile, fileData);
    } else if (isArchiveFile(fileType, fileName)) {
      console.log("Displaying as archive...");
      displayArchive(fileContent, currentFile);
    } else {
      console.log("Displaying as unsupported file...");
      displayUnsupportedFile(fileContent, currentFile);
    }

    console.log("File content display completed");
  } catch (error) {
    console.error("Error displaying file content:", error);
    showError("Failed to display file content: " + error.message);
  }
}

// Display image files
function displayImage(container, data) {
  console.log("Creating image element...");

  const img = document.createElement("img");
  img.src = data;
  img.alt = currentFile.name;
  img.className = "file-image";

  img.onerror = () => {
    console.error("Failed to load image");
    showError("Failed to load image");
  };

  img.onload = () => {
    console.log("Image loaded successfully");
  };

  container.innerHTML = "";
  container.appendChild(img);

  console.log("Image element added to container");
}

// Display video files
function displayVideo(container, data, mimeType) {
  const video = document.createElement("video");
  video.src = data;
  video.className = "file-video";
  video.controls = true;
  video.preload = "metadata";

  // Add multiple source formats for better compatibility
  const source = document.createElement("source");
  source.src = data;
  source.type = mimeType;
  video.appendChild(source);

  video.onerror = () =>
    showError("Failed to load video. This video format may not be supported.");

  container.innerHTML = "";
  container.appendChild(video);
}

// Display audio files
function displayAudio(container, data, mimeType) {
  const audio = document.createElement("audio");
  audio.src = data;
  audio.className = "file-audio";
  audio.controls = true;
  audio.preload = "metadata";

  const source = document.createElement("source");
  source.src = data;
  source.type = mimeType;
  audio.appendChild(source);

  audio.onerror = () =>
    showError("Failed to load audio. This audio format may not be supported.");

  container.innerHTML = "";
  container.appendChild(audio);
}

// Display PDF files
function displayPDF(container, data) {
  console.log("Displaying PDF with data URL length:", data.length);

  // Show loading state
  container.innerHTML = `
      <div class="loading-container">
          <div class="loading-spinner"></div>
          <p>Loading PDF viewer...</p>
      </div>
  `;

  try {
    // Method 1: Try simple iframe first (most reliable)
    displayPDFSimple(container, data);
  } catch (error) {
    console.error("Error displaying PDF:", error);
    showPDFError(container);
  }
}

function displayPDFSimple(container, data) {
  try {
    // Create iframe with PDF data - make it larger and remove controls
    const iframe = document.createElement("iframe");
    iframe.src = data;
    iframe.className = "file-iframe";
    iframe.style.width = "100%";
    iframe.style.height = "85vh"; // Increased from 70vh to 85vh
    iframe.style.border = "none";
    iframe.style.backgroundColor = "white";
    iframe.style.borderRadius = "8px";

    // Add error handling
    iframe.onerror = () => {
      console.error("PDF iframe failed to load");
      showPDFError(container);
    };

    iframe.onload = () => {
      console.log("PDF iframe loaded successfully");
    };

    // Replace loading with iframe - no controls added
    container.innerHTML = "";
    container.appendChild(iframe);

    console.log("PDF displayed without controls for cleaner view");
  } catch (error) {
    console.error("Simple PDF display failed:", error);
    showPDFError(container);
  }
}

function openPDFInNewTab() {
  if (fileData) {
    const newWindow = window.open();
    newWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
              <title>${escapeHtml(currentFile.name)}</title>
              <style>
                  body { margin: 0; padding: 0; background: #333; }
                  iframe { width: 100vw; height: 100vh; border: none; }
              </style>
          </head>
          <body>
              <iframe src="${fileData}"></iframe>
          </body>
          </html>
      `);
  }
}

async function displayPDFWithMultipleMethods(container, data) {
  // Method 1: Try PDF.js via cdnjs (most reliable)
  if (await tryPDFJS(container, data)) return;

  // Method 2: Try Google Docs Viewer
  if (await tryGoogleDocsViewer(container, data)) return;

  // Method 3: Try Mozilla PDF.js viewer
  if (await tryMozillaPDFViewer(container, data)) return;

  // Method 4: Fallback to basic iframe
  if (await tryBasicPDFIframe(container, data)) return;

  // Final fallback
  showPDFError(container);
}

async function tryPDFJS(container, data) {
  try {
    // Load PDF.js library
    if (!window.pdfjsLib) {
      await loadScript(
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"
      );
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    }

    const loadingTask = window.pdfjsLib.getDocument(data);
    const pdf = await loadingTask.promise;

    container.innerHTML = `
            <div class="pdf-viewer-container">
                <div class="pdf-controls">
                    <button id="prevPage" class="btn btn-secondary">← Previous</button>
                    <span id="pageInfo">Page 1 of ${pdf.numPages}</span>
                    <button id="nextPage" class="btn btn-secondary">Next →</button>
                    <button id="zoomOut" class="btn btn-secondary">-</button>
                    <span id="zoomLevel">100%</span>
                    <button id="zoomIn" class="btn btn-secondary">+</button>
                </div>
                <canvas id="pdfCanvas" class="pdf-canvas"></canvas>
            </div>
        `;

    await renderPDFPage(pdf, 1, 1.0);
    setupPDFControls(pdf);
    return true;
  } catch (error) {
    console.error("PDF.js failed:", error);
    return false;
  }
}

async function tryGoogleDocsViewer(container, data) {
  try {
    // Convert data URL to blob URL for Google Docs Viewer
    const response = await fetch(data);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    const iframe = document.createElement("iframe");
    iframe.src = `https://docs.google.com/viewer?url=${encodeURIComponent(
      window.location.origin + "/" + blobUrl
    )}&embedded=true`;
    iframe.className = "file-iframe";
    iframe.sandbox = "allow-scripts allow-same-origin";

    // Test if iframe loads successfully
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timeout")), 5000);
      iframe.onload = () => {
        clearTimeout(timeout);
        resolve();
      };
      iframe.onerror = () => {
        clearTimeout(timeout);
        reject(new Error("Load failed"));
      };
    });

    container.innerHTML = "";
    container.appendChild(iframe);
    return true;
  } catch (error) {
    console.error("Google Docs Viewer failed:", error);
    return false;
  }
}

async function tryMozillaPDFViewer(container, data) {
  try {
    const iframe = document.createElement("iframe");
    iframe.src = `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(
      data
    )}`;
    iframe.className = "file-iframe";
    iframe.sandbox = "allow-scripts allow-same-origin";

    container.innerHTML = "";
    container.appendChild(iframe);
    return true;
  } catch (error) {
    console.error("Mozilla PDF Viewer failed:", error);
    return false;
  }
}

async function tryBasicPDFIframe(container, data) {
  try {
    const iframe = document.createElement("iframe");
    iframe.src = data;
    iframe.className = "file-iframe";
    iframe.sandbox = "allow-scripts allow-same-origin";
    iframe.title = "PDF Viewer";

    container.innerHTML = "";
    container.appendChild(iframe);
    return true;
  } catch (error) {
    console.error("Basic PDF iframe failed:", error);
    return false;
  }
}

function showPDFError(container) {
  container.innerHTML = `
        <div class="file-placeholder">
            <div class="file-icon">📄</div>
            <h3>PDF Document</h3>
            <p><strong>${escapeHtml(currentFile.name)}</strong></p>
            <p>PDF preview is temporarily unavailable. You can download the file to view it.</p>
            <p>File size: ${formatFileSize(currentFile.size)}</p>
            <div class="action-buttons" style="margin-top: 20px;">
                <button class="btn btn-primary" onclick="downloadCurrentFile()">
                    📥 Download PDF
                </button>
            </div>
        </div>
    `;
}

// Display text files
function displayText(container, data) {
  // Convert data URL to text if needed
  let textContent = data;
  if (data.startsWith("data:")) {
    const base64 = data.split(",")[1];
    textContent = atob(base64);
  }

  const textDiv = document.createElement("div");
  textDiv.className = "file-text";
  textDiv.textContent = textContent;

  container.innerHTML = "";
  container.appendChild(textDiv);
}

// Display Office documents
async function displayOfficeDocument(container, file, data) {
  console.log("Displaying Office document:", file.name);

  // Show loading state
  container.innerHTML = `
        <div class="loading-container">
            <div class="loading-spinner"></div>
            <p>Preparing document viewer...</p>
        </div>
    `;

  try {
    const fileExtension = file.name.split(".").pop().toLowerCase();

    // For DOCX files, try local conversion to HTML first
    if (fileExtension === "docx") {
      console.log("Attempting local DOCX viewing...");
      if (await tryLocalDOCXViewer(container, file, data)) {
        return;
      }
    }

    // For other Office files or if DOCX conversion fails, use local options
    displayOfficeLocal(container, file, data);
  } catch (error) {
    console.error("Error displaying Office document:", error);
    showOfficeError(container, file);
  }
}

async function tryLocalDOCXViewer(container, file, data) {
  try {
    console.log("Loading mammoth.js for DOCX conversion...");

    // Load mammoth.js library for DOCX conversion
    if (!window.mammoth) {
      await loadScript(
        "https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js"
      );
    }

    // Convert data URL to ArrayBuffer
    const response = await fetch(data);
    const arrayBuffer = await response.arrayBuffer();

    console.log("Converting DOCX to HTML...");

    // Convert DOCX to HTML using mammoth.js
    const result = await window.mammoth.convertToHtml({
      arrayBuffer: arrayBuffer,
    });
    const html = result.value;
    const messages = result.messages;

    if (messages && messages.length > 0) {
      console.log("Mammoth conversion messages:", messages);
    }

    // Display the converted HTML
    container.innerHTML = `
      <div class="office-viewer-container">
        <div class="office-header">
          <div class="office-title">📝 ${escapeHtml(file.name)}</div>
          <div class="office-security">🛡️ Local DOCX Viewer</div>
        </div>
        <div class="office-content">
          <div class="docx-viewer-content">
            ${html}
          </div>
          <div class="docx-viewer-info">
            <p class="conversion-note">
              📄 Document converted from DOCX format for secure local viewing
            </p>
            ${
              messages && messages.length > 0
                ? `<details class="conversion-details">
                <summary>Conversion Notes (${messages.length})</summary>
                <ul>
                  ${messages
                    .map((msg) => `<li>${escapeHtml(msg.message)}</li>`)
                    .join("")}
                </ul>
              </details>`
                : ""
            }
          </div>
        </div>
      </div>
    `;

    console.log("DOCX conversion successful");
    return true;
  } catch (error) {
    console.error("Local DOCX viewer failed:", error);
    return false;
  }
}

async function displayOfficeWithMultipleMethods(container, file, data) {
  // Method 1: Try OnlyOffice Viewer (like SquareX)
  if (await tryOnlyOfficeViewer(container, file, data)) return;

  // Method 2: Try Google Docs Viewer
  if (await tryGoogleDocsOfficeViewer(container, file, data)) return;

  // Method 3: Try Microsoft Office Online Viewer
  if (await tryMicrosoftOfficeViewer(container, file, data)) return;

  // Method 4: Try Zoho Viewer
  if (await tryZohoViewer(container, file, data)) return;

  // Final fallback
  showOfficeError(container, file);
}

async function tryOnlyOfficeViewer(container, file, data) {
  try {
    // Convert file to a temporary URL that can be accessed by OnlyOffice
    const fileBlob = await fileToBlob(file, data);
    const tempUrl = await uploadToTempService(fileBlob, file.name);

    if (!tempUrl) throw new Error("Failed to create temporary URL");

    const viewerHtml = `
            <div class="office-viewer-container">
                <div class="office-header">
                    <div class="office-title">📄 ${escapeHtml(file.name)}</div>
                    <div class="office-security">🛡️ Secure Online Viewer</div>
                </div>
                <iframe 
                    src="https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(
                      tempUrl
                    )}"
                    class="office-iframe"
                    sandbox="allow-scripts allow-same-origin allow-forms"
                    title="Office Document Viewer">
                </iframe>
            </div>
        `;

    container.innerHTML = viewerHtml;
    return true;
  } catch (error) {
    console.error("OnlyOffice viewer failed:", error);
    return false;
  }
}

async function tryGoogleDocsOfficeViewer(container, file, data) {
  try {
    const fileBlob = await fileToBlob(file, data);
    const tempUrl = await uploadToTempService(fileBlob, file.name);

    if (!tempUrl) throw new Error("Failed to create temporary URL");

    const viewerHtml = `
            <div class="office-viewer-container">
                <div class="office-header">
                    <div class="office-title">📄 ${escapeHtml(file.name)}</div>
                    <div class="office-security">🛡️ Google Docs Secure Viewer</div>
                </div>
                <iframe 
                    src="https://docs.google.com/viewer?url=${encodeURIComponent(
                      tempUrl
                    )}&embedded=true"
                    class="office-iframe"
                    sandbox="allow-scripts allow-same-origin"
                    title="Google Docs Viewer">
                </iframe>
            </div>
        `;

    container.innerHTML = viewerHtml;
    return true;
  } catch (error) {
    console.error("Google Docs Office viewer failed:", error);
    return false;
  }
}

async function tryMicrosoftOfficeViewer(container, file, data) {
  try {
    const fileBlob = await fileToBlob(file, data);
    const tempUrl = await uploadToTempService(fileBlob, file.name);

    if (!tempUrl) throw new Error("Failed to create temporary URL");

    const viewerHtml = `
            <div class="office-viewer-container">
                <div class="office-header">
                    <div class="office-title">📄 ${escapeHtml(file.name)}</div>
                    <div class="office-security">🛡️ Microsoft Office Online Viewer</div>
                </div>
                <iframe 
                    src="https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(
                      tempUrl
                    )}&wdStartOn=1"
                    class="office-iframe"
                    sandbox="allow-scripts allow-same-origin allow-forms"
                    title="Microsoft Office Viewer">
                </iframe>
            </div>
        `;

    container.innerHTML = viewerHtml;
    return true;
  } catch (error) {
    console.error("Microsoft Office viewer failed:", error);
    return false;
  }
}

async function tryZohoViewer(container, file, data) {
  try {
    const fileBlob = await fileToBlob(file, data);
    const tempUrl = await uploadToTempService(fileBlob, file.name);

    if (!tempUrl) throw new Error("Failed to create temporary URL");

    const viewerHtml = `
            <div class="office-viewer-container">
                <div class="office-header">
                    <div class="office-title">📄 ${escapeHtml(file.name)}</div>
                    <div class="office-security">🛡️ Zoho Secure Viewer</div>
                </div>
                <iframe 
                    src="https://viewer.zoho.com/api/urlview.do?url=${encodeURIComponent(
                      tempUrl
                    )}&embed=true"
                    class="office-iframe"
                    sandbox="allow-scripts allow-same-origin"
                    title="Zoho Document Viewer">
                </iframe>
            </div>
        `;

    container.innerHTML = viewerHtml;
    return true;
  } catch (error) {
    console.error("Zoho viewer failed:", error);
    return false;
  }
}

function showOfficeError(container, file) {
  container.innerHTML = `
        <div class="file-placeholder">
            <div class="file-icon">${getFileIcon(file.type, file.name)}</div>
            <h3>Office Document</h3>
            <p><strong>${escapeHtml(file.name)}</strong></p>
            <p>Online document viewer is temporarily unavailable. You can download the file to view it.</p>
            <p>File size: ${formatFileSize(file.size)}</p>
            <div class="action-buttons" style="margin-top: 20px;">
                <button class="btn btn-primary" onclick="downloadCurrentFile()">
                    📥 Download Document
                </button>
                <button class="btn btn-secondary" onclick="retryOfficeViewer()">
                    🔄 Retry Viewer
                </button>
            </div>
        </div>
    `;
}

function displayOfficeLocal(container, file, data) {
  const fileExtension = file.name.split(".").pop().toLowerCase();
  const isWord = ["doc", "docx"].includes(fileExtension);
  const isExcel = ["xls", "xlsx"].includes(fileExtension);
  const isPowerPoint = ["ppt", "pptx"].includes(fileExtension);

  let documentType = "Document";
  let icon = "📄";

  if (isWord) {
    documentType = "Word Document";
    icon = "📝";
  } else if (isExcel) {
    documentType = "Excel Spreadsheet";
    icon = "📊";
  } else if (isPowerPoint) {
    documentType = "PowerPoint Presentation";
    icon = "📽️";
  }

  container.innerHTML = `
        <div class="office-viewer-container">
            <div class="office-header">
                <div class="office-title">${icon} ${escapeHtml(file.name)}</div>
                <div class="office-security">🛡️ Secure Local Viewer</div>
            </div>
            <div class="office-content">
                <div class="office-preview-area">
                    <div class="office-placeholder">
                        <div class="office-icon">${icon}</div>
                        <h3>${documentType}</h3>
                        <p><strong>${escapeHtml(file.name)}</strong></p>
                        <p>File size: ${formatFileSize(file.size)}</p>
                        <p>This ${documentType.toLowerCase()} is ready for secure viewing.</p>
                        
                        <div class="office-viewer-options">
                            <div class="viewer-option">
                                <h4>💾 Download & View Locally</h4>
                                <p>Download the file to view with Microsoft Office, LibreOffice, or compatible software</p>
                                <button class="btn btn-primary" onclick="downloadCurrentFile()">
                                    📥 Download Document
                                </button>
                            </div>
                            
                            ${
                              fileExtension === "docx"
                                ? `
                            <div class="viewer-option">
                                <h4>� Retry Local Viewer</h4>
                                <p>Try again to convert and view this DOCX file directly in the browser</p>
                                <button class="btn btn-secondary" onclick="retryDOCXViewer()">
                                    � Retry DOCX Viewer
                                </button>
                            </div>
                            `
                                : ""
                            }
                            
                            <div class="viewer-option">
                                <h4>🌐 Online Viewer (Requires Upload)</h4>
                                <p>Upload to Microsoft Office Online or Google Docs for cloud-based viewing</p>
                                <div style="display: flex; gap: 10px; margin-top: 10px;">
                                    <button class="btn btn-secondary" onclick="openInOfficeOnline()">
                                        Office Online
                                    </button>
                                    <button class="btn btn-secondary" onclick="tryGoogleDocsViewer()">
                                        Google Docs
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function openInOfficeOnline() {
  // Try to open in Office Online by creating a temporary accessible URL
  if (
    confirm(
      "This will upload your document to a temporary service for viewing. Continue?"
    )
  ) {
    // Create a new window with Office Online viewer
    const newWindow = window.open("about:blank");
    newWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Office Online Viewer</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; text-align: center; }
                    .message { background: #f0f8ff; padding: 20px; border-radius: 8px; margin: 20px; }
                </style>
            </head>
            <body>
                <div class="message">
                    <h2>Office Online Viewer</h2>
                    <p>Due to security restrictions, local files cannot be directly opened in Office Online.</p>
                    <p>Please download the file and upload it to <a href="https://office.com" target="_blank">Microsoft Office Online</a> for viewing.</p>
                    <button onclick="window.close()">Close</button>
                </div>
            </body>
            </html>
        `);
  }
}

function tryGoogleDocsViewer() {
  if (
    confirm(
      "This will attempt to open your document in Google Docs Viewer. This may not work for all files. Continue?"
    )
  ) {
    // Create blob URL and try Google Docs viewer
    fetch(fileData)
      .then((response) => response.blob())
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob);
        const googleViewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(
          window.location.origin + "/" + blobUrl
        )}&embedded=true`;

        const newWindow = window.open();
        newWindow.document.write(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Google Docs Viewer</title>
                        <style>
                            body { margin: 0; padding: 0; }
                            iframe { width: 100vw; height: 100vh; border: none; }
                            .error { padding: 20px; text-align: center; font-family: Arial, sans-serif; }
                        </style>
                    </head>
                    <body>
                        <iframe src="${googleViewerUrl}" onerror="showError()"></iframe>
                        <script>
                            function showError() {
                                document.body.innerHTML = '<div class="error"><h2>Viewer Error</h2><p>Could not load document in Google Docs Viewer.</p><button onclick="window.close()">Close</button></div>';
                            }
                        </script>
                    </body>
                    </html>
                `);
      })
      .catch((error) => {
        console.error("Error creating blob URL:", error);
        alert("Failed to prepare document for viewing.");
      });
  }
}

function retryDOCXViewer() {
  console.log("Retrying DOCX viewer...");
  const fileContent = document.getElementById("fileContent");
  if (fileContent && currentFile && fileData) {
    // Show loading state
    fileContent.innerHTML = `
      <div class="loading-container">
        <div class="loading-spinner"></div>
        <p>Retrying DOCX conversion...</p>
      </div>
    `;

    // Retry the DOCX viewer
    setTimeout(() => {
      tryLocalDOCXViewer(fileContent, currentFile, fileData)
        .then((success) => {
          if (!success) {
            console.log("DOCX retry failed, showing local options");
            displayOfficeLocal(fileContent, currentFile, fileData);
          }
        })
        .catch((error) => {
          console.error("DOCX retry error:", error);
          displayOfficeLocal(fileContent, currentFile, fileData);
        });
    }, 500);
  }
}

// Helper functions for PDF.js
async function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function renderPDFPage(pdf, pageNum, scale) {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale });

  const canvas = document.getElementById("pdfCanvas");
  const context = canvas.getContext("2d");

  canvas.height = viewport.height;
  canvas.width = viewport.width;

  const renderContext = {
    canvasContext: context,
    viewport: viewport,
  };

  await page.render(renderContext).promise;
}

function setupPDFControls(pdf) {
  let currentPage = 1;
  let currentScale = 1.0;

  const prevBtn = document.getElementById("prevPage");
  const nextBtn = document.getElementById("nextPage");
  const pageInfo = document.getElementById("pageInfo");
  const zoomInBtn = document.getElementById("zoomIn");
  const zoomOutBtn = document.getElementById("zoomOut");
  const zoomLevel = document.getElementById("zoomLevel");

  function updateControls() {
    prevBtn.disabled = currentPage <= 1;
    nextBtn.disabled = currentPage >= pdf.numPages;
    pageInfo.textContent = `Page ${currentPage} of ${pdf.numPages}`;
    zoomLevel.textContent = `${Math.round(currentScale * 100)}%`;
  }

  prevBtn.onclick = async () => {
    if (currentPage > 1) {
      currentPage--;
      await renderPDFPage(pdf, currentPage, currentScale);
      updateControls();
    }
  };

  nextBtn.onclick = async () => {
    if (currentPage < pdf.numPages) {
      currentPage++;
      await renderPDFPage(pdf, currentPage, currentScale);
      updateControls();
    }
  };

  zoomInBtn.onclick = async () => {
    currentScale = Math.min(currentScale * 1.2, 3.0);
    await renderPDFPage(pdf, currentPage, currentScale);
    updateControls();
  };

  zoomOutBtn.onclick = async () => {
    currentScale = Math.max(currentScale / 1.2, 0.5);
    await renderPDFPage(pdf, currentPage, currentScale);
    updateControls();
  };

  updateControls();
}

// Display archive files
function displayArchive(container, file) {
  console.log("Displaying archive file:", file.name);
  container.innerHTML = `
        <div class="file-placeholder">
            <div class="file-icon">🗜️</div>
            <h3>Archive File</h3>
            <p><strong>${escapeHtml(file.name)}</strong></p>
            <p>This archive file cannot be previewed directly in the browser for security reasons.</p>
            <p>File size: ${formatFileSize(file.size)}</p>
            <p>Download the file to extract and view its contents.</p>
            <div class="action-buttons" style="margin-top: 20px;">
                <button class="btn btn-primary" onclick="downloadCurrentFile()">
                    📥 Download Archive
                </button>
            </div>
        </div>
    `;
}

// Display unsupported files
function displayUnsupportedFile(container, file) {
  console.log("Displaying unsupported file:", file.name);
  container.innerHTML = `
        <div class="file-placeholder">
            <div class="file-icon">${getFileIcon(file.type, file.name)}</div>
            <h3>File Preview Not Available</h3>
            <p><strong>${escapeHtml(file.name)}</strong></p>
            <p>This file type cannot be previewed safely in the browser.</p>
            <p>File size: ${formatFileSize(file.size)}</p>
            <p>Download the file to view it with appropriate software.</p>
            <div class="action-buttons" style="margin-top: 20px;">
                <button class="btn btn-primary" onclick="downloadCurrentFile()">
                    📥 Download File
                </button>
            </div>
        </div>
    `;
}

// Download current file
function downloadCurrentFile() {
  if (!currentFile || !fileData) {
    showError("No file available for download");
    return;
  }

  try {
    const link = document.createElement("a");
    link.href = fileData;
    link.download = currentFile.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showSuccess(`File "${currentFile.name}" downloaded successfully`);
  } catch (error) {
    console.error("Error downloading file:", error);
    showError("Failed to download file");
  }
}

// Helper functions for file handling
async function fileToBlob(file, data) {
  if (file instanceof Blob) return file;

  // If it's file data, convert it back to blob
  if (data) {
    const response = await fetch(data);
    return await response.blob();
  }

  // Fallback: create blob from file info (this shouldn't happen in normal flow)
  return new Blob([], { type: file.type });
}

async function uploadToTempService(blob, fileName) {
  try {
    // Try multiple temporary file hosting services
    const services = [
      () => uploadToFileIO(blob, fileName),
      () => uploadToTempFileHost(blob, fileName),
      () => createLocalBlobUrl(blob),
    ];

    for (const service of services) {
      try {
        const url = await service();
        if (url) return url;
      } catch (error) {
        console.error("Temp service failed:", error);
        continue;
      }
    }

    return null;
  } catch (error) {
    console.error("All temp services failed:", error);
    return null;
  }
}

async function uploadToFileIO(blob, fileName) {
  const formData = new FormData();
  formData.append("file", blob, fileName);

  const response = await fetch("https://file.io/", {
    method: "POST",
    body: formData,
  });

  const result = await response.json();
  return result.success ? result.link : null;
}

async function uploadToTempFileHost(blob, fileName) {
  // Alternative temporary file service
  const formData = new FormData();
  formData.append("file", blob, fileName);

  const response = await fetch("https://tmpfiles.org/api/v1/upload", {
    method: "POST",
    body: formData,
  });

  const result = await response.json();
  return result.status === "success" ? result.data.url : null;
}

function createLocalBlobUrl(blob) {
  // Last resort: create a local blob URL (limited compatibility with external viewers)
  return URL.createObjectURL(blob);
}

function retryOfficeViewer() {
  if (currentFile) {
    displayOfficeDocument(
      document.getElementById("fileContent"),
      currentFile,
      fileData
    );
  }
}

function retryDOCXViewer() {
  console.log("Retrying DOCX viewer...");
  const fileContent = document.getElementById("fileContent");
  if (fileContent && currentFile && fileData) {
    // Show loading state
    fileContent.innerHTML = `
      <div class="loading-container">
        <div class="loading-spinner"></div>
        <p>Retrying DOCX conversion...</p>
      </div>
    `;

    // Retry the DOCX viewer
    setTimeout(() => {
      tryLocalDOCXViewer(fileContent, currentFile, fileData)
        .then((success) => {
          if (!success) {
            console.log("DOCX retry failed, showing local options");
            displayOfficeLocal(fileContent, currentFile, fileData);
          }
        })
        .catch((error) => {
          console.error("DOCX retry error:", error);
          displayOfficeLocal(fileContent, currentFile, fileData);
        });
    }, 500);
  }
}

function showError(message) {
  console.error("File viewer error:", message);

  const statusDiv = document.getElementById("statusMessage");
  if (statusDiv) {
    statusDiv.className = "status-message status-error";
    statusDiv.textContent = message;
    statusDiv.style.display = "block";
  }

  const fileContent = document.getElementById("fileContent");
  if (fileContent) {
    fileContent.innerHTML = `
            <div class="error-container">
                <div class="error-icon">❌</div>
                <h3>Error Loading File</h3>
                <p>${escapeHtml(message)}</p>
                <div class="action-buttons" style="margin-top: 20px;">
                    <button class="btn btn-secondary" onclick="location.reload()">
                        🔄 Retry
                    </button>
                    <button class="btn btn-secondary" onclick="downloadCurrentFile()">
                        📥 Download File
                    </button>
                </div>
            </div>
        `;
  }
}

function showSuccess(message) {
  console.log("File viewer success:", message);

  const statusDiv = document.getElementById("statusMessage");
  if (statusDiv) {
    statusDiv.className = "status-message status-success";
    statusDiv.textContent = message;
    statusDiv.style.display = "block";

    // Hide success message after 3 seconds
    setTimeout(() => {
      statusDiv.style.display = "none";
    }, 3000);
  }
}

// Utility functions
function isTextFile(fileName) {
  const textExtensions = [
    ".txt",
    ".log",
    ".md",
    ".csv",
    ".json",
    ".xml",
    ".html",
    ".css",
    ".js",
    ".py",
    ".java",
    ".cpp",
    ".c",
    ".h",
    ".php",
    ".rb",
    ".go",
    ".rs",
    ".swift",
    ".kt",
    ".ts",
    ".jsx",
    ".tsx",
    ".vue",
    ".svelte",
    ".yml",
    ".yaml",
    ".toml",
    ".ini",
    ".cfg",
    ".conf",
    ".sh",
    ".bat",
    ".ps1",
  ];
  return textExtensions.some((ext) => fileName.endsWith(ext));
}

function isOfficeFile(mimeType, fileName) {
  const officeMimes = [
    "application/vnd.openxmlformats-officedocument",
    "application/vnd.ms-",
    "application/msword",
    "application/vnd.ms-excel",
    "application/vnd.ms-powerpoint",
  ];
  const officeExtensions = [
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".ppt",
    ".pptx",
    ".odt",
    ".ods",
    ".odp",
  ];

  return (
    officeMimes.some((mime) => mimeType.includes(mime)) ||
    officeExtensions.some((ext) => fileName.endsWith(ext))
  );
}

function isArchiveFile(mimeType, fileName) {
  const archiveMimes = [
    "application/zip",
    "application/x-rar",
    "application/x-7z-compressed",
    "application/gzip",
    "application/x-tar",
  ];
  const archiveExtensions = [
    ".zip",
    ".rar",
    ".7z",
    ".tar",
    ".gz",
    ".bz2",
    ".xz",
  ];

  return (
    archiveMimes.includes(mimeType) ||
    archiveExtensions.some((ext) => fileName.endsWith(ext))
  );
}

function getFileIcon(mimeType, fileName) {
  if (mimeType.startsWith("image/")) return "🖼️";
  if (mimeType.startsWith("video/")) return "🎥";
  if (mimeType.startsWith("audio/")) return "🎵";
  if (mimeType === "application/pdf") return "📄";
  if (isOfficeFile(mimeType, fileName)) return "📝";
  if (isArchiveFile(mimeType, fileName)) return "🗜️";
  if (isTextFile(fileName)) return "📝";
  return "📄";
}

function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function escapeHtml(text) {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, function (m) {
    return map[m];
  });
}

// Event listeners
document.addEventListener("DOMContentLoaded", () => {
  console.log("File viewer DOM loaded, initializing...");
  initializeFileViewer();
});

// Refresh button
document.getElementById("refreshBtn")?.addEventListener("click", () => {
  console.log("Refresh button clicked");
  location.reload();
});

// Handle browser back button
window.addEventListener("beforeunload", async () => {
  // Clean up any remaining storage data
  try {
    await browserAPI.storage.local.remove(["pendingFileData"]);
    console.log("Cleaned up storage data");
  } catch (error) {
    console.error("Error cleaning up storage:", error);
  }
});
