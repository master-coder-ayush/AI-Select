# Privacy Policy for AI-Select

**Effective Date:** 2026

Thank you for choosing **AI-Select**. We take your privacy very seriously. This Privacy Policy outlines how the AI-Select Chrome Extension collects, uses, and protects your data.

## 1. Information We Collect
**AI-Select is a "zero-backend" extension.** This means:
- We **do not** collect, store, or transmit your personal information.
- We **do not** log your browsing history, track the websites you visit, or monitor your online activity.
- We **do not** send the text you select or summarize to any remote servers, clouds, or third-party APIs.

## 2. How Your Data is Processed
All data processing and summarization are performed **100% locally** on your device.
- **On-Device Summarization:** When you highlight text and request a summary, the extension uses Chrome’s built-in, local **Summarizer API (Gemini Nano)**. The text never leaves your computer.
- **Local Storage:** The extension uses Chrome's local storage (`chrome.storage.sync`) solely to remember your preferred settings (e.g., summary type, format, length, and streaming toggles) so you don’t have to configure them every time. 

## 3. Permissions Explained
To function properly, AI-Select requests the following permissions:
- **`storage`**: Used exclusively to save and load your extension settings locally.
- **`host permissions ("<all_urls>")`**: Required to inject the floating AI action button (the "✨" icon) onto the webpages you visit so it can detect when you highlight text and provide the summarization feature seamlessly alongside your selection.

## 4. Updates to This Policy
We may update this Privacy Policy from time to time if the features of the extension change. Because we do not collect any user contact information, we encourage you to review this page periodically for the latest updates.

## 5. Contact
If you have any questions or concerns about this Privacy Policy or how AI-Select handles your device's data, please open an issue on the project's GitHub repository.
