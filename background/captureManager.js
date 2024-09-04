console.log('ScreenGlide: CaptureManager loaded');

/**
 * Captures the visible area of the current tab as a screenshot.
 * @returns {Promise<string>} A promise that resolves with the screenshot as a data URL.
 */
export async function captureScreenshot() {
  console.log('ScreenGlide: Initiating screenshot capture');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      console.error('ScreenGlide: No active tab found for capture');
      throw new Error('No active tab found');
    }

    console.log('ScreenGlide: Active tab found, capturing visible tab');
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
    console.log('ScreenGlide: Screenshot captured successfully');
    return dataUrl;
  } catch (error) {
    console.error('ScreenGlide: Failed to capture screenshot:', error);
    throw new Error('Screenshot capture failed: ' + error.message);
  }
}

/**
 * Captures video from the current tab.
 * @returns {Promise<Blob>} A promise that resolves with the video as a Blob.
 */
export async function captureVideo() {
  console.log('ScreenGlide: Initiating video capture');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      console.error('ScreenGlide: No active tab found for video capture');
      throw new Error('No active tab found');
    }

    console.log('ScreenGlide: Active tab found, starting video capture');
    const stream = await chrome.tabCapture.capture({
      video: true,
      audio: false,
      videoConstraints: {
        mandatory: {
          minWidth: 1280,
          minHeight: 720,
          maxWidth: 1920,
          maxHeight: 1080,
          maxFrameRate: 60
        }
      }
    });

    if (!stream) {
      console.error('ScreenGlide: Failed to start video capture');
      throw new Error('Failed to start video capture');
    }

    console.log('ScreenGlide: Video capture stream obtained, recording...');
    return new Promise((resolve, reject) => {
      const chunks = [];
      const mediaRecorder = new MediaRecorder(stream);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        console.log('ScreenGlide: Video recording stopped, creating blob');
        const blob = new Blob(chunks, { type: 'video/webm' });
        resolve(blob);
      };

      mediaRecorder.onerror = (event) => {
        console.error('ScreenGlide: MediaRecorder error:', event.error);
        reject(new Error(`MediaRecorder error: ${event.error}`));
      };

      mediaRecorder.start();
      console.log('ScreenGlide: MediaRecorder started');

      // Stop recording after 10 seconds (adjust as needed)
      setTimeout(() => {
        console.log('ScreenGlide: Stopping video capture');
        mediaRecorder.stop();
        stream.getTracks().forEach(track => track.stop());
      }, 10000);
    });
  } catch (error) {
    console.error('ScreenGlide: Failed to capture video:', error);
    throw new Error('Video capture failed: ' + error.message);
  }
}

/**
 * Crops a screenshot to the specified area.
 * @param {string} dataUrl - The data URL of the screenshot to crop.
 * @param {Object} area - The area to crop (x, y, width, height).
 * @returns {Promise<string>} A promise that resolves with the cropped screenshot as a data URL.
 */
export async function cropScreenshot(dataUrl, area) {
  console.log('ScreenGlide: Cropping screenshot', area);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = new OffscreenCanvas(area.width, area.height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, area.width, area.height);
      canvas.convertToBlob({ type: 'image/png' })
        .then(blob => {
          const reader = new FileReader();
          reader.onloadend = () => {
            console.log('ScreenGlide: Screenshot cropped successfully');
            resolve(reader.result);
          };
          reader.onerror = () => {
            console.error('ScreenGlide: Failed to read cropped screenshot');
            reject(new Error('Failed to read cropped screenshot'));
          };
          reader.readAsDataURL(blob);
        })
        .catch(error => {
          console.error('ScreenGlide: Failed to convert canvas to blob:', error);
          reject(error);
        });
    };
    img.onerror = () => {
      console.error('ScreenGlide: Failed to load image for cropping');
      reject(new Error('Failed to load image for cropping'));
    };
    img.src = dataUrl;
  });
}

console.log('ScreenGlide: CaptureManager setup complete');