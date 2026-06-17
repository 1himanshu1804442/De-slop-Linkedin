document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const settingsBtn = document.getElementById("settings-btn");
  const settingsPanel = document.getElementById("settings-panel");
  const personasBtn = document.getElementById("personas-btn");
  const personasPanel = document.getElementById("personas-panel");
  
  const apiKeyInput = document.getElementById("api-key-input");
  const toggleKeyVisibility = document.getElementById("toggle-key-visibility");
  const saveSettingsBtn = document.getElementById("save-settings-btn");
  const settingsStatus = document.getElementById("settings-status");

  const customPersonasList = document.getElementById("custom-personas-list");
  const personaNameInput = document.getElementById("persona-name-input");
  const personaEmojiInput = document.getElementById("persona-emoji-input");
  const personaPromptInput = document.getElementById("persona-prompt-input");
  const savePersonaBtn = document.getElementById("save-persona-btn");
  const personasStatus = document.getElementById("personas-status");

  const styleGrid = document.getElementById("style-grid");
  const statusCard = document.getElementById("status-card");
  const statusIcon = statusCard.querySelector(".status-icon");
  const statusTitle = statusCard.querySelector(".status-title");
  const statusDesc = statusCard.querySelector(".status-desc");

  const inputText = document.getElementById("input-text");
  const clearBtn = document.getElementById("clear-btn");
  const charCount = document.getElementById("char-count");
  const transformBtn = document.getElementById("transform-btn");
  const autoPilotToggle = document.getElementById("autoPilotToggle");

  const outputContainer = document.getElementById("output-container");
  const outputText = document.getElementById("output-text");
  const copyBtn = document.getElementById("copy-btn");
  const copyToast = document.getElementById("copy-toast");

  const errorContainer = document.getElementById("error-container");
  const errorMessage = document.getElementById("error-message");

  let activeStyle = "honesty";
  let customPersonas = [];
  let isApiKeySaved = false;
  let isLocalAiAvailable = false;
  let freeUsesCount = 0;
  const MAX_FREE_USES = 5;

  const DEFAULT_PERSONAS = [
    { id: "honesty", name: "Brutal Honesty", desc: "Real truth, zero PR fluff", icon: "🎯" },
    { id: "genz", name: "Gen Z / Brainrot", desc: "No cap, maximum rizz", icon: "⚡" },
    { id: "shakespeare", name: "Shakespearean", desc: "Thou art grandiloquent", icon: "✍️" },
    { id: "harrypotter", name: "Hogwarts Style", desc: "By Merlin's beard!", icon: "🧙‍♂️" },
    { id: "pirate", name: "High-Seas Pirate", desc: "Ahoy, scallywags!", icon: "🏴‍☠️" },
    { id: "yoda", name: "Yoda Style", desc: "Rewrite, we must", icon: "👽" },
    { id: "anime", name: "Anime Protagonist", desc: "Believe it! Dattebayo!", icon: "🔥" },
    { id: "cyberpunk", name: "Cyberpunk Choom", desc: "High tech, low life", icon: "🦾" }
  ];

  // 1. Initial Checks and State Setup
  async function initialize() {
    // Check Local AI Capabilities
    if (typeof window.ai !== 'undefined' && window.ai.languageModel) {
      try {
        const caps = await window.ai.languageModel.capabilities();
        isLocalAiAvailable = caps.available !== 'no';
      } catch (e) {
        isLocalAiAvailable = false;
      }
    } else {
      isLocalAiAvailable = false;
    }

    // Load Storage
    chrome.storage.local.get(["gemini_api_key", "autoPilotEnabled", "selectedPersona", "customPersonas", "freeUsesCount"], (data) => {
      isApiKeySaved = !!data.gemini_api_key;
      if (isApiKeySaved) {
        apiKeyInput.value = data.gemini_api_key;
        apiKeyInput.placeholder = "Saved (API Key Encrypted)";
      }
      
      if (data.autoPilotEnabled) autoPilotToggle.checked = true;
      if (data.selectedPersona) activeStyle = data.selectedPersona;
      
      customPersonas = data.customPersonas || [];
      freeUsesCount = data.freeUsesCount || 0;
      
      renderStyleGrid();
      renderCustomPersonasList();
      updateStatusCard();
    });
  }

  // Render Status Card
  function updateStatusCard() {
    statusCard.className = "status-card";
    
    if (isApiKeySaved) {
      statusCard.classList.add("state-api-active");
      statusIcon.textContent = "✨";
      statusTitle.textContent = "Personal API Key Active";
      statusDesc.textContent = "Unlimited cloud translations enabled";
      transformBtn.disabled = false;
    } else if (isLocalAiAvailable && freeUsesCount < MAX_FREE_USES) {
      statusCard.classList.add("state-local-ai");
      statusIcon.textContent = "💻";
      statusTitle.textContent = "On-Device AI Active";
      statusDesc.textContent = `${MAX_FREE_USES - freeUsesCount} of ${MAX_FREE_USES} free local uses remaining`;
      transformBtn.disabled = false;
    } else {
      statusCard.classList.add("state-api-required");
      statusIcon.textContent = "🔑";
      statusTitle.textContent = "Setup Required: API Key";
      statusDesc.textContent = "Click here to add your free Google AI Studio Key";
      transformBtn.disabled = true;
      
      statusCard.onclick = () => {
        personasPanel.classList.add("hidden");
        settingsPanel.classList.remove("hidden");
      };
    }
  }

  // Render Style Grid
  function renderStyleGrid() {
    styleGrid.innerHTML = "";
    const allPersonas = [...DEFAULT_PERSONAS, ...customPersonas];
    
    // Ensure activeStyle is valid, else fallback
    if (!allPersonas.find(p => p.id === activeStyle)) {
      activeStyle = "honesty";
    }

    allPersonas.forEach(p => {
      const card = document.createElement("div");
      card.className = `style-card ${p.id === activeStyle ? "active" : ""}`;
      card.dataset.style = p.id;
      
      card.innerHTML = `
        <div class="card-glow"></div>
        <div class="card-icon">${p.icon}</div>
        <div class="card-meta">
          <span class="card-title">${p.name}</span>
          <span class="card-desc">${p.desc || 'Custom Persona'}</span>
        </div>
      `;
      
      card.addEventListener("click", () => {
        document.querySelectorAll(".style-card").forEach(c => c.classList.remove("active"));
        card.classList.add("active");
        activeStyle = p.id;
        chrome.storage.local.set({ selectedPersona: p.id });
      });
      
      styleGrid.appendChild(card);
    });
  }

  // Render Custom Personas List in Panel
  function renderCustomPersonasList() {
    customPersonasList.innerHTML = "";
    if (customPersonas.length === 0) {
      customPersonasList.innerHTML = `<span style="font-size: 0.8rem; color: var(--text-muted);">No custom personas yet. Create one below!</span>`;
      return;
    }

    customPersonas.forEach(p => {
      const item = document.createElement("div");
      item.className = "persona-item";
      item.innerHTML = `
        <div class="persona-info">
          <span>${p.icon}</span>
          <span>${p.name}</span>
        </div>
        <button class="delete-persona-btn" title="Delete">&times;</button>
      `;
      
      item.querySelector(".delete-persona-btn").addEventListener("click", () => {
        customPersonas = customPersonas.filter(custom => custom.id !== p.id);
        chrome.storage.local.set({ customPersonas }, () => {
          renderCustomPersonasList();
          renderStyleGrid();
        });
      });
      
      customPersonasList.appendChild(item);
    });
  }

  // Save New Custom Persona
  savePersonaBtn.addEventListener("click", () => {
    const name = personaNameInput.value.trim();
    const emoji = personaEmojiInput.value.trim();
    const prompt = personaPromptInput.value.trim();

    if (!name || !emoji || !prompt) {
      personasStatus.textContent = "All fields are required.";
      personasStatus.className = "status-msg error";
      return;
    }

    const newPersona = {
      id: `custom_${Date.now()}`,
      name: name,
      icon: emoji,
      prompt: prompt,
      desc: "Custom Persona"
    };

    customPersonas.push(newPersona);
    chrome.storage.local.set({ customPersonas }, () => {
      personasStatus.textContent = "Persona saved!";
      personasStatus.className = "status-msg success";
      
      // Clear inputs
      personaNameInput.value = "";
      personaEmojiInput.value = "";
      personaPromptInput.value = "";
      
      renderCustomPersonasList();
      renderStyleGrid();
      
      setTimeout(() => {
        personasStatus.textContent = "";
      }, 1500);
    });
  });

  // Panel Toggles
  settingsBtn.addEventListener("click", () => {
    personasPanel.classList.add("hidden");
    settingsPanel.classList.toggle("hidden");
  });

  personasBtn.addEventListener("click", () => {
    settingsPanel.classList.add("hidden");
    personasPanel.classList.toggle("hidden");
  });

  // Toggle API Key Input Visibility
  toggleKeyVisibility.addEventListener("click", () => {
    if (apiKeyInput.type === "password") {
      apiKeyInput.type = "text";
      toggleKeyVisibility.textContent = "Hide";
    } else {
      apiKeyInput.type = "password";
      toggleKeyVisibility.textContent = "Show";
    }
  });

  // Save API Key
  saveSettingsBtn.addEventListener("click", () => {
    const key = apiKeyInput.value.trim();
    if (!key) {
      settingsStatus.textContent = "API Key cannot be empty.";
      settingsStatus.className = "status-msg error";
      return;
    }

    chrome.storage.local.set({ gemini_api_key: key }, () => {
      settingsStatus.textContent = "API Key saved successfully!";
      settingsStatus.className = "status-msg success";
      isApiKeySaved = true;
      updateStatusCard();
      
      setTimeout(() => {
        settingsPanel.classList.add("hidden");
        settingsStatus.textContent = "";
      }, 1500);
    });
  });

  autoPilotToggle.addEventListener("change", () => {
    chrome.storage.local.set({ autoPilotEnabled: autoPilotToggle.checked });
  });

  inputText.addEventListener("input", () => {
    const count = inputText.value.length;
    charCount.textContent = `${count} char${count !== 1 ? "s" : ""}`;
  });

  clearBtn.addEventListener("click", () => {
    inputText.value = "";
    inputText.focus();
    charCount.textContent = "0 chars";
    outputContainer.classList.add("hidden");
    outputText.value = "";
    errorContainer.classList.add("hidden");
  });

  // Transform Text
  transformBtn.addEventListener("click", () => {
    if (transformBtn.disabled) return;
    
    const text = inputText.value.trim();
    outputContainer.classList.add("hidden");
    errorContainer.classList.add("hidden");

    if (!text) {
      showError("Please paste or write some text to De-Slop.");
      return;
    }

    transformBtn.classList.add("loading");
    transformBtn.querySelector(".btn-text").textContent = "Processing...";
    transformBtn.querySelector(".btn-stars").textContent = "⚙️";

    chrome.runtime.sendMessage(
      { action: "call_gemini", text: text, style: activeStyle },
      (response) => {
        transformBtn.classList.remove("loading");
        transformBtn.querySelector(".btn-text").textContent = "De-Slop Text";
        transformBtn.querySelector(".btn-stars").textContent = "✨";

        // Refresh usage count if we were on local AI
        chrome.storage.local.get("freeUsesCount", (d) => {
          freeUsesCount = d.freeUsesCount || 0;
          updateStatusCard();
        });

        if (chrome.runtime.lastError) {
          showError(`Runtime Error: ${chrome.runtime.lastError.message}`);
          return;
        }

        if (response && response.success) {
          outputContainer.classList.remove("hidden");
          outputText.value = response.text;
          window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        } else {
          const err = response ? response.error : "Failed to connect to background helper.";
          showError(err);
        }
      }
    );
  });

  copyBtn.addEventListener("click", () => {
    if (!outputText.value) return;
    navigator.clipboard.writeText(outputText.value).then(() => {
      copyToast.classList.add("show");
      setTimeout(() => copyToast.classList.remove("show"), 1500);
    }).catch(err => showError(`Failed to copy: ${err.message}`));
  });

  function showError(msg) {
    errorMessage.textContent = msg;
    errorContainer.classList.remove("hidden");
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  }

  // Boot up
  initialize();
});
