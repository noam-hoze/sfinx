/**
 * Mascot service for Mascotbot API integration
 * Handles viseme generation and PCM audio streaming
 */

import { log } from 'app/shared/services/logger';
import { LOG_CATEGORIES } from 'app/shared/services/logger.config';
import type { Viseme } from '../types/mascot';

const LOG_CATEGORY = LOG_CATEGORIES.MASCOT;

/**
 * Fetches visemes and PCM audio from Mascotbot API for given text.
 * Calls our API route which handles SSE stream parsing.
 * 
 * @param text - Text to generate visemes and audio for
 * @returns Object containing visemes array and base64-encoded PCM audio
 * @throws Error if API fails
 */
export async function generateVisemesAndAudio(
  text: string
): Promise<{ visemes: Viseme[]; audioBase64: string }> {
  log.info(LOG_CATEGORY, '[Mascot] Generating visemes and audio for text:', text.substring(0, 50));
  
  const response = await fetchMascotbotAPI(text);
  const data = await response.json();
  
  log.info(LOG_CATEGORY, '[Mascot] Generated:', data.visemes.length, 'visemes,', data.audioBase64.length, 'audio bytes');
  return { visemes: data.visemes, audioBase64: data.audioBase64 };
}

/**
 * Calls our API route which proxies to Mascotbot
 */
async function fetchMascotbotAPI(text: string): Promise<Response> {
  const response = await fetch('/api/mascot/visemes-audio', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    const error = `Mascot API error: ${response.status} - ${errorText}`;
    log.error(LOG_CATEGORY, error);
    throw new Error(error);
  }

  return response;
}

