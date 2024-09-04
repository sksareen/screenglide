console.log('ScreenGlide: Background script loaded');

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('ScreenGlide: Message received in background script:', message);
  
  if (message.action === 'contentScriptLoaded') {
    console.log('ScreenGlide: Content script loaded in tab:', sender.tab.id);
    sendResponse({status: 'acknowledged'});
  } else if (message.action === 'capture' && sender.tab.id === activeScreenshotTab) {
    captureAndSaveScreenshot(message.area).then(sendResponse);
    return true;
  } else if (message.action === 'sendToAI') {
    sendToAI(message.screenshots, message.prompt, message.aiService).then(sendResponse);
    return true;
  }
});

const AI_URLS = {
  claude: 'https://claude.ai/new',
  chatgpt: 'https://chat.openai.com/'
};

let activeScreenshotTab = null;

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({ aiService: 'claude' }, () => {
    console.log('ScreenGlide: Default AI service set to Claude');
  });
});

chrome.commands.onCommand.addListener((command) => {
  if (command === "activate_screenglide") {
    initiateScreenCapture();
  }
});

chrome.action.onClicked.addListener(async (tab) => {
  if (tab.url.startsWith('chrome://')) {
    alert('Cannot capture screenshots of chrome:// pages. Please try on a different page.');
    return;
  }
  await initiateScreenCapture();
});

async function initiateScreenCapture() {
  try {
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    if (tab) {
      activeScreenshotTab = tab.id;
      await removeExistingOverlay(tab.id);
      await injectScreenshotTool(tab.id);
    }
  } catch (error) {
    console.error('ScreenGlide: Error initiating screen capture:', error);
  }
}

async function removeExistingOverlay(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    function: () => {
      const existingOverlay = document.querySelector('.screenshot-overlay');
      if (existingOverlay) {
        existingOverlay.remove();
      }
    }
  });
}

async function injectScreenshotTool(tabId) {
  try {
    await chrome.scripting.insertCSS({
      target: { tabId },
      css: `
        .screenshot-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0,0,0,0.5);
          z-index: 2147483647;
          cursor: crosshair;
        }
        .screenshot-selection {
          position: absolute;
          border: 2px solid #fff;
          background: rgba(255,255,255,0.3);
        }
      `
    });

    await chrome.scripting.executeScript({
      target: { tabId },
      function: screenshotToolScript
    });
  } catch (error) {
    console.error('ScreenGlide: Error injecting screenshot tool:', error);
  }
}

function screenshotToolScript() {
  const overlay = document.createElement('div');
  overlay.classList.add('screenshot-overlay');
  
  let startX, startY, endX, endY;
  let selection = null;

  function getScaledCoordinates(clientX, clientY) {
    const dpr = window.devicePixelRatio;
    return { x: clientX * dpr, y: clientY * dpr };
  }

  overlay.onmousedown = (e) => {
    const coords = getScaledCoordinates(e.clientX, e.clientY);
    startX = coords.x;
    startY = coords.y;
    
    selection = document.createElement('div');
    selection.classList.add('screenshot-selection');
    selection.style.left = `${e.clientX}px`;
    selection.style.top = `${e.clientY}px`;
    overlay.appendChild(selection);
  };

  overlay.onmousemove = (e) => {
    if (selection) {
      const coords = getScaledCoordinates(e.clientX, e.clientY);
      endX = coords.x;
      endY = coords.y;
      
      const left = Math.min(startX, endX) / window.devicePixelRatio;
      const top = Math.min(startY, endY) / window.devicePixelRatio;
      const width = Math.abs(endX - startX) / window.devicePixelRatio;
      const height = Math.abs(endY - startY) / window.devicePixelRatio;
      
      Object.assign(selection.style, {
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        height: `${height}px`
      });
    }
  };

  overlay.onmouseup = (e) => {
    const coords = getScaledCoordinates(e.clientX, e.clientY);
    endX = coords.x;
    endY = coords.y;
    
    document.body.removeChild(overlay);
    
    chrome.runtime.sendMessage({
      action: 'capture',
      area: {
        x: Math.min(startX, endX),
        y: Math.min(startY, endY),
        width: Math.abs(endX - startX),
        height: Math.abs(endY - startY)
      }
    });
  };

  document.body.appendChild(overlay);
}

async function captureAndSaveScreenshot(area) {
  try {
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    if (tab.url.startsWith('chrome://')) {
      throw new Error('Cannot capture screenshot of chrome:// pages');
    }
    const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
    const croppedDataUrl = await cropScreenshot(dataUrl, area);
    await saveScreenshot(croppedDataUrl, area);
    await openResultsPage();
    return { success: true };
  } catch (error) {
    console.error('ScreenGlide: Error capturing screenshot:', error);
    return { success: false, error: error.message };
  }
}

async function cropScreenshot(dataUrl, area) {
  try {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    
    const canvas = new OffscreenCanvas(area.width, area.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, area.x, area.y, area.width, area.height, 0, 0, area.width, area.height);
    
    const croppedBlob = await canvas.convertToBlob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(croppedBlob);
    });
  } catch (error) {
    console.error('Failed to crop screenshot:', error);
    throw error;
  }
}

async function saveScreenshot(dataUrl, area) {
  try {
    let { screenshots = [] } = await chrome.storage.local.get('screenshots');
    
    screenshots.push({
      id: Date.now(),
      dataUrl,
      area,
      timestamp: new Date().toISOString()
    });
    
    await chrome.storage.local.set({ screenshots });
    console.log('ScreenGlide: Screenshot saved successfully');
  } catch (error) {
    console.error('ScreenGlide: Error saving screenshot', error);
    throw error;
  }
}

async function openResultsPage() {
  await chrome.tabs.create({ url: chrome.runtime.getURL('review.html') });
}

async function sendToAI(screenshots, prompt, aiService) {
  try {
    const newTab = await chrome.tabs.create({ url: AI_URLS[aiService] });
    await waitForTabLoad(newTab.id);
    
    const result = await injectContentScriptAndSendMessage(newTab.id, { 
      action: 'injectScreenshotAndPrompt',
      screenshots,
      prompt,
      aiService
    });
    
    if (result.success) {
      console.log('ScreenGlide: Process completed successfully:', result.message);
      return { success: true, message: result.message };
    } else {
      console.error('ScreenGlide: Process failed:', result.message);
      return { success: false, error: result.message };
    }
  } catch (error) {
    console.error('ScreenGlide: Error in sendToAI process:', error);
    return { success: false, error: error.message };
  }
}

function waitForTabLoad(tabId) {
  return new Promise((resolve) => {
    function listener(changedTabId, changeInfo) {
      if (changedTabId === tabId && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        setTimeout(resolve, 2000);
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function injectContentScriptAndSendMessage(tabId, message) {
  try {
    const isInjected = await chrome.tabs.sendMessage(tabId, { action: 'ping' }).catch(() => false);
    
    if (!isInjected) {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js']
      });
      console.log('ScreenGlide: Content script injected successfully');
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const response = await chrome.tabs.sendMessage(tabId, message);
    console.log('ScreenGlide: Message sent to content script, response:', response);
    return response;
  } catch (error) {
    console.error('ScreenGlide: Error in injecting content script or sending message:', error);
    throw error;
  }
}