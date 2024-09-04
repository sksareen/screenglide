/**
 * Saves content to the clipboard.
 * @param {string|Blob} data - The data to save to the clipboard.
 * @param {string} type - The type of data ('text', 'image', 'video', 'file').
 * @returns {Promise<void>}
 */
export async function saveToClipboard(data, type) {
    try {
      switch (type) {
        case 'text':
          await navigator.clipboard.writeText(data);
          break;
        case 'image':
          if (typeof data === 'string' && data.startsWith('data:image')) {
            const response = await fetch(data);
            const blob = await response.blob();
            await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
          } else {
            throw new Error('Invalid image data');
          }
          break;
        case 'video':
        case 'file':
          if (data instanceof Blob) {
            await navigator.clipboard.write([new ClipboardItem({ [data.type]: data })]);
          } else {
            throw new Error(`Invalid ${type} data`);
          }
          break;
        default:
          throw new Error(`Unsupported type: ${type}`);
      }
      console.log(`Saved ${type} to clipboard`);
    } catch (error) {
      console.error(`Failed to save ${type} to clipboard:`, error);
      throw new Error(`Clipboard save failed for ${type}`);
    }
  }
  
  /**
   * Saves content to local RAG (Retrieval-Augmented Generation) storage.
   * @param {string|Blob} data - The data to save to local RAG.
   * @param {string} type - The type of data ('text', 'image', 'video', 'file').
   * @returns {Promise<void>}
   */
  export async function saveToLocalRAG(data, type) {
    try {
      const ragItem = {
        type,
        data: data instanceof Blob ? await blobToBase64(data) : data,
        timestamp: Date.now()
      };
  
      const key = `rag_${type}_${Date.now()}`;
      await chrome.storage.local.set({ [key]: ragItem });
      console.log(`Saved ${type} to local RAG`);
  
      // Prune old items if storage is getting full
      await pruneLocalRAG();
    } catch (error) {
      console.error(`Failed to save ${type} to local RAG:`, error);
      throw new Error(`Local RAG save failed for ${type}`);
    }
  }
  
  /**
   * Converts a Blob to a base64 encoded string.
   * @param {Blob} blob - The Blob to convert.
   * @returns {Promise<string>} A promise that resolves with the base64 encoded string.
   */
  async function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  
  /**
   * Prunes old items from local RAG storage if it's getting full.
   * @returns {Promise<void>}
   */
  async function pruneLocalRAG() {
    const STORAGE_LIMIT = 100 * 1024 * 1024; // 100MB limit
    const items = await chrome.storage.local.get(null);
    let totalSize = JSON.stringify(items).length;
  
    if (totalSize > STORAGE_LIMIT) {
      const ragItems = Object.entries(items)
        .filter(([key]) => key.startsWith('rag_'))
        .sort(([, a], [, b]) => b.timestamp - a.timestamp);
  
      while (totalSize > STORAGE_LIMIT * 0.8 && ragItems.length > 0) {
        const [key, item] = ragItems.pop();
        await chrome.storage.local.remove(key);
        totalSize -= JSON.stringify(item).length;
      }
  
      console.log('Pruned local RAG storage');
    }
  }