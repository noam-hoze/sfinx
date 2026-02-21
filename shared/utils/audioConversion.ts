/**
 * Audio conversion utilities for Mascotbot integration
 * Converts raw PCM audio to WAV format for browser playback
 */

/**
 * Converts base64-encoded PCM audio to WAV format with proper headers.
 * Mascotbot API returns raw 16-bit PCM at 24kHz that browsers cannot play directly.
 * 
 * @param base64PCM - Base64-encoded PCM audio data
 * @param sampleRate - Audio sample rate in Hz (default: 24000)
 * @returns ArrayBuffer containing complete WAV file with headers
 * @throws Error if input is empty or invalid base64
 */
export function convertPCMToWAV(
  base64PCM: string,
  sampleRate: number = 24000
): ArrayBuffer {
  if (!base64PCM || base64PCM.length === 0) {
    throw new Error('PCM data cannot be empty');
  }

  let pcmData: Uint8Array;
  try {
    pcmData = base64ToUint8Array(base64PCM);
  } catch (error) {
    console.error('[audioConversion] Failed to decode base64:', {
      length: base64PCM.length,
      firstChars: base64PCM.substring(0, 100),
      lastChars: base64PCM.substring(base64PCM.length - 100),
      error: error instanceof Error ? error.message : String(error)
    });
    throw new Error(`Invalid base64 PCM data: ${error instanceof Error ? error.message : String(error)}`);
  }

  const wavHeader = createWAVHeader(pcmData.length, sampleRate);
  const result = concatenateArrays(wavHeader, pcmData);
  return result.buffer;
}

/**
 * Decodes base64 string to Uint8Array
 * Uses manual decoding to avoid browser atob() length limitations
 */
function base64ToUint8Array(base64: string): Uint8Array {
  // Clean the base64 string - remove any whitespace/newlines
  const cleanedBase64 = base64.replace(/\s/g, '');

  // Base64 character lookup table
  const lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookupTable: {[key: string]: number} = {};
  for (let i = 0; i < lookup.length; i++) {
    lookupTable[lookup[i]] = i;
  }

  // Calculate output length
  let paddingLength = 0;
  if (cleanedBase64.endsWith('==')) paddingLength = 2;
  else if (cleanedBase64.endsWith('=')) paddingLength = 1;

  const outputLength = (cleanedBase64.length * 3) / 4 - paddingLength;
  const bytes = new Uint8Array(outputLength);

  // Decode base64 manually
  let byteIndex = 0;
  for (let i = 0; i < cleanedBase64.length; i += 4) {
    // Get 4 base64 characters (or less for the last group)
    const c1 = cleanedBase64[i];
    const c2 = cleanedBase64[i + 1];
    const c3 = cleanedBase64[i + 2];
    const c4 = cleanedBase64[i + 3];
    if (lookupTable[c1] === undefined && c1 !== '=') throw new Error(`Invalid base64 character: ${c1}`);
    if (lookupTable[c2] === undefined && c2 !== '=') throw new Error(`Invalid base64 character: ${c2}`);
    const char1 = lookupTable[c1] ?? 0;
    const char2 = lookupTable[c2] ?? 0;
    const char3 = lookupTable[c3] ?? 0;
    const char4 = lookupTable[c4] ?? 0;

    // Convert to 3 bytes
    const byte1 = (char1 << 2) | (char2 >> 4);
    const byte2 = ((char2 & 15) << 4) | (char3 >> 2);
    const byte3 = ((char3 & 3) << 6) | char4;

    bytes[byteIndex++] = byte1;
    if (byteIndex < outputLength) bytes[byteIndex++] = byte2;
    if (byteIndex < outputLength) bytes[byteIndex++] = byte3;
  }

  return bytes;
}

/**
 * Creates WAV file header (44 bytes) for PCM audio
 */
function createWAVHeader(
  dataSize: number,
  sampleRate: number
): Uint8Array {
  const numChannels = 1; // mono
  const bitsPerSample = 16;
  const wavHeader = new Uint8Array(44);
  const view = new DataView(wavHeader.buffer);

  writeRIFFChunk(view, dataSize);
  writeFmtChunk(view, numChannels, sampleRate, bitsPerSample);
  writeDataChunk(view, dataSize);

  return wavHeader;
}

/**
 * Writes RIFF chunk to WAV header
 */
function writeRIFFChunk(view: DataView, dataSize: number): void {
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + dataSize, true); // file size - 8
  view.setUint32(8, 0x57415645, false); // "WAVE"
}

/**
 * Writes fmt chunk to WAV header
 */
function writeFmtChunk(
  view: DataView,
  numChannels: number,
  sampleRate: number,
  bitsPerSample: number
): void {
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true); // audio format (PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  const byteRate = sampleRate * numChannels * bitsPerSample / 8;
  view.setUint32(28, byteRate, true);
  const blockAlign = numChannels * bitsPerSample / 8;
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
}

/**
 * Writes data chunk header to WAV header
 */
function writeDataChunk(view: DataView, dataSize: number): void {
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, dataSize, true);
}

/**
 * Concatenates two Uint8Arrays
 */
function concatenateArrays(
  a: Uint8Array,
  b: Uint8Array
): Uint8Array {
  const result = new Uint8Array(a.length + b.length);
  result.set(a, 0);
  result.set(b, a.length);
  return result;
}
