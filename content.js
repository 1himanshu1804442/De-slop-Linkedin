// De-Slop LinkedIn - Content Script

// Keep track of original text elements and their de-slopped counterparts
const activeRewrites = new Map();

// Initialize the observers
function init() {
  console.log("[De-Slop] LinkedIn content script loaded. Initializing...");
  
  // 1. Initial run to catch existing elements
  processFeedPosts();
  processEditors();

  // 2. Set up MutationObserver to detect dynamically added feed posts and editors
  const observer = new MutationObserver((mutations) => {
    let shouldCheckPosts = false;
    let shouldCheckEditors = false;

    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        shouldCheckPosts = true;
        
        // Check if any added node is or contains an editor
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.querySelector('div[contenteditable="true"]') || node.getAttribute('contenteditable') === 'true') {
              shouldCheckEditors = true;
              break;
            }
          }
        }
      }
    }

    if (shouldCheckPosts) {
      processFeedPosts();
    }
    if (shouldCheckEditors) {
      processEditors();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // 3. Listen for context menu triggers from background.js
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "show_inline_overlay") {
      console.log("[De-Slop] Context menu triggered global overlay");
      createGlobalOverlay(message.text);
    }
  });
}

// -------------------------------------------------------------
// React-Safe ContentEditable Text replacement
// -------------------------------------------------------------
function setReactContentEditableText(element, text) {
  console.log("[De-Slop] Attempting to set editor text:", text);
  element.focus();
  
  // Select all existing text
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(element);
  selection.removeAllRanges();
  selection.addRange(range);

  // Natively insert text so React's synthetic event listeners intercept it
  const success = document.execCommand('insertText', false, text);

  // Fallback for Draft.js/Lexical if execCommand is blocked
  if (!success) {
    console.log("[De-Slop] execCommand insertText failed, trying paste event fallback...");
    const dataTransfer = new DataTransfer();
    dataTransfer.setData('text/plain', text);
    const pasteEvent = new ClipboardEvent('paste', {
      clipboardData: dataTransfer,
      bubbles: true,
      cancelable: true
    });
    element.dispatchEvent(pasteEvent);
  }
}

// -------------------------------------------------------------
// Post Feed Processing
// -------------------------------------------------------------
function processFeedPosts() {
  // Select structural containers that hold post text as requested
  const posts = document.querySelectorAll('span[data-testid="expandable-text-box"]:not([data-deslop-processed])');

  if (posts.length > 0) {
    console.log(`[De-Slop] Found ${posts.length} unprocessed posts`);
  }

  posts.forEach(post => {
    post.setAttribute("data-deslop-processed", "true");
    console.log("[De-Slop] Injecting button into post text container:", post);
    const button = injectDeSlopButton(post, post);

    // Auto-Pilot Logic
    chrome.storage.local.get(["autoPilotEnabled", "selectedPersona"], (result) => {
      if (result.autoPilotEnabled) {
        const persona = result.selectedPersona || "honesty";
        console.log(`[De-Slop] Auto-Pilot active. Translating post in style: ${persona}`);
        triggerFeedRewrite(post, post, persona, button);
      }
    });
  });
}

function injectDeSlopButton(postElement, textContainer) {
  // Create a shadow host container for our UI
  const host = document.createElement("div");
  host.className = "deslop-feed-widget";
  host.style.float = "right";
  host.style.marginLeft = "8px";
  host.style.marginBottom = "4px";
  host.style.position = "relative";
  host.style.zIndex = "5";

  // Insert before textContainer as a sibling so hiding textContainer won't hide the button widget
  if (textContainer.parentNode) {
    textContainer.parentNode.insertBefore(host, textContainer);
  } else {
    textContainer.prepend(host);
  }

  const shadow = host.attachShadow({ mode: "open" });
  
  // Create button inside shadow DOM
  const button = document.createElement("button");
  button.className = "deslop-btn";
  button.innerHTML = "De-Slop ✨";
  
  // Style for the button & menu
  const style = document.createElement("style");
  style.textContent = `
    .deslop-btn {
      background: linear-gradient(135deg, #8A2387 0%, #E94057 50%, #F27121 100%);
      color: white;
      border: none;
      border-radius: 20px;
      padding: 4px 10px;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 2px 5px rgba(233, 64, 87, 0.3);
      transition: all 0.2s ease;
      display: inline-flex;
      align-items: center;
      gap: 3px;
      user-select: none;
    }
    .deslop-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 8px rgba(233, 64, 87, 0.4);
    }
    .deslop-btn:active {
      transform: translateY(0);
    }
    .deslop-btn.active-rewrite {
      background: #242526;
      border: 1px solid #E94057;
      color: #E94057;
      box-shadow: none;
    }
    .deslop-btn.loading {
      background: #444;
      cursor: not-allowed;
      animation: pulse 1.5s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }
    .menu {
      position: absolute;
      top: 100%;
      right: 0;
      margin-top: 6px;
      background: #18191a;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
      display: none;
      flex-direction: column;
      width: 140px;
      z-index: 100;
      overflow: hidden;
      font-family: system-ui, -apple-system, sans-serif;
    }
    .menu.show {
      display: flex;
    }
    .menu-item {
      padding: 8px 12px;
      color: #e4e6eb;
      font-size: 11px;
      cursor: pointer;
      text-align: left;
      background: none;
      border: none;
      width: 100%;
      transition: background 0.15s ease;
    }
    .menu-item:hover {
      background: #242526;
      color: white;
    }
  `;

  // Create style selector menu
  const menu = document.createElement("div");
  menu.className = "menu";
  
  const styles = [
    { id: "honesty", name: "🎯 Brutal Honesty" },
    { id: "genz", name: "⚡ Gen Z / Brainrot" },
    { id: "shakespeare", name: "✍️ Shakespearean" },
    { id: "harrypotter", name: "🧙‍♂️ Hogwarts Style" },
    { id: "pirate", name: "🏴‍☠️ High-Seas Pirate" },
    { id: "yoda", name: "👽 Yoda Style" }
  ];

  styles.forEach(item => {
    const menuItem = document.createElement("button");
    menuItem.className = "menu-item";
    menuItem.textContent = item.name;
    menuItem.addEventListener("click", (e) => {
      e.stopPropagation();
      menu.classList.remove("show");
      triggerFeedRewrite(postElement, textContainer, item.id, button);
    });
    menu.appendChild(menuItem);
  });

  // Toggle menu visibility
  button.addEventListener("click", (e) => {
    e.stopPropagation();
    
    // If we've already rewritten it, clicking the button acts as a toggle back to original
    if (button.classList.contains("active-rewrite")) {
      restoreFeedPost(postElement, textContainer, button);
      return;
    }

    // Close all other open De-slop menus
    document.querySelectorAll(".deslop-feed-widget").forEach(w => {
      if (w.shadowRoot) {
        w.shadowRoot.querySelector(".menu")?.classList.remove("show");
      }
    });

    menu.classList.toggle("show");
  });

  // Close menu when clicking outside
  document.addEventListener("click", () => {
    menu.classList.remove("show");
  });

  shadow.appendChild(style);
  shadow.appendChild(button);
  shadow.appendChild(menu);
  return button;
}

// Perform rewrite for feed post
function triggerFeedRewrite(postElement, textContainer, style, button) {
  const textToRewrite = textContainer.innerText.trim();
  if (!textToRewrite) return;

  button.classList.add("loading");
  button.textContent = "Translating... ⚙️";

  chrome.runtime.sendMessage(
    {
      action: "call_gemini",
      text: textToRewrite,
      style: style
    },
    (response) => {
      button.classList.remove("loading");

      if (response && response.success) {
        // Find or create output container (slopContainer)
        let slopContainer = textContainer.parentNode.querySelector('.deslop-output-container');
        if (!slopContainer) {
          slopContainer = document.createElement('div');
          slopContainer.className = 'deslop-output-container';
          
          // --- NEW NATIVE STYLING ---
          // Force the text to use LinkedIn's main text color variable, fallback to black
          slopContainer.style.color = 'var(--color-text, #000000)'; 
          slopContainer.style.fontSize = '14px'; // Native LinkedIn font size
          slopContainer.style.lineHeight = '1.42857'; // Native line height
          slopContainer.style.marginTop = '8px';
          slopContainer.style.whiteSpace = 'pre-wrap'; // Preserves line breaks nicely
          
          // Insert right after textContainer
          textContainer.parentNode.insertBefore(slopContainer, textContainer.nextSibling);
        }

        slopContainer.innerText = response.text;
        
        // Hide the original, show the new
        textContainer.style.display = 'none';
        slopContainer.style.display = 'block';

        // Save states for toggling
        activeRewrites.set(postElement, {
          originalEl: textContainer,
          rewrittenEl: slopContainer
        });

        // Change button to toggle restore
        button.classList.add("active-rewrite");
        button.textContent = "Restore ↩️";
      } else {
        alert("De-Slop Error: " + (response ? response.error : "Failed to communicate with background task. Make sure you set your API Key."));
        button.textContent = "De-Slop ✨";
      }
    }
  );
}

function restoreFeedPost(postElement, textContainer, button) {
  const rewrite = activeRewrites.get(postElement);
  if (rewrite) {
    // Remove the rewritten element
    rewrite.rewrittenEl.remove();
    // Show original element again
    rewrite.originalEl.style.display = "";
    
    activeRewrites.delete(postElement);
  }

  // Restore button state
  button.classList.remove("active-rewrite");
  button.textContent = "De-Slop ✨";
}

// -------------------------------------------------------------
// Post Composer Editor Processing
// -------------------------------------------------------------
function processEditors() {
  // Find any active contenteditable text editors based on robust structural selectors
  const editors = document.querySelectorAll(
    'div[role="textbox"][contenteditable="true"]:not([data-deslop-processed]), .ql-editor:not([data-deslop-processed])'
  );

  if (editors.length > 0) {
    console.log(`[De-Slop] Found ${editors.length} unprocessed editors`);
  }

  editors.forEach(editor => {
    editor.setAttribute("data-deslop-processed", "true");
    console.log("[De-Slop] Injecting widget into editor:", editor);
    injectEditorWidget(editor);
  });
}

function injectEditorWidget(editor) {
  // Find the wrapper container of the editor so we can absolute position relative to it
  const wrapper = editor.parentElement;
  if (!wrapper) return;

  // Make sure wrapper has a relative positioning so widget doesn't fly off
  const computedStyle = window.getComputedStyle(wrapper);
  if (computedStyle.position === "static") {
    wrapper.style.position = "relative";
  }

  // Create shadow host container
  const host = document.createElement("div");
  host.className = "deslop-editor-widget";
  host.style.position = "absolute";
  host.style.bottom = "8px";
  host.style.right = "8px";
  host.style.zIndex = "100";

  wrapper.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });

  const button = document.createElement("button");
  button.className = "editor-widget-btn";
  button.innerHTML = "✨";
  button.title = "De-Slop Editor draft";

  const style = document.createElement("style");
  style.textContent = `
    .editor-widget-btn {
      background: linear-gradient(135deg, #8A2387 0%, #E94057 50%, #F27121 100%);
      color: white;
      border: none;
      width: 26px;
      height: 26px;
      border-radius: 50%;
      cursor: pointer;
      font-size: 13px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      transition: all 0.2s ease;
      user-select: none;
    }
    .editor-widget-btn:hover {
      transform: scale(1.1);
      box-shadow: 0 4px 10px rgba(233, 64, 87, 0.5);
    }
    .editor-widget-btn:active {
      transform: scale(1.0);
    }
    .editor-widget-btn.loading {
      background: #444;
      animation: spin 1.5s linear infinite;
    }
    @keyframes spin {
      100% { transform: rotate(360deg); }
    }
    .menu {
      position: absolute;
      bottom: 32px;
      right: 0;
      background: #18191a;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
      display: none;
      flex-direction: column;
      width: 140px;
      z-index: 101;
      overflow: hidden;
      font-family: system-ui, -apple-system, sans-serif;
    }
    .menu.show {
      display: flex;
    }
    .menu-item {
      padding: 8px 12px;
      color: #e4e6eb;
      font-size: 11px;
      cursor: pointer;
      text-align: left;
      background: none;
      border: none;
      width: 100%;
      transition: background 0.15s ease;
    }
    .menu-item:hover {
      background: #242526;
      color: white;
    }
  `;

  const menu = document.createElement("div");
  menu.className = "menu";

  const styles = [
    { id: "honesty", name: "🎯 Brutal Honesty" },
    { id: "genz", name: "⚡ Gen Z / Brainrot" },
    { id: "shakespeare", name: "✍️ Shakespearean" },
    { id: "harrypotter", name: "🧙‍♂️ Hogwarts Style" },
    { id: "pirate", name: "🏴‍☠️ High-Seas Pirate" },
    { id: "yoda", name: "👽 Yoda Style" }
  ];

  styles.forEach(item => {
    const menuItem = document.createElement("button");
    menuItem.className = "menu-item";
    menuItem.textContent = item.name;
    menuItem.addEventListener("click", (e) => {
      e.stopPropagation();
      menu.classList.remove("show");
      triggerEditorRewrite(editor, item.id, button);
    });
    menu.appendChild(menuItem);
  });

  button.addEventListener("click", (e) => {
    e.stopPropagation();
    menu.classList.toggle("show");
  });

  document.addEventListener("click", () => {
    menu.classList.remove("show");
  });

  shadow.appendChild(style);
  shadow.appendChild(button);
  shadow.appendChild(menu);
}

function triggerEditorRewrite(editorElement, style, button) {
  const currentText = editorElement.innerText || editorElement.textContent;
  if (!currentText.trim()) {
    alert("Please write something in the editor box first!");
    return;
  }

  button.classList.add("loading");
  button.innerHTML = "⚙️"; // Loading gear icon

  chrome.runtime.sendMessage(
    {
      action: "call_gemini",
      text: currentText,
      style: style
    },
    (response) => {
      button.classList.remove("loading");
      button.innerHTML = "✨";

      if (response && response.success) {
        // Safely set text inside React contenteditable
        setReactContentEditableText(editorElement, response.text);
      } else {
        alert("De-Slop Error: " + (response ? response.error : "Failed to communicate with background task. Make sure you set your API Key."));
      }
    }
  );
}

// -------------------------------------------------------------
// Global Selection Overlay (Right-Click Context Menu)
// -------------------------------------------------------------
function createGlobalOverlay(selectedText) {
  // Remove existing overlay if present
  const existing = document.getElementById("deslop-global-overlay-host");
  if (existing) existing.remove();

  const host = document.createElement("div");
  host.id = "deslop-global-overlay-host";
  host.style.position = "fixed";
  host.style.top = "10%";
  host.style.right = "10%";
  host.style.zIndex = "999999";
  
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = `
    .overlay-card {
      background: #18191a;
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 12px;
      width: 320px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.6);
      padding: 16px;
      color: #e4e6eb;
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid rgba(255,255,255,0.1);
      padding-bottom: 8px;
    }
    .title {
      font-size: 14px;
      font-weight: 700;
      color: white;
    }
    .close-btn {
      background: none;
      border: none;
      color: #b0b3b8;
      cursor: pointer;
      font-size: 16px;
    }
    .close-btn:hover {
      color: white;
    }
    .text-box {
      background: #242526;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 6px;
      padding: 8px;
      font-size: 12px;
      max-height: 80px;
      overflow-y: auto;
      white-space: pre-wrap;
      color: #b0b3b8;
    }
    .select-label {
      font-size: 11px;
      color: #b0b3b8;
      font-weight: 600;
    }
    .style-select {
      background: #242526;
      color: white;
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 6px;
      padding: 6px;
      font-size: 12px;
      outline: none;
    }
    .action-btn {
      background: linear-gradient(135deg, #8A2387 0%, #E94057 50%, #F27121 100%);
      color: white;
      border: none;
      border-radius: 8px;
      padding: 8px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(233, 64, 87, 0.3);
      transition: all 0.2s;
    }
    .action-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(233, 64, 87, 0.4);
    }
    .action-btn.loading {
      background: #444;
      cursor: not-allowed;
      animation: pulse 1.5s infinite;
    }
    .output-area {
      background: #242526;
      border: 1px solid #E94057;
      border-radius: 6px;
      padding: 8px;
      font-size: 12px;
      max-height: 120px;
      overflow-y: auto;
      white-space: pre-wrap;
      color: white;
      font-style: italic;
    }
    .copy-btn {
      background: #3a3b3c;
      color: white;
      border: none;
      border-radius: 6px;
      padding: 5px;
      font-size: 11px;
      cursor: pointer;
      transition: background 0.2s;
    }
    .copy-btn:hover {
      background: #4e4f50;
    }
  `;

  const card = document.createElement("div");
  card.className = "overlay-card";

  // Header
  const header = document.createElement("div");
  header.className = "header";
  header.innerHTML = `
    <span class="title">De-Slop Selected Text ✨</span>
    <button class="close-btn">&times;</button>
  `;
  card.appendChild(header);

  // Close handler
  header.querySelector(".close-btn").addEventListener("click", () => {
    host.remove();
  });

  // Original selection preview
  const originalPreview = document.createElement("div");
  originalPreview.className = "text-box";
  originalPreview.textContent = selectedText;
  card.appendChild(originalPreview);

  // Select dropdown
  const selectLabel = document.createElement("div");
  selectLabel.className = "select-label";
  selectLabel.textContent = "Select Translation Style:";
  card.appendChild(selectLabel);

  const select = document.createElement("select");
  select.className = "style-select";
  const styles = [
    { id: "honesty", name: "🎯 Brutal Honesty" },
    { id: "genz", name: "⚡ Gen Z / Brainrot" },
    { id: "shakespeare", name: "✍️ Shakespearean" },
    { id: "harrypotter", name: "🧙‍♂️ Hogwarts Style" },
    { id: "pirate", name: "🏴‍☠️ High-Seas Pirate" },
    { id: "yoda", name: "👽 Yoda Style" }
  ];
  styles.forEach(item => {
    const opt = document.createElement("option");
    opt.value = item.id;
    opt.textContent = item.name;
    select.appendChild(opt);
  });
  card.appendChild(select);

  // Transform Button
  const btn = document.createElement("button");
  btn.className = "action-btn";
  btn.textContent = "Transform Selected Text";
  card.appendChild(btn);

  // Output container
  const outputWrapper = document.createElement("div");
  outputWrapper.style.display = "none";
  outputWrapper.style.flexDirection = "column";
  outputWrapper.style.gap = "8px";

  const outputLabel = document.createElement("div");
  outputLabel.className = "select-label";
  outputLabel.textContent = "De-Slopped Result:";
  outputWrapper.appendChild(outputLabel);

  const output = document.createElement("div");
  output.className = "output-area";
  outputWrapper.appendChild(output);

  const copy = document.createElement("button");
  copy.className = "copy-btn";
  copy.textContent = "Copy to Clipboard";
  outputWrapper.appendChild(copy);

  card.appendChild(outputWrapper);

  // Click Transform handler
  btn.addEventListener("click", () => {
    btn.classList.add("loading");
    btn.textContent = "Processing... ⚙️";
    btn.disabled = true;

    chrome.runtime.sendMessage(
      {
        action: "call_gemini",
        text: selectedText,
        style: select.value
      },
      (response) => {
        btn.classList.remove("loading");
        btn.textContent = "Transform Selected Text";
        btn.disabled = false;

        if (response && response.success) {
          outputWrapper.style.display = "flex";
          output.textContent = response.text;
          
          // Copy listener
          copy.onclick = () => {
            navigator.clipboard.writeText(response.text).then(() => {
              copy.textContent = "Copied! ✓";
              setTimeout(() => {
                copy.textContent = "Copy to Clipboard";
              }, 1500);
            });
          };
        } else {
          alert("De-Slop Error: " + (response ? response.error : "Failed to connect to background."));
        }
      }
    );
  });

  shadow.appendChild(style);
  shadow.appendChild(card);
}

// Start execution
init();
