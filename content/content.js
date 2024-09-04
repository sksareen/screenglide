console.log('ScreenGlide: Content script loaded and running');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const waitForElement = (selector, timeout = 30000) => {
  return new Promise((resolve, reject) => {
    if (document.querySelector(selector)) {
      return resolve(document.querySelector(selector));
    }

    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        observer.disconnect();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`ScreenGlide: Timeout waiting for element: ${selector}`));
    }, timeout);
  });
};

const uploadScreenshots = async (screenshots, aiService) => {
    console.log('ScreenGlide: Attempting to upload screenshots', { count: screenshots.length, aiService });
    try {
      const fileInputSelector = 'input[type="file"]';
      const fileInput = await waitForElement(fileInputSelector);
      
      console.log('ScreenGlide: File input found. Uploading screenshots...');
    
      const files = await Promise.all(screenshots.map(async (screenshot, index) => {
        const response = await fetch(screenshot);
        const blob = await response.blob();
        return new File([blob], `screenshot_${index + 1}.png`, { type: "image/png" });
      }));
  
      const dataTransfer = new DataTransfer();
      files.forEach(file => dataTransfer.items.add(file));
      fileInput.files = dataTransfer.files;
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    
      console.log(`ScreenGlide: ${files.length} screenshots uploaded successfully.`);
      await delay(1000);
    } catch (error) {
      console.error('ScreenGlide: Error uploading screenshots:', error);
      throw error;
    }
  };
  
  // ... (keep other existing functions: enterPrompt, sendPrompt)
  
  const injectScreenshotsAndPrompt = async (screenshots, prompt, aiService) => {
    console.log('ScreenGlide: Starting injection process.', { screenshotsCount: screenshots.length, promptLength: prompt.length, aiService });
    try {
      await uploadScreenshots(screenshots, aiService);
      await delay(1000);
      await enterPrompt(prompt, aiService);
      await sendPrompt(aiService);
      
      console.log('ScreenGlide: Injection process completed successfully.');
      return { success: true, message: 'ScreenGlide: Screenshots and prompt injected successfully' };
    } catch (error) {
      console.error('ScreenGlide: Error in content script during injection:', error);
      return { success: false, message: error.message };
    }
  };
  
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('ScreenGlide: Message received in content script:', message);
    
    if (message.action === 'ping') {
      console.log('ScreenGlide: Ping received, responding with status.');
      sendResponse({ status: 'alive' });
      return true;
    }
  
    if (message.action === 'injectScreenshotAndPrompt') {
      console.log('ScreenGlide: Injection request received, processing...');
      injectScreenshotsAndPrompt(message.screenshots, message.prompt, message.aiService)
        .then(result => {
          console.log('ScreenGlide: Injection process result:', result);
          sendResponse(result);
        })
        .catch((error) => {
          console.error('ScreenGlide: Injection process failed:', error);
          sendResponse({ success: false, message: error.message });
        });
      return true;
    }
  });
  
  // Send a message to the background script to confirm content script is loaded
  chrome.runtime.sendMessage({ action: 'contentScriptLoaded' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('ScreenGlide: Error sending contentScriptLoaded message:', chrome.runtime.lastError.message);
      // Log additional details about the current tab
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (chrome.runtime.lastError) {
          console.error('ScreenGlide: Error querying tabs:', chrome.runtime.lastError.message);
        } else if (tabs.length > 0) {
          console.log('ScreenGlide: Current tab details:', tabs[0]);
        } else {
          console.log('ScreenGlide: No active tab found');
        }
      });
    } else {
      console.log('ScreenGlide: Background script acknowledged content script load:', response);
    }
  });
  
  console.log('ScreenGlide: Content script setup complete');