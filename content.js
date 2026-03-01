(() => {
  const ID_ROOT = 'ai-select-root';
  const ID_BUTTON = 'ai-select-button';
  const ID_POPUP = 'ai-select-popup';

  let selectedText = '';
  let selectionRect = null;
  let abortController = null;

  const root = document.createElement('div');
  root.id = ID_ROOT;

  const actionButton = document.createElement('button');
  actionButton.id = ID_BUTTON;
  actionButton.type = 'button';
  actionButton.setAttribute('aria-label', 'Summarize selection');
  actionButton.textContent = '✨';

  const popup = document.createElement('div');
  popup.id = ID_POPUP;
  popup.hidden = true;

  const popupContent = document.createElement('div');
  popupContent.id = 'ai-select-popup-content';

  const closeButton = document.createElement('button');
  closeButton.id = 'ai-select-popup-close';
  closeButton.innerHTML = '&times;';
  closeButton.setAttribute('aria-label', 'Close summary');
  closeButton.addEventListener('click', (event) => {
    event.stopPropagation();
    event.preventDefault();
    if (abortController) {
      abortController.abort();
    }
    popup.hidden = true;
    actionButton.style.display = 'none';
    window.getSelection().removeAllRanges();
  });

  popup.append(popupContent, closeButton);

  root.append(actionButton, popup);
  document.documentElement.appendChild(root);

  function showPopup(message, isError = false) {
    popupContent.textContent = message;
    popup.dataset.state = isError ? 'error' : 'ready';

    if (popup.hidden) {
      popup.hidden = false;
      positionPopup();
    }
  }

  function positionPopup() {
    if (!selectionRect) return;

    const SPACE_MARGIN = 12;
    const spaceAbove = selectionRect.viewportTop;
    const spaceBelow = window.innerHeight - selectionRect.viewportBottom;

    popup.style.top = '';
    popup.style.bottom = '';
    popup.style.left = '';
    popup.style.transform = '';

    if (spaceBelow >= 250 || spaceBelow >= spaceAbove) {
      popup.style.top = `${selectionRect.absoluteBottom + SPACE_MARGIN}px`;
      popup.style.maxHeight = `${Math.max(150, spaceBelow - (SPACE_MARGIN * 2))}px`;
    } else {
      popup.style.top = `${selectionRect.absoluteTop - SPACE_MARGIN}px`;
      popup.style.transform = 'translateY(-100%)';
      popup.style.maxHeight = `${Math.max(150, spaceAbove - (SPACE_MARGIN * 2))}px`;
    }

    let leftPos = selectionRect.viewportLeft;
    const popupWidth = Math.min(420, window.innerWidth - 24);

    if (leftPos + popupWidth > window.innerWidth - SPACE_MARGIN) {
      leftPos = window.innerWidth - popupWidth - SPACE_MARGIN;
    }
    if (leftPos < SPACE_MARGIN) {
      leftPos = SPACE_MARGIN;
    }

    popup.style.left = `${selectionRect.scrollX + leftPos}px`;
  }

  function positionButton(rect) {
    const top = rect.absoluteBottom + 8;
    const left = rect.absoluteRight - 16;

    actionButton.style.top = `${top}px`;
    actionButton.style.left = `${left}px`;
    actionButton.style.display = 'inline-flex';
  }

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
      absoluteTop: window.scrollY + rect.top,
      absoluteBottom: window.scrollY + rect.bottom,
      absoluteLeft: window.scrollX + rect.left,
      absoluteRight: window.scrollX + rect.right,
      viewportTop: rect.top,
      viewportBottom: rect.bottom,
      viewportLeft: rect.left,
      width: rect.width,
      height: rect.height,
      scrollX: window.scrollX
    };

    return { text, rect: absoluteRect };
  }

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

    if (!navigator.userActivation.isActive) {
      throw new Error('Click the AI button again to allow model initialization.');
    }

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
      monitor(monitorHandle) {
        monitorHandle.addEventListener('downloadprogress', (event) => {
          if (signal && signal.aborted) return;
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
        const stream = summarizer.summarizeStreaming(text, { signal });
        for await (const chunk of stream) {
          if (signal && signal.aborted) break;
          if (chunk !== undefined) {
            onChunk(chunk);
          }
        }
      } else {
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
    if (popup.contains(event.target) || actionButton.contains(event.target)) {
      return;
    }

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
