# De-Slop LinkedIn ✨

Rescue your feed from boring corporate AI-slop! **De-Slop LinkedIn** is a lightweight, privacy-focused Manifest V3 Chrome Extension that rewrites generic, buzzword-heavy LinkedIn posts and editor drafts into fun, engaging personas (or brutal, direct honesty) using the Gemini 2.5 Flash API.

---

## 🚀 Key Features

*   **✨ Smart De-Slopper Buttons**: Injected natively into your LinkedIn feed next to post descriptions. Toggle between original and rewritten text instantly.
*   **🤖 Post Composer Integration**: A floating widget in the post editor helps you rewrite your drafts before posting.
*   **⚡ Auto-Pilot Feed Mode**: Enable Auto-Pilot in the popup to automatically translate your feed as you scroll.
*   **🎭 6 Fun Personas**:
    *   **🎯 Brutal Honesty** - Cuts out the PR fluff and says what they actually mean.
    *   **⚡ Gen Z / Brainrot** - Maximum rizz, no cap, pure internet brainrot.
    *   **✍️ Shakespearean** - Grandiloquent Early Modern English.
    *   **🧙‍♂️ Hogwarts Style** - Wizarding terminology and British phrasing.
    *   **🏴‍☠️ High-Seas Pirate** - Classic pirate vocabulary and nautical metaphors.
    *   **👽 Yoda Style** - Unique inverting grammar order.
*   **🔒 Privacy First**: Your API key is stored safely inside your browser's local storage and calls Gemini directly. No external analytics or tracking.

---

## 🛠️ How to Install

1.  **Download the Source Code**:
    *   Clone this repository: `git clone https://github.com/1himanshu1804442/De-slop-Linkedin.git`
    *   Or download the source code as a ZIP file and extract it.
2.  **Open Chrome Extensions page**:
    *   Open Google Chrome and navigate to `chrome://extensions/`.
3.  **Enable Developer Mode**:
    *   Toggle the **Developer mode** switch in the top-right corner to **ON**.
4.  **Load the Extension**:
    *   Click the **Load unpacked** button in the top-left.
    *   Select the directory containing the project files (where `manifest.json` is located).

---

## 🔑 Setup & API Configuration

To run translation tasks, the extension requires a Gemini API Key:

1.  Get a free API key from [Google AI Studio](https://aistudio.google.com/).
2.  Click the **De-Slop LinkedIn** extension icon in your toolbar.
3.  Click the **Settings (Gear) ⚙️** icon in the header.
4.  Paste your API key and click **Save Key**.
5.  Refresh your LinkedIn page to start de-slopping!

---

## 🏗️ Architecture & Technical Stack

*   **Platform**: Chrome Extensions Manifest V3
*   **Frontend**: Vanilla HTML / CSS / JS (No bundlers, no heavy frameworks)
*   **Styling**: Modern, responsive dark-mode popup design with glassmorphism and CSS variables.
*   **DOM Isolation**: Injected elements are isolated using **Shadow DOM** to prevent LinkedIn’s style sheets from clashing with the extension's widgets.
*   **State Management**: React-safe text insertion using simulated events for the editor component.
*   **Security**: Chrome Extension Service Worker (`background.js`) handles the API calls to avoid Content Security Policy (CSP) blocking.

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.
