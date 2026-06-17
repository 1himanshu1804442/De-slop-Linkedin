// Style Prompt Templates
const PROMPTS = {
  shakespeare: "Rewrite the following text in the style of William Shakespeare. Use Early Modern English vocabulary (thee, thou, art, hast, etc.), dramatic flair, and poetic structure. Return ONLY the rewritten text, with no introduction, explanation, or conversational filler:",
  harrypotter: "Rewrite the following text as if it were written by a wizard in the Harry Potter universe. Use wizarding terminology (spells, Hogwarts, muggles, Galleons, Ministry of Magic) and British phrasing. Return ONLY the rewritten text, with no introduction, explanation, or conversational filler:",
  pirate: "Rewrite the following text in a classic high-seas pirate accent. Use pirate vocabulary (ahoy, matey, avast, shiver me timbers, landlubber, sea shanties) and nautical metaphors. Return ONLY the rewritten text, with no introduction, explanation, or conversational filler:",
  yoda: "Rewrite the following text in the unique speaking style of Yoda from Star Wars. Invert the grammar structure where appropriate (e.g., Object-Subject-Verb order, ending with helping verbs). Return ONLY the rewritten text, with no introduction, explanation, or conversational filler:",
  genz: "Rewrite the following text using extreme Gen Z slang and internet brain rot. Include terms like rizz, no cap, skibidi, cooking, ate, fr fr, glow up, chat, etc. Make it highly chaotic but hilarious. Return ONLY the rewritten text, with no introduction, explanation, or conversational filler:",
  honesty: "Translate the following corporate post (filled with corporate jargon, buzzwords, and PR fluff) into brutal, direct, and hilarious honesty. Expose what the writer is actually thinking or what the reality of the situation is in a sarcastic, witty tone. Return ONLY the rewritten text, with no introduction, explanation, or conversational filler:",
  anime: "Rewrite the following text in the hyper-energetic, dramatic, and emotionally intense style of an anime protagonist. Use anime tropes, references to power levels, destiny, friendship, calling out attack names, and occasional Japanese loanwords commonly used by fans (like nakama, baka, sugoi, senpai, dattebayo). Return ONLY the rewritten text, with no introduction, explanation, or conversational filler:",
  cyberpunk: "Rewrite the following text in a gritty, high-tech, low-life Cyberpunk slang. Use terminology like choom, preck, eddies, chrome, netrunner, flatlined, corpo, ICE, cyberware, and neon-drenched metaphors. Return ONLY the rewritten text, with no introduction, explanation, or conversational filler:"
};

// Create context menu on installation
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "deslop-selection",
    title: "De-Slop Selected Text ✨",
    contexts: ["selection"]
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "deslop-selection" && info.selectionText && tab.id) {
    // Send selected text to content script to display the transformation overlay
    chrome.tabs.sendMessage(tab.id, {
      action: "show_inline_overlay",
      text: info.selectionText
    }).catch(err => console.log("Failed to send context menu message: ", err));
  }
});

// Listen for messages from content.js or popup.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "call_gemini") {
    // Call async helper and return response via message port
    handleGeminiCall(request.text, request.style)
      .then(result => sendResponse({ success: true, text: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    
    return true; // Keep message channel open for async response
  }
});

// Helper to interact with the Gemini API or Local AI
async function handleGeminiCall(inputText, style) {
  // Retrieve the API Key, trial count, and custom personas from local storage
  const storage = await chrome.storage.local.get(["gemini_api_key", "freeUsesCount", "customPersonas"]);
  const apiKey = storage.gemini_api_key;
  const freeUsesCount = storage.freeUsesCount || 0;
  const customPersonas = storage.customPersonas || [];
  const MAX_FREE_USES = 5;
  
  // Find prompt template
  let promptTemplate = PROMPTS.honesty;
  if (PROMPTS[style]) {
    promptTemplate = PROMPTS[style];
  } else {
    const custom = customPersonas.find(p => p.id === style);
    if (custom) {
      promptTemplate = custom.prompt;
    }
  }
  
  if (!apiKey) {
    if (freeUsesCount < MAX_FREE_USES) {
      // Try using Chrome's native on-device Gemini Nano
      if (typeof self.ai !== 'undefined' && self.ai.languageModel) {
        try {
          const capabilities = await self.ai.languageModel.capabilities();
          if (capabilities.available !== 'no') {
            const session = await self.ai.languageModel.create({
              systemPrompt: promptTemplate
            });
            const result = await session.prompt(inputText);
            await chrome.storage.local.set({ freeUsesCount: freeUsesCount + 1 });
            return result.trim();
          }
        } catch (e) {
          console.warn("Local AI execution failed:", e);
        }
      }
      throw new Error("Local AI is not available on your browser. Please open the extension settings to add your free Google AI Studio Key.");
    } else {
      throw new Error(`Free trial limit reached (${MAX_FREE_USES}/${MAX_FREE_USES}). Please enter your own Gemini API Key in settings to continue.`);
    }
  }
  
  // Proceed with Personal API Key via cloud Gemini API
  const fullPrompt = `${promptTemplate}\n\n"${inputText}"`;
  
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: fullPrompt
        }]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192
      }
    })
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.error?.message || `HTTP error! status: ${response.status}`;
    throw new Error(`Gemini API Error (status: ${response.status}): ${errorMessage}`);
  }
  
  const data = await response.json();
  const rewrittenText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!rewrittenText) {
    throw new Error("Invalid response received from Gemini API.");
  }
  
  return rewrittenText.trim();
}
