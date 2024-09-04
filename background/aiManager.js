import { getApiKey } from '../lib/utils.js';

const AI_ENDPOINTS = {
  'openai': 'https://api.openai.com/v1/chat/completions',
  'anthropic': 'https://api.anthropic.com/v1/messages'
};

/**
 * Shares content with an AI platform and returns the response.
 * @param {string|Blob} data - The data to share with AI.
 * @param {string} aiPlatform - The AI platform to use ('openai' or 'anthropic').
 * @returns {Promise<Object>} A promise that resolves with the AI response.
 */
export async function shareWithAI(data, aiPlatform) {
  try {
    const apiKey = await getApiKey(aiPlatform);
    if (!apiKey) throw new Error(`No API key found for ${aiPlatform}`);

    const endpoint = AI_ENDPOINTS[aiPlatform];
    if (!endpoint) throw new Error(`Unsupported AI platform: ${aiPlatform}`);

    const content = await prepareContent(data);
    const response = await sendRequest(endpoint, apiKey, content, aiPlatform);

    return processResponse(response, aiPlatform);
  } catch (error) {
    console.error(`Failed to share with ${aiPlatform}:`, error);
    throw new Error(`AI sharing failed: ${error.message}`);
  }
}

/**
 * Prepares the content for AI processing.
 * @param {string|Blob} data - The data to prepare.
 * @returns {Promise<string>} A promise that resolves with the prepared content.
 */
async function prepareContent(data) {
  if (typeof data === 'string') {
    return data;
  } else if (data instanceof Blob) {
    if (data.type.startsWith('image/')) {
      return await blobToBase64(data);
    } else {
      throw new Error(`Unsupported Blob type: ${data.type}`);
    }
  } else {
    throw new Error('Unsupported data type');
  }
}

/**
 * Converts a Blob to a base64 encoded string.
 * @param {Blob} blob - The Blob to convert.
 * @returns {Promise<string>} A promise that resolves with the base64 encoded string.
 */
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Sends a request to the AI platform.
 * @param {string} endpoint - The API endpoint.
 * @param {string} apiKey - The API key.
 * @param {string} content - The prepared content.
 * @param {string} aiPlatform - The AI platform being used.
 * @returns {Promise<Object>} A promise that resolves with the API response.
 */
async function sendRequest(endpoint, apiKey, content, aiPlatform) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  };

  const body = aiPlatform === 'openai' 
    ? JSON.stringify({
        model: "gpt-4-vision-preview",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Analyze this content and provide insights:" },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${content}` } }
            ]
          }
        ],
        max_tokens: 300
      })
    : JSON.stringify({
        model: "claude-3-opus-20240229",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Analyze this content and provide insights:" },
              { type: "image", source: { type: "base64", media_type: "image/jpeg", data: content } }
            ]
          }
        ]
      });

  const response = await fetch(endpoint, { method: 'POST', headers, body });
  if (!response.ok) throw new Error(`API request failed: ${response.statusText}`);
  return await response.json();
}

/**
 * Processes the AI response.
 * @param {Object} response - The raw API response.
 * @param {string} aiPlatform - The AI platform that provided the response.
 * @returns {Object} The processed response.
 */
function processResponse(response, aiPlatform) {
  if (aiPlatform === 'openai') {
    return {
      content: response.choices[0].message.content,
      usage: response.usage
    };
  } else if (aiPlatform === 'anthropic') {
    return {
      content: response.content[0].text,
      usage: {
        prompt_tokens: response.usage.input_tokens,
        completion_tokens: response.usage.output_tokens,
        total_tokens: response.usage.input_tokens + response.usage.output_tokens
      }
    };
  } else {
    throw new Error(`Unsupported AI platform: ${aiPlatform}`);
  }
}