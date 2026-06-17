// Style Prompt Templates
const PROMPTS = {
  shakespeare: "Rewrite the following text in the style of William Shakespeare. Use Early Modern English vocabulary (thee, thou, art, hast, etc.), dramatic flair, and poetic structure. Return ONLY the rewritten text, with no introduction, explanation, or conversational filler:",
  harrypotter: "Rewrite the following text as if it were written by a wizard in the Harry Potter universe. Use wizarding terminology (spells, Hogwarts, muggles, Galleons, Ministry of Magic) and British phrasing. Return ONLY the rewritten text, with no introduction, explanation, or conversational filler:",
  pirate: "Rewrite the following text in a classic high-seas pirate accent. Use pirate vocabulary (ahoy, matey, avast, shiver me timbers, landlubber, sea shanties) and nautical metaphors. Return ONLY the rewritten text, with no introduction, explanation, or conversational filler:",
  yoda: "Rewrite the following text in the unique speaking style of Yoda from Star Wars. Invert the grammar structure where appropriate (e.g., Object-Subject-Verb order, ending with helping verbs). Return ONLY the rewritten text, with no introduction, explanation, or conversational filler:",
  genz: "Rewrite the following text using extreme Gen Z slang and internet brain rot. Include terms like rizz, no cap, skibidi, cooking, ate, fr fr, glow up, chat, etc. Make it highly chaotic but hilarious. Return ONLY the rewritten text, with no introduction, explanation, or conversational filler:",
  honesty: "Translate the following corporate post (filled with corporate jargon, buzzwords, and PR fluff) into brutal, direct, and hilarious honesty. Expose what the writer is actually thinking or what the reality of the situation is in a sarcastic, witty tone. Return ONLY the rewritten text, with no introduction, explanation, or conversational filler:"
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

// Helper to interact with the Gemini API
async function handleGeminiCall(inputText, style) {
  // Retrieve the API Key from local storage
  const storage = await chrome.storage.local.get("gemini_api_key");
  const apiKey = storage.gemini_api_key;
  
  if (!apiKey) {
    throw new Error("Gemini API Key is missing. Please open the extension settings to set it.");
  }
  
  const promptTemplate = PROMPTS[style] || PROMPTS.honesty;
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
    throw new Error(`Gemini API Error: ${errorMessage}`);
  }
  
  const data = await response.json();
  const rewrittenText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!rewrittenText) {
    throw new Error("Invalid response received from Gemini API.");
  }
  
  return rewrittenText.trim();
}
