# AI-Select Chrome Extension

AI-Select is a zero-backend Chrome extension that adds a small AI action button next to selected text on any webpage. Clicking the button summarizes the selection with Chrome's built-in on-device `Summarizer` API (Gemini Nano).

## Features

- Detects selected text on any webpage via a content script.
- Shows a lightweight floating action icon near the selection.
- Uses the built-in `Summarizer` API for one-sentence TL;DR summaries.
- Keeps data local to the device (no external server calls).
- Hides UI when the user clicks elsewhere.

## Load in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this project folder (`AI-Select`).

## Notes

- The extension requires Chrome with the built-in Summarizer API support (`'Summarizer' in self`).
- On first run, Chrome may need to download the on-device model.
