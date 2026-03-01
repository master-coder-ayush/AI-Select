(() => {
  const ID_ROOT = 'ai-select-root';
  const ID_BUTTON = 'ai-select-button';
  const ID_POPUP = 'ai-select-popup';

  let selectedText = '';
  let selectionRect = null;
  // Controls cancellation of ongoing AI summarization streams/downloads
  let abortController = null;

  // Create an isolated root container for the extension UI elements
  // This helps separate the extension's DOM from the host page's DOM
  const root = document.createElement('div');
  root.id = ID_ROOT;

  // Button setup: The floating ✨ action button that appears over selected text
  const actionButton = document.createElement('button');
  actionButton.id = ID_BUTTON;
  actionButton.type = 'button';
  actionButton.setAttribute('aria-label', 'Summarize selection');
  actionButton.textContent = '✨';

  // Popup setup: The container for displaying the text summary or download progress
  const popup = document.createElement('div');
  popup.id = ID_POPUP;
  popup.hidden = true;

  const popupContent = document.createElement('div');
  popupContent.id = 'ai-select-popup-content';

  // Close button ('x') inside the popup
  const closeButton = document.createElement('button');
  closeButton.id = 'ai-select-popup-close';
  closeButton.innerHTML = '&times;';
  closeButton.setAttribute('aria-label', 'Close summary');
  closeButton.addEventListener('click', (event) => {
    event.stopPropagation();
    event.preventDefault();

    // Stop any in-progress summarize request immediately
    if (abortController) {
      abortController.abort();
    }
    popup.hidden = true;
    actionButton.style.display = 'none';

    // Clear the active text selection natively in the browser
    window.getSelection().removeAllRanges();
  });

  popup.append(popupContent, closeButton);

  root.append(actionButton, popup);
  document.documentElement.appendChild(root);

  function showPopup(message, isError = false) {
    popupContent.textContent = message;
    popup.dataset.state = isError ? 'error' : 'ready';

    // If popup was previously hidden, make it visible and compute position now
    if (popup.hidden) {
      popup.hidden = false;
      positionPopup();
    }
  }

  // Intelligently fits the popup onto the screen to avoid dual scrollbars and overflow
  function positionPopup() {
    if (!selectionRect) return;

    const SPACE_MARGIN = 12; // Buffer zone away from screen edges
    // Distance from the top of the browser view to the selected text
    const spaceAbove = selectionRect.viewportTop;
    // Distance from the bottom of the selected text to the bottom of the browser view
    const spaceBelow = window.innerHeight - selectionRect.viewportBottom;

    popup.style.top = '';
    popup.style.bottom = '';
    popup.style.left = '';
    popup.style.transform = '';

    // Prefer placing popup below the text, but only if there is sufficient space
    // or if the space below is larger than the space above.
    if (spaceBelow >= 250 || spaceBelow >= spaceAbove) {
      popup.style.top = `${selectionRect.absoluteBottom + SPACE_MARGIN}px`;
      popup.style.maxHeight = `${Math.max(150, spaceBelow - (SPACE_MARGIN * 2))}px`;
    } else {
      // If placed above the text, anchor it to the top edge and push it upwards with translateY
      popup.style.top = `${selectionRect.absoluteTop - SPACE_MARGIN}px`;
      popup.style.transform = 'translateY(-100%)';
      popup.style.maxHeight = `${Math.max(150, spaceAbove - (SPACE_MARGIN * 2))}px`;
    }

    let leftPos = selectionRect.viewportLeft;
    // Constrain width to 420px maximum or screen bounds
    const popupWidth = Math.min(420, window.innerWidth - 24);

    // Prevent right-edge overflow
    if (leftPos + popupWidth > window.innerWidth - SPACE_MARGIN) {
      leftPos = window.innerWidth - popupWidth - SPACE_MARGIN;
    }
    // Prevent left-edge overflow
    if (leftPos < SPACE_MARGIN) {
      leftPos = SPACE_MARGIN;
    }

    // scrollX accounts for horizontal scrolling on the page to maintain absolute placement
    popup.style.left = `${selectionRect.scrollX + leftPos}px`;
  }

  function positionButton(rect) {
    // Position floating action button slightly below and right of the end of the text selection
    const top = rect.absoluteBottom + 8;
    const left = rect.absoluteRight - 16;

    actionButton.style.top = `${top}px`;
    actionButton.style.left = `${left}px`;
    actionButton.style.display = 'inline-flex';
  }

  // Grabs both relative viewport coordinates (for math/collisions) and absolute document coordinates (for persistent layout)
  function getSelectionInfo() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return null;
    }

    const text = selection.toString().trim();
    if (!text) {
      return null;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) {
      return null;
    }

    const absoluteRect = {
      absoluteTop: window.scrollY + rect.top, // Fixed layout position top
      absoluteBottom: window.scrollY + rect.bottom, // Fixed layout position bottom
      absoluteLeft: window.scrollX + rect.left,
      absoluteRight: window.scrollX + rect.right,
      viewportTop: rect.top, // Relative distance to edge of screen
      viewportBottom: rect.bottom, // Relative distance to bottom bounds
      viewportLeft: rect.left,
      width: rect.width,
      height: rect.height,
      scrollX: window.scrollX
    };

    return { text, rect: absoluteRect };
  }

  // Core API interaction logic fetching models and chunking string data
  async function summarize(text, onChunk, signal) {
    if (!('Summarizer' in self)) {
      throw new Error('Summarizer API is not available in this Chrome version.');
    }

    if (signal && signal.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    const availability = await Summarizer.availability();
    if (availability === 'unavailable') {
      throw new Error('This device does not support on-device summarization.');
    }

    // AI on-device components mandate explicit active user clicks to download dependencies naturally.
    if (!navigator.userActivation.isActive) {
      throw new Error('Click the AI button again to allow model initialization.');
    }

    // Fetch user preferences saved in extension popup settings
    const options = await chrome.storage.sync.get(['type', 'format', 'length', 'streaming']);
    const type = options.type || 'key-points';
    const format = options.format || 'markdown';
    const length = options.length || 'short';
    const isStreaming = options.streaming === true;

    if (signal && signal.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    const createOptions = {
      type: type,
      format: format,
      length: length,
      // Attached listener reports chunked percentage loading stats to the user natively
      monitor(monitorHandle) {
        monitorHandle.addEventListener('downloadprogress', (event) => {
          if (signal && signal.aborted) return;
          // Calculate loaded percent conditionally depending on if total content length is known
          const loadedPercent = event.total ? Math.round((event.loaded / event.total) * 100) : Math.round(event.loaded * 100);
          if (loadedPercent >= 100) {
            showPopup('Summarizing...');
          } else {
            showPopup(`Downloading model: ${loadedPercent}%`);
          }
        });
      }
    };

    if (signal) {
      createOptions.signal = signal;
    }

    let summarizer;
    try {
      summarizer = await Summarizer.create(createOptions);
    } catch (e) {
      if (signal && signal.aborted) throw new DOMException('Aborted', 'AbortError');
      throw e;
    }

    if (signal && signal.aborted) {
      summarizer.destroy();
      throw new DOMException('Aborted', 'AbortError');
    }

    try {
      if (isStreaming) {
        // Stream text progressively (chunk by chunk) so the UI feels fast and responsive
        const stream = summarizer.summarizeStreaming(text, { signal });
        for await (const chunk of stream) {
          if (signal && signal.aborted) break;
          // Only pass valid string iterations
          if (chunk !== undefined) {
            onChunk(chunk);
          }
        }
      } else {
        // Fallback or explicit standard completion handling
        const summary = await summarizer.summarize(text, { signal });
        if (signal && !signal.aborted) {
          onChunk(summary);
        }
      }
    } finally {
      try {
        summarizer.destroy();
      } catch (e) { }
    }
  }

  document.addEventListener('mouseup', (event) => {
    // Prevent hiding elements if click targets the extension's own UI
    if (popup.contains(event.target) || actionButton.contains(event.target)) {
      return;
    }

    // Set a tiny 10ms delay so that native browser deselect clears FIRST to avoid ghost buttons
    setTimeout(() => {
      const info = getSelectionInfo();
      if (!info) {
        actionButton.style.display = 'none';
        return;
      }

      if (abortController) {
        abortController.abort();
      }
      selectedText = info.text;
      selectionRect = info.rect;
      positionButton(info.rect);
      popup.hidden = true;
    }, 10);
  });

  actionButton.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (!selectedText) {
      showPopup('Please select text first.', true);
      return;
    }

    if (abortController) {
      abortController.abort();
    }
    abortController = new AbortController();
    const signal = abortController.signal;

    showPopup('Summarizing...');

    try {
      let fullSummary = '';
      await summarize(selectedText, (chunk) => {
        if (signal.aborted) return;
        fullSummary += chunk;
        showPopup(fullSummary || 'No summary returned.', false);
      }, signal);

      if (signal.aborted) return;

      if (!fullSummary) {
        showPopup('No summary returned.', false);
      }
    } catch (error) {
      if (signal.aborted || error.name === 'AbortError') return;
      const message = error instanceof Error ? error.message : 'Unexpected summarization error.';
      showPopup(message, true);
    } finally {
      if (abortController && abortController.signal === signal) {
        abortController = null;
      }
    }
  });
})();
