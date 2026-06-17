// De-Slop LinkedIn - Content Script

// Keep track of original text elements and their de-slopped counterparts
const activeRewrites = new Map();

let customPersonas = [];
const DEFAULT_PERSONAS = [
  { id: "honesty", name: "🎯 Brutal Honesty" },
  { id: "genz", name: "⚡ Gen Z / Brainrot" },
  { id: "shakespeare", name: "✍️ Shakespearean" },
  { id: "harrypotter", name: "🧙‍♂️ Hogwarts Style" },
  { id: "pirate", name: "🏴‍☠️ High-Seas Pirate" },
  { id: "yoda", name: "👽 Yoda Style" },
  { id: "anime", name: "🔥 Anime Protagonist" },
  { id: "cyberpunk", name: "🦾 Cyberpunk Choom" }
];

function getStylesList() {
  const customList = customPersonas.map(p => ({
    id: p.id,
    name: `${p.icon} ${p.name}`
  }));
  return [...DEFAULT_PERSONAS, ...customList];
}

// Queue system to handle API rate limiting
const translationQueue = [];
let isQueueProcessing = false;
let queuePauseUntil = 0;
let lastRequestStartTime = 0;

async function processTranslationQueue() {
  if (isQueueProcessing) return;
  isQueueProcessing = true;

  while (translationQueue.length > 0) {
    if (Date.now() < queuePauseUntil) {
      // If we are rate limited, clear the queue of stale automatic tasks
      translationQueue.length = 0;
      break;
    }

    const task = translationQueue.shift();

    // Calculate delay needed to stay under 20 RPM (minimum 4.0 seconds start-to-start to be safe)
    const minStartInterval = 4000;
    const timeSinceLastStart = Date.now() - lastRequestStartTime;
    const delayNeeded = Math.max(0, minStartInterval - timeSinceLastStart);

    if (delayNeeded > 0) {
      await new Promise(resolve => setTimeout(resolve, delayNeeded));
    }

    // Double check queuePauseUntil after the delay in case a manual request rate-limited us
    if (Date.now() < queuePauseUntil) {
      break;
    }

    lastRequestStartTime = Date.now();
    await task.run();
  }
  
  isQueueProcessing = false;
}

// Intersection Observer for scroll-debouncing
const viewportObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    const { target, isIntersecting } = entry;
    
    if (isIntersecting) {
      // Post is in view. Wait 800ms to see if user stops scrolling.
      target._deslopTimer = setTimeout(() => {
        chrome.storage.local.get(["autoPilotEnabled", "selectedPersona"], (result) => {
          if (result.autoPilotEnabled) {
            const persona = result.selectedPersona || "honesty";
            
            // Check if already processed or failed
            const rewrite = activeRewrites.get(target);
            const button = target._deslopButton; // Reference saved during injection
            
            if (!rewrite && !target._deslopFailed && button && !button.classList.contains("loading")) {
              const isAlreadyQueued = translationQueue.some(t => t.element === target);
              if (!isAlreadyQueued) {
                translationQueue.push({
                  element: target,
                  run: async () => {
                    return new Promise(resolve => {
                      triggerFeedRewrite(target, target, persona, button, resolve);
                    });
                  }
                });
                processTranslationQueue();
              }
            }
          }
        });
      }, 800);
    } else {
      // Post scrolled out of view
      if (target._deslopTimer) {
        clearTimeout(target._deslopTimer);
        target._deslopTimer = null;
      }
      // Remove from translation queue if it hasn't started translating yet
      const index = translationQueue.findIndex(t => t.element === target);
      if (index !== -1) {
        translationQueue.splice(index, 1);
      }
    }
  });
}, { threshold: 0.5 }); // 50% visibility required


// Initialize the observers
function init() {
  console.log("[De-Slop] LinkedIn content script loaded. Initializing...");
  
  // Load personas
  chrome.storage.local.get("customPersonas", (data) => {
    customPersonas = data.customPersonas || [];
  });
  
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === "local" && changes.customPersonas) {
      customPersonas = changes.customPersonas.newValue || [];
    }
  });

  // 1. Initial run to catch existing elements
  processFeedPosts();
  processEditors();

  // 2. Set up MutationObserver
  const observer = new MutationObserver((mutations) => {
    let shouldCheckPosts = false;
    let shouldCheckEditors = false;

    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        shouldCheckPosts = true;
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

    if (shouldCheckPosts) processFeedPosts();
    if (shouldCheckEditors) processEditors();
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
  element.focus();
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(element);
  selection.removeAllRanges();
  selection.addRange(range);

  const success = document.execCommand('insertText', false, text);
  if (!success) {
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
  const posts = document.querySelectorAll('span[data-testid="expandable-text-box"]:not([data-deslop-processed])');

  posts.forEach(post => {
    post.setAttribute("data-deslop-processed", "true");
    const button = injectDeSlopButton(post, post);
    post._deslopButton = button; // Store reference for the observer
    
    // Start tracking for auto-translate
    viewportObserver.observe(post);
  });
}

function injectDeSlopButton(postElement, textContainer) {
  const host = document.createElement("div");
  host.className = "deslop-feed-widget";
  host.style.float = "right";
  host.style.marginLeft = "8px";
  host.style.marginBottom = "4px";
  host.style.position = "relative";
  host.style.zIndex = "5";

  if (textContainer.parentNode) {
    textContainer.parentNode.insertBefore(host, textContainer);
  } else {
    textContainer.prepend(host);
  }

  const shadow = host.attachShadow({ mode: "open" });
  const button = document.createElement("button");
  button.className = "deslop-btn";
  button.innerHTML = "De-Slop ✨";
  
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
      width: 160px;
      max-height: 200px;
      overflow-y: auto;
      z-index: 100;
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
  
  // Toggle menu visibility
  button.addEventListener("click", (e) => {
    e.stopPropagation();
    
    if (button.classList.contains("active-rewrite")) {
      restoreFeedPost(postElement, textContainer, button);
      return;
    }

    document.querySelectorAll(".deslop-feed-widget").forEach(w => {
      if (w.shadowRoot) {
        w.shadowRoot.querySelector(".menu")?.classList.remove("show");
      }
    });

    // Populate dynamic menu
    menu.innerHTML = '';
    const currentStyles = getStylesList();
    currentStyles.forEach(item => {
      const menuItem = document.createElement("button");
      menuItem.className = "menu-item";
      menuItem.textContent = item.name;
      menuItem.addEventListener("click", (ev) => {
        ev.stopPropagation();
        menu.classList.remove("show");
        triggerFeedRewrite(postElement, textContainer, item.id, button);
      });
      menu.appendChild(menuItem);
    });

    menu.classList.toggle("show");
  });

  document.addEventListener("click", () => {
    menu.classList.remove("show");
  });

  shadow.appendChild(style);
  shadow.appendChild(button);
  shadow.appendChild(menu);
  return button;
}

// Perform rewrite for feed post
function triggerFeedRewrite(postElement, textContainer, style, button, onComplete) {
  const textToRewrite = textContainer.innerText.trim();
  if (!textToRewrite) {
    if (onComplete) onComplete();
    return;
  }

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
        let slopContainer = textContainer.parentNode.querySelector('.deslop-output-container');
        if (!slopContainer) {
          slopContainer = document.createElement('div');
          slopContainer.className = 'deslop-output-container';
          slopContainer.style.color = 'var(--color-text, #000000)'; 
          slopContainer.style.fontSize = '14px';
          slopContainer.style.lineHeight = '1.42857';
          slopContainer.style.marginTop = '8px';
          slopContainer.style.whiteSpace = 'pre-wrap';
          textContainer.parentNode.insertBefore(slopContainer, textContainer.nextSibling);
        }

        slopContainer.innerText = response.text;
        textContainer.style.display = 'none';
        slopContainer.style.display = 'block';

        activeRewrites.set(postElement, {
          originalEl: textContainer,
          rewrittenEl: slopContainer
        });

        button.classList.add("active-rewrite");
        button.textContent = "Restore ↩️";
      } else {
        console.error("De-Slop Error:", response?.error);
        
        const errText = response?.error?.toLowerCase() || "";
        const isRateLimit = errText.includes("quota") || 
                            errText.includes("rate limit") || 
                            errText.includes("exhausted") || 
                            errText.includes("429") || 
                            errText.includes("403") ||
                            errText.includes("limit exceeded");

        if (isRateLimit) {
          button.textContent = "Rate Limit ⏳";
          button.style.background = "#555";
          
          // Pause queue for 60 seconds and mark this post as failed so it isn't re-queued
          queuePauseUntil = Date.now() + 60000;
          postElement._deslopFailed = true;
        } else {
          button.textContent = "Error ❌";
          button.style.background = "#8b0000";
        }
        
        // Reset after 5 seconds so they can try again
        setTimeout(() => {
          if (!button.classList.contains("active-rewrite") && !button.classList.contains("loading")) {
            button.textContent = "De-Slop ✨";
            button.style.background = "";
          }
        }, 5000);
      }

      if (onComplete) onComplete();
    }
  );
}

function restoreFeedPost(postElement, textContainer, button) {
  const rewrite = activeRewrites.get(postElement);
  if (rewrite) {
    rewrite.rewrittenEl.remove();
    rewrite.originalEl.style.display = "";
    activeRewrites.delete(postElement);
  }
  button.classList.remove("active-rewrite");
  button.textContent = "De-Slop ✨";
}

// -------------------------------------------------------------
// Post Composer Editor Processing
// -------------------------------------------------------------
function processEditors() {
  const editors = document.querySelectorAll(
    'div[role="textbox"][contenteditable="true"]:not([data-deslop-processed]), .ql-editor:not([data-deslop-processed])'
  );

  editors.forEach(editor => {
    editor.setAttribute("data-deslop-processed", "true");
    injectEditorWidget(editor);
  });
}

function injectEditorWidget(editor) {
  const wrapper = editor.parentElement;
  if (!wrapper) return;

  const computedStyle = window.getComputedStyle(wrapper);
  if (computedStyle.position === "static") {
    wrapper.style.position = "relative";
  }

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
      width: 160px;
      max-height: 200px;
      overflow-y: auto;
      z-index: 101;
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

  button.addEventListener("click", (e) => {
    e.stopPropagation();
    
    // Dynamically render menu
    menu.innerHTML = '';
    const currentStyles = getStylesList();
    currentStyles.forEach(item => {
      const menuItem = document.createElement("button");
      menuItem.className = "menu-item";
      menuItem.textContent = item.name;
      menuItem.addEventListener("click", (ev) => {
        ev.stopPropagation();
        menu.classList.remove("show");
        triggerEditorRewrite(editor, item.id, button);
      });
      menu.appendChild(menuItem);
    });

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
  button.innerHTML = "⚙️"; 

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
        setReactContentEditableText(editorElement, response.text);
      } else {
        alert("De-Slop Error: " + (response ? response.error : "Failed to communicate with background task."));
      }
    }
  );
}

// -------------------------------------------------------------
// Global Selection Overlay (Right-Click Context Menu)
// -------------------------------------------------------------
function createGlobalOverlay(selectedText) {
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

  const header = document.createElement("div");
  header.className = "header";
  header.innerHTML = `
    <span class="title">De-Slop Selected Text ✨</span>
    <button class="close-btn">&times;</button>
  `;
  card.appendChild(header);

  header.querySelector(".close-btn").addEventListener("click", () => {
    host.remove();
  });

  const originalPreview = document.createElement("div");
  originalPreview.className = "text-box";
  originalPreview.textContent = selectedText;
  card.appendChild(originalPreview);

  const selectLabel = document.createElement("div");
  selectLabel.className = "select-label";
  selectLabel.textContent = "Select Translation Style:";
  card.appendChild(selectLabel);

  const select = document.createElement("select");
  select.className = "style-select";
  
  // Dynamic options
  const currentStyles = getStylesList();
  currentStyles.forEach(item => {
    const opt = document.createElement("option");
    opt.value = item.id;
    opt.textContent = item.name;
    select.appendChild(opt);
  });
  card.appendChild(select);

  const btn = document.createElement("button");
  btn.className = "action-btn";
  btn.textContent = "Transform Selected Text";
  card.appendChild(btn);

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
