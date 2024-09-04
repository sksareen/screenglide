console.log('ScreenGlide: Review script loaded');

document.addEventListener('DOMContentLoaded', async () => {
    const screenshotGrid = document.getElementById('screenshot-grid');
    const promptSection = document.getElementById('prompt-section');
    const promptInput = document.getElementById('prompt-input');
    const sendToClaudeButton = document.getElementById('send-to-claude');
    const statusMessage = document.getElementById('status-message');

    let screenshots = [];
    let selectedScreenshots = new Set();

    async function loadAndRenderScreenshots() {
        try {
            screenshots = await loadScreenshots();
            if (screenshots.length === 0) {
                showStatus('No screenshots available. Capture one by clicking the ScreenGlide icon!');
            } else {
                renderScreenshots();
                showStatus('Screenshots loaded successfully');
            }
        } catch (error) {
            console.error('ScreenGlide: Error loading screenshots', error);
            showStatus('Error loading screenshots. Please try again.', true);
        }
    }

    await loadAndRenderScreenshots();

    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.screenshots) {
            loadAndRenderScreenshots();
        }
    });

    screenshotGrid.addEventListener('click', (e) => {
        if (e.target.classList.contains('screenshot')) {
            const screenshotId = e.target.dataset.id;
            if (selectedScreenshots.has(screenshotId)) {
                selectedScreenshots.delete(screenshotId);
                e.target.classList.remove('selected');
            } else if (selectedScreenshots.size < 5) {
                selectedScreenshots.add(screenshotId);
                e.target.classList.add('selected');
            } else {
                showStatus('You can select up to 5 screenshots at a time.', true);
            }
            updatePromptSection();
        }
    });

    sendToClaudeButton.addEventListener('click', async () => {
        const prompt = promptInput.value;
        try {
            const selectedScreenshotData = screenshots
                .filter(s => selectedScreenshots.has(s.id.toString()))
                .map(s => s.dataUrl);
            if (selectedScreenshotData.length > 0) {
                chrome.runtime.sendMessage({
                    action: 'sendToAI',
                    screenshots: selectedScreenshotData,
                    prompt: prompt,
                    aiService: 'claude'  // or 'chatgpt', depending on user preference
                });
                showStatus('Sending to Claude...');
            } else {
                showStatus('No screenshots selected', true);
            }
        } catch (error) {
            console.error('ScreenGlide: Error sending to Claude', error);
            showStatus('Error sending to Claude. Please try again.', true);
        }
    });

    async function loadScreenshots() {
        const result = await chrome.storage.local.get('screenshots');
        return result.screenshots || [];
    }

    function renderScreenshots() {
        screenshotGrid.innerHTML = screenshots.map(screenshot => `
            <div class="screenshot-container">
                <img class="screenshot ${selectedScreenshots.has(screenshot.id.toString()) ? 'selected' : ''}" 
                     src="${screenshot.dataUrl}" 
                     data-id="${screenshot.id}"
                     data-metadata='${JSON.stringify(screenshot)}'>
                <p>Captured: ${new Date(screenshot.timestamp).toLocaleString()}</p>
            </div>
        `).join('');
        updatePromptSection();
    }

    function updatePromptSection() {
        promptSection.style.display = selectedScreenshots.size > 0 ? 'block' : 'none';
        sendToClaudeButton.disabled = selectedScreenshots.size === 0;
    }

    function showStatus(message, isError = false) {
        statusMessage.textContent = message;
        statusMessage.className = isError ? 'error' : 'success';
        statusMessage.style.display = 'block';
        setTimeout(() => {
            statusMessage.style.display = 'none';
        }, 5000);
    }
});