/**
 * Text-to-Speech service
 * Consolidated TTS generation logic using ElevenLabs API
 */

import { log } from 'app/shared/services/logger';
import { LOG_CATEGORIES } from 'app/shared/services/logger.config';

const LOG_CATEGORY = LOG_CATEGORIES.TTS;

/**
 * Generates TTS audio via ElevenLabs API.
 * Returns raw audio ArrayBuffer for playback or further processing.
 * 
 * @param text - Text to convert to speech
 * @returns ArrayBuffer containing audio data
 * @throws Error if text is empty or API fails
 */
export async function generateTTS(text: string): Promise<ArrayBuffer> {
  validateText(text);
  
  log.info(LOG_CATEGORY, '[TTS] Generating audio for text:', text.substring(0, 50));
  
  const response = await fetchTTS(text);
  const audioBuffer = await response.arrayBuffer();
  
  log.info(LOG_CATEGORY, '[TTS] Generated audio:', audioBuffer.byteLength, 'bytes');
  return audioBuffer;
}

/**
 * Validates input text is not empty
 */
function validateText(text: string): void {
  if (!text || text.trim().length === 0) {
    throw new Error('Text cannot be empty');
  }
}

/**
 * Calls TTS API endpoint
 */
async function fetchTTS(text: string): Promise<Response> {
  const response = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const error = `TTS API error: ${response.status} ${response.statusText}`;
    log.error(LOG_CATEGORY, error);
    throw new Error(error);
  }

  return response;
}
