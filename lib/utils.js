/**
 * Creates the extension's context menu.
 * @returns {Promise<void>}
 */
export async function createContextMenu() {
    try {
      await chrome.contextMenus.create({
        id: 'screenglide',
        title: 'ScreenGlide',
        contexts: ['all']
      });
  
      await chrome.contextMenus.create({
        id: 'capture-screenshot',
        parentId: 'screenglide',
        title: 'Capture Screenshot',
        contexts: ['all']
      });
  
      await chrome.contextMenus.create({
        id: 'capture-video',
        parentId: 'screenglide',
        title: 'Capture Video',
        contexts: ['all']
      });
  
      await chrome.contextMenus.create({
        id: 'share-with-ai',
        parentId: 'screenglide',
        title: 'Share with AI',
        contexts: ['all']
      });
  
      console.log('Context menu created');
    } catch (error) {
      console.error('Failed to create context menu:', error);
    }
  }
  
  /**
   * Retrieves the API key for the specified AI platform.
   * @param {string} platform - The AI platform ('openai' or 'anthropic').
   * @returns {Promise<string|null>} A promise that resolves with the API key or null if not found.
   */
  export async function getApiKey(platform) {
    const result = await chrome.storage.sync.get(platform);
    return result[platform] || null;
  }
  
  /**
   * Saves the API key for the specified AI platform.
   * @param {string} platform - The AI platform ('openai' or 'anthropic').
   * @param {string} apiKey - The API key to save.
   * @returns {Promise<void>}
   */
  export async function saveApiKey(platform, apiKey) {
    await chrome.storage.sync.set({ [platform]: apiKey });
    console.log(`API key saved for ${platform}`);
  }
  
  /**
   * Generates a unique identifier.
   * @returns {string} A unique identifier.
   */
  export function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
  
  /**
   * Debounces a function.
   * @param {Function} func - The function to debounce.
   * @param {number} wait - The number of milliseconds to delay.
   * @returns {Function} The debounced function.
   */
  export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
  
  /**
   * Throttles a function.
   * @param {Function} func - The function to throttle.
   * @param {number} limit - The number of milliseconds to throttle.
   * @returns {Function} The throttled function.
   */
  export function throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }
  
  /**
   * Formats a date to a human-readable string.
   * @param {Date} date - The date to format.
   * @returns {string} The formatted date string.
   */
  export function formatDate(date) {
    const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return date.toLocaleDateString(undefined, options);
  }