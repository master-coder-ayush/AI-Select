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

  root.append(actionButton, popup);
  document.documentElement.appendChild(root);

  function hideButtonAndPopup() {
    actionButton.style.display = 'none';
    popup.hidden = true;
    popup.textContent = '';
  }

  function showPopup(message, isError = false) {
    popup.textContent = message;
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

  async function summarize(text) {
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

    const summarizer = await Summarizer.create({
      type: 'tldr',
      format: 'plain-text',
      length: 'short',
      monitor(monitorHandle) {
        monitorHandle.addEventListener('downloadprogress', (event) => {
          showPopup(`Downloading model: ${Math.round(event.loaded * 100)}%`);
        });
      }
    });

    const summary = await summarizer.summarize(text);
    summarizer.destroy();
    return summary;
  }

  document.addEventListener('mouseup', () => {
    const info = getSelectionInfo();
    if (!info) {
      hideButtonAndPopup();
      return;
    }

    selectedText = info.text;
    selectionRect = info.rect;
    positionButton(info.rect);
    popup.hidden = true;
  });

  document.addEventListener('mousedown', (event) => {
    if (event.target === actionButton || popup.contains(event.target)) {
      return;
    }

    hideButtonAndPopup();
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
      const summary = await summarize(selectedText);
      showPopup(summary || 'No summary returned.', false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected summarization error.';
      showPopup(message, true);
    }
  });
})();
