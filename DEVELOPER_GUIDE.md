# AI-Select Developer Guide

This document provides a detailed overview of the AI-Select project architecture, mechanics, and design intentions. It is intended for developers who want to understand, build, or contribute to this extension.

---

## 🏗️ Architecture Overview

The `AI-Select` extension operates entirely client-side as a "zero-backend" application. It leverages modern Chrome capabilities—specifically Content Scripts, the Storage API, and the experimental On-Device Summarizer API (Gemini Nano)—to directly interact with user interactions securely within their browser sandbox.

### Core Components

1. **`manifest.json`**
   - **Role**: Configuration file for Chrome.
   - **Key Properties**: Contains V3 compliance standards, explicitly requests `"storage"` permissions (for settings persistence), allows `"<all_urls>"` host permissions for generalized script injection, and associates default settings UI mappings.

2. **`content.js` & `styles.css` (Content Scripts)**
   - **Role**: The core logic injected directly into every active website the user browses.
   - **Responsibilities**:
     - **Event Monitoring**: Listens for text selections using window context events (`mouseup`, `mousedown`, `getSelection()`).
     - **DOM Manipulation**: Dynamically constructs isolated floating UI wrappers (buttons, summarized popup box) dynamically inserting them natively into the page.
     - **Interaction Logic**: Reads configuration settings on the fly, queries the `Summarizer` API securely to compute responses, tracks internal download/fallback states, streams chunk sequences sequentially, and manages hiding overlays based on external focus checks.

3. **`popup.html`, `popup.css`, `popup.js` (Action UI)**
   - **Role**: Visual configuration portal users interact with upon clicking the pinned extension icon in the toolbar.
   - **Responsibilities**:
     - Displays toggle configurations aligned directly with `Summarizer API` capabilities (Type, Format, Length, Streaming).
     - Modifies state inside `chrome.storage.sync` allowing the background `content.js` to asynchronously access these preferences.

---

## 🛠️ Deep Dive: The Summarizer API

This extension heavily relies on the on-device Summarizer API.

### 1. Verification & Downloads
Because generating models can take severe computational bandwidth, the logic first validates `Summarizer.availability()`. If valid but unready, invoking it initially triggers the `downloadprogress` event allowing a responsive user feedback loop before generation.

### 2. Configuration Parameters
We pass dynamically fetched arguments directly into `Summarizer.create(options)`:
- `type`: Either `tldr`, `key-points`, `teaser`, or `headline`.
- `format`: `plain-text` or `markdown`.
- `length`: `short`, `medium`, or `long`.

### 3. Execution (Standard vs Streaming)
- **Standard (`summarize(text)`)**: Returns the full block of text all at once. Best for minimal system load.
- **Streaming (`summarizeStreaming(text)`)**: Operates on an async iterator (`for await (const chunk of stream)`) pushing fragmented strings concurrently to achieve real-time UX without freezing the user's thread. Note that chunks must generally be appended mathematically to previously rendered sequences unless native chunk management behaves independently.

---

## 🎨 UI Rendering & Styling Approach

To prevent style conflicts with external host websites, the injected popups rely on `all: initial` principles in `styles.css`. This CSS declaration ensures inherited host layouts/styles (like strong, block colors) from the parent webpage do not bleed into the isolated extension elements. The isolated layer enforces strict `z-index`, `pointer-event`, and flex-based structural bounds.

---

## ⚙️ Hardware Limitations

Be aware that executing these AI scripts client-side utilizes heavy local resources:
- Needs **Google Chrome 138+**.
- Hard requirements on minimal RAM (>16GB CPU or >4GB GPU).
- At least 22GB of storage clearance.
- A functional unmetered internet connection initially (for Nano's model download context).
