document.addEventListener('DOMContentLoaded', () => {
    const typeSelect = document.getElementById('type');
    const formatSelect = document.getElementById('format');
    const lengthSelect = document.getElementById('length');
    const streamingCheckbox = document.getElementById('streaming');
    const statusMessage = document.getElementById('save-status');

    // Load existing settings
    chrome.storage.sync.get(['type', 'format', 'length', 'streaming'], (data) => {
        if (data.type) typeSelect.value = data.type;
        else typeSelect.value = 'key-points';

        if (data.format) formatSelect.value = data.format;
        else formatSelect.value = 'markdown';

        if (data.length) lengthSelect.value = data.length;
        else lengthSelect.value = 'short';

        if (data.streaming !== undefined) streamingCheckbox.checked = data.streaming;
        else streamingCheckbox.checked = false;
    });

    // Save on change
    const saveSettings = () => {
        const type = typeSelect.value;
        const format = formatSelect.value;
        const length = lengthSelect.value;
        const streaming = streamingCheckbox.checked;

        chrome.storage.sync.set({ type, format, length, streaming }, () => {
            // Show saved feedback
            statusMessage.style.opacity = '1';
            setTimeout(() => {
                statusMessage.style.opacity = '0';
            }, 1500);
        });
    };

    typeSelect.addEventListener('change', saveSettings);
    formatSelect.addEventListener('change', saveSettings);
    lengthSelect.addEventListener('change', saveSettings);
    streamingCheckbox.addEventListener('change', saveSettings);
});
