/**
 * Audio caching utility for localStorage
 * Stores audio files as base64 to speed up subsequent demo runs
 */

const CACHE_PREFIX = "sfinx-audio-cache-";
const CACHE_VERSION = "v1";

/**
 * Generate cache key for audio
 */
function getCacheKey(identifier: string): string {
  return `${CACHE_PREFIX}${CACHE_VERSION}-${identifier}`;
}

/**
 * Convert ArrayBuffer to base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert base64 string to ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Cache audio data in localStorage
 */
export function cacheAudio(identifier: string, audioBuffer: ArrayBuffer): void {
  try {
    const base64 = arrayBufferToBase64(audioBuffer);
    const cacheKey = getCacheKey(identifier);
    localStorage.setItem(cacheKey, base64);
    console.log(`[audioCache] Cached audio: ${identifier}`);
  } catch (error) {
    console.warn(`[audioCache] Failed to cache audio ${identifier}:`, error);
  }
}

/**
 * Retrieve cached audio from localStorage
 */
export function getCachedAudio(identifier: string): ArrayBuffer | null {
  try {
    const cacheKey = getCacheKey(identifier);
    const base64 = localStorage.getItem(cacheKey);
    if (!base64) {
      return null;
    }
    console.log(`[audioCache] Retrieved cached audio: ${identifier}`);
    return base64ToArrayBuffer(base64);
  } catch (error) {
    console.warn(`[audioCache] Failed to retrieve cached audio ${identifier}:`, error);
    return null;
  }
}

/**
 * Cache a Blob (for TTS audio)
 */
export async function cacheBlob(identifier: string, blob: Blob): Promise<void> {
  try {
    const arrayBuffer = await blob.arrayBuffer();
    cacheAudio(identifier, arrayBuffer);
  } catch (error) {
    console.warn(`[audioCache] Failed to cache blob ${identifier}:`, error);
  }
}

/**
 * Retrieve cached audio as Blob
 */
export function getCachedBlob(identifier: string, mimeType: string = "audio/mpeg"): Blob | null {
  const arrayBuffer = getCachedAudio(identifier);
  if (!arrayBuffer) {
    return null;
  }
  return new Blob([arrayBuffer], { type: mimeType });
}

/**
 * Load and cache a sound effect from a URL
 */
export async function loadAndCacheSoundEffect(url: string, identifier: string): Promise<HTMLAudioElement> {
  // Check cache first
  const cached = getCachedAudio(identifier);
  if (cached) {
    const blob = new Blob([cached], { type: "audio/mpeg" });
    const blobUrl = URL.createObjectURL(blob);
    const audio = new Audio(blobUrl);
    audio.preload = "auto";
    return audio;
  }

  // Load from network and cache
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  cacheAudio(identifier, arrayBuffer);
  
  const blob = new Blob([arrayBuffer], { type: "audio/mpeg" });
  const blobUrl = URL.createObjectURL(blob);
  const audio = new Audio(blobUrl);
  audio.preload = "auto";
  return audio;
}

/**
 * Clear all audio caches (useful for debugging)
 */
export function clearAudioCache(): void {
  const keys = Object.keys(localStorage);
  keys.forEach(key => {
    if (key.startsWith(CACHE_PREFIX)) {
      localStorage.removeItem(key);
    }
  });
  console.log("[audioCache] Cleared all audio caches");
}

