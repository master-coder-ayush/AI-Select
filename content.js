(() => {
  const ID_ROOT = 'ai-select-root';
  const ID_BUTTON = 'ai-select-button';
  const ID_POPUP = 'ai-select-popup';

  let selectedText = '';
  let selectionRect = null;

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
    popup.hidden = true;
  });

  popup.append(popupContent, closeButton);

  root.append(actionButton, popup);
  document.documentElement.appendChild(root);

  function showPopup(message, isError = false) {
    popupContent.textContent = message;
    popup.dataset.state = isError ? 'error' : 'ready';
    popup.hidden = false;

    if (!selectionRect) {
      return;
    }

    const top = window.scrollY + selectionRect.bottom + 10;
    const left = window.scrollX + selectionRect.left;
    popup.style.top = `${top}px`;
    popup.style.left = `${left}px`;
  }

  function positionButton(rect) {
    const top = window.scrollY + rect.bottom + 8;
    const left = window.scrollX + rect.right - 16;

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

    return { text, rect };
  }

  async function summarize(text, onChunk) {
    if (!('Summarizer' in self)) {
      throw new Error('Summarizer API is not available in this Chrome version.');
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

    const summarizer = await Summarizer.create({
      type: type,
      format: format,
      length: length,
      monitor(monitorHandle) {
        monitorHandle.addEventListener('downloadprogress', (event) => {
          const loadedPercent = event.total ? Math.round((event.loaded / event.total) * 100) : Math.round(event.loaded * 100);
          if (loadedPercent >= 100) {
            showPopup('Summarizing...');
          } else {
            showPopup(`Downloading model: ${loadedPercent}%`);
          }
        });
      }
    });

    if (isStreaming) {
      const stream = summarizer.summarizeStreaming(text);
      for await (const chunk of stream) {
        onChunk(chunk);
      }
      summarizer.destroy();
    } else {
      const summary = await summarizer.summarize(text);
      summarizer.destroy();
      onChunk(summary);
    }
  }

  document.addEventListener('mouseup', (event) => {
    if (popup.contains(event.target) || actionButton.contains(event.target)) {
      return;
    }

    const info = getSelectionInfo();
    if (!info) {
      actionButton.style.display = 'none';
      return;
    }

    selectedText = info.text;
    selectionRect = info.rect;
    positionButton(info.rect);
    popup.hidden = true;
  });

  actionButton.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (!selectedText) {
      showPopup('Please select text first.', true);
      return;
    }

    showPopup('Summarizing...');

    try {
      let fullSummary = '';
      await summarize(selectedText, (chunk) => {
        fullSummary += chunk;
        showPopup(fullSummary || 'No summary returned.', false);
      });
      if (!fullSummary) {
        showPopup('No summary returned.', false);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected summarization error.';
      showPopup(message, true);
    }
  });
})();
