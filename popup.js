document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const settingsBtn = document.getElementById("settings-btn");
  const settingsPanel = document.getElementById("settings-panel");
  const apiKeyInput = document.getElementById("api-key-input");
  const toggleKeyVisibility = document.getElementById("toggle-key-visibility");
  const saveSettingsBtn = document.getElementById("save-settings-btn");
  const settingsStatus = document.getElementById("settings-status");

  const inputText = document.getElementById("input-text");
  const clearBtn = document.getElementById("clear-btn");
  const charCount = document.getElementById("char-count");

  const styleCards = document.querySelectorAll(".style-card");
  const transformBtn = document.getElementById("transform-btn");

  const outputContainer = document.getElementById("output-container");
  const outputText = document.getElementById("output-text");
  const copyBtn = document.getElementById("copy-btn");
  const copyToast = document.getElementById("copy-toast");

  const errorContainer = document.getElementById("error-container");
  const errorMessage = document.getElementById("error-message");

  let activeStyle = "honesty";

  // 1. Load Stored Settings on Startup
  const autoPilotToggle = document.getElementById("autoPilotToggle");
  chrome.storage.local.get(["gemini_api_key", "autoPilotEnabled", "selectedPersona"], (data) => {
    if (data.gemini_api_key) {
      apiKeyInput.value = data.gemini_api_key;
      apiKeyInput.placeholder = "Saved (API Key Encrypted)";
    }
    if (data.autoPilotEnabled) {
      autoPilotToggle.checked = true;
    }
    if (data.selectedPersona) {
      activeStyle = data.selectedPersona;
      styleCards.forEach(card => {
        if (card.dataset.style === activeStyle) {
          card.classList.add("active");
        } else {
          card.classList.remove("active");
        }
      });
    }
  });

  // Handle Auto-Pilot Toggle changes
  autoPilotToggle.addEventListener("change", () => {
    chrome.storage.local.set({ autoPilotEnabled: autoPilotToggle.checked });
  });

  // 2. Toggle Settings Panel
  settingsBtn.addEventListener("click", () => {
    settingsPanel.classList.toggle("hidden");
    // Clear status when toggling
    settingsStatus.textContent = "";
    settingsStatus.className = "status-msg";
  });

  // 3. Toggle API Key Input Visibility
  toggleKeyVisibility.addEventListener("click", () => {
    if (apiKeyInput.type === "password") {
      apiKeyInput.type = "text";
      toggleKeyVisibility.textContent = "Hide";
    } else {
      apiKeyInput.type = "password";
      toggleKeyVisibility.textContent = "Show";
    }
  });

  // 4. Save API Key
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
      
      // Auto-close settings after a short delay
      setTimeout(() => {
        settingsPanel.classList.add("hidden");
        settingsStatus.textContent = "";
      }, 1500);
    });
  });

  // 5. Input Text Actions
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

  // 6. Style Card Selection
  styleCards.forEach(card => {
    card.addEventListener("click", () => {
      styleCards.forEach(c => c.classList.remove("active"));
      card.classList.add("active");
      activeStyle = card.dataset.style;
      chrome.storage.local.set({ selectedPersona: activeStyle });
    });
  });

  // 7. Call Background API to De-Slop
  transformBtn.addEventListener("click", () => {
    const text = inputText.value.trim();
    
    // Hide previous output and errors
    outputContainer.classList.add("hidden");
    errorContainer.classList.add("hidden");

    if (!text) {
      showError("Please paste or write some corporate text to De-Slop.");
      return;
    }

    // Verify key first
    chrome.storage.local.get("gemini_api_key", (data) => {
      if (!data.gemini_api_key) {
        settingsPanel.classList.remove("hidden");
        showError("Please enter and save your Gemini API Key in the settings first.");
        return;
      }

      // Enter loading state
      transformBtn.classList.add("loading");
      transformBtn.querySelector(".btn-text").textContent = "De-Slopping...";
      transformBtn.querySelector(".btn-stars").textContent = "⚙️"; // Spin wheel icon

      chrome.runtime.sendMessage(
        {
          action: "call_gemini",
          text: text,
          style: activeStyle
        },
        (response) => {
          // Reset loading state
          transformBtn.classList.remove("loading");
          transformBtn.querySelector(".btn-text").textContent = "De-Slop Text";
          transformBtn.querySelector(".btn-stars").textContent = "✨";

          if (chrome.runtime.lastError) {
            showError(`Runtime Error: ${chrome.runtime.lastError.message}`);
            return;
          }

          if (response && response.success) {
            outputContainer.classList.remove("hidden");
            outputText.value = response.text;
            // Auto-expand popup if height bounds permit
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
          } else {
            const err = response ? response.error : "Failed to connect to background helper.";
            showError(err);
          }
        }
      );
    });
  });

  // 8. Copy to Clipboard
  copyBtn.addEventListener("click", () => {
    if (!outputText.value) return;
    
    navigator.clipboard.writeText(outputText.value).then(() => {
      copyToast.classList.add("show");
      setTimeout(() => {
        copyToast.classList.remove("show");
      }, 1500);
    }).catch(err => {
      showError(`Failed to copy: ${err.message}`);
    });
  });

  // Helper to show errors
  function showError(msg) {
    errorMessage.textContent = msg;
    errorContainer.classList.remove("hidden");
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  }
});
