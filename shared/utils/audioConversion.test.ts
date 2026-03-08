/**
 * Tests for audioConversion utility
 * 100% coverage required per AGENTS.md
 */

import { describe, it, expect } from 'vitest';
import { convertPCMToWAV } from './audioConversion';

describe('audioConversion', () => {
  describe('convertPCMToWAV', () => {
    it('should convert valid PCM to WAV with proper header', () => {
      // Create sample PCM data (silence)
      const pcmData = new Uint8Array(100).fill(0);
      const base64PCM = btoa(String.fromCharCode(...pcmData));
      
      const result = convertPCMToWAV(base64PCM);
      
      expect(result).toBeInstanceOf(ArrayBuffer);
      expect(result.byteLength).toBe(144); // 44 header + 100 data
    });

    it('should have correct RIFF identifier in bytes 0-3', () => {
      const pcmData = new Uint8Array(100).fill(0);
      const base64PCM = btoa(String.fromCharCode(...pcmData));
      
      const result = convertPCMToWAV(base64PCM);
      const bytes = new Uint8Array(result);
      
      // "RIFF" = 0x52494646
      expect(bytes[0]).toBe(0x52); // R
      expect(bytes[1]).toBe(0x49); // I
      expect(bytes[2]).toBe(0x46); // F
      expect(bytes[3]).toBe(0x46); // F
    });

    it('should have correct WAVE identifier in bytes 8-11', () => {
      const pcmData = new Uint8Array(100).fill(0);
      const base64PCM = btoa(String.fromCharCode(...pcmData));
      
      const result = convertPCMToWAV(base64PCM);
      const bytes = new Uint8Array(result);
      
      // "WAVE" = 0x57415645
      expect(bytes[8]).toBe(0x57);  // W
      expect(bytes[9]).toBe(0x41);  // A
      expect(bytes[10]).toBe(0x56); // V
      expect(bytes[11]).toBe(0x45); // E
    });

    it('should encode sample rate correctly at 24000 Hz (bytes 24-27)', () => {
      const pcmData = new Uint8Array(100).fill(0);
      const base64PCM = btoa(String.fromCharCode(...pcmData));
      
      const result = convertPCMToWAV(base64PCM, 24000);
      
      const view = new DataView(result);
      const sampleRate = view.getUint32(24, true);
      expect(sampleRate).toBe(24000);
    });

    it('should encode channels correctly as mono (bytes 22-23)', () => {
      const pcmData = new Uint8Array(100).fill(0);
      const base64PCM = btoa(String.fromCharCode(...pcmData));
      
      const result = convertPCMToWAV(base64PCM);
      
      const view = new DataView(result);
      const numChannels = view.getUint16(22, true);
      expect(numChannels).toBe(1); // mono
    });

    it('should encode bit depth correctly as 16-bit (bytes 34-35)', () => {
      const pcmData = new Uint8Array(100).fill(0);
      const base64PCM = btoa(String.fromCharCode(...pcmData));
      
      const result = convertPCMToWAV(base64PCM);
      
      const view = new DataView(result);
      const bitsPerSample = view.getUint16(34, true);
      expect(bitsPerSample).toBe(16);
    });

    it('should have correct data chunk header (bytes 36-39)', () => {
      const pcmData = new Uint8Array(100).fill(0);
      const base64PCM = btoa(String.fromCharCode(...pcmData));
      
      const result = convertPCMToWAV(base64PCM);
      const bytes = new Uint8Array(result);
      
      // "data" = 0x64617461
      expect(bytes[36]).toBe(0x64); // d
      expect(bytes[37]).toBe(0x61); // a
      expect(bytes[38]).toBe(0x74); // t
      expect(bytes[39]).toBe(0x61); // a
    });

    it('should append PCM data correctly after header', () => {
      const pcmData = new Uint8Array([1, 2, 3, 4, 5]);
      const base64PCM = btoa(String.fromCharCode(...pcmData));
      
      const result = convertPCMToWAV(base64PCM);
      const bytes = new Uint8Array(result);
      
      expect(bytes[44]).toBe(1);
      expect(bytes[45]).toBe(2);
      expect(bytes[46]).toBe(3);
      expect(bytes[47]).toBe(4);
      expect(bytes[48]).toBe(5);
    });

    it('should throw error for empty input', () => {
      expect(() => convertPCMToWAV('')).toThrow('PCM data cannot be empty');
    });

    it('should throw error for invalid base64', () => {
      expect(() => convertPCMToWAV('invalid!@#$%')).toThrow('Invalid base64 PCM data');
    });

    it('should handle different sample rates (8000 Hz)', () => {
      const pcmData = new Uint8Array(100).fill(0);
      const base64PCM = btoa(String.fromCharCode(...pcmData));
      
      const result = convertPCMToWAV(base64PCM, 8000);
      
      const view = new DataView(result);
      const sampleRate = view.getUint32(24, true);
      expect(sampleRate).toBe(8000);
    });

    it('should handle different sample rates (16000 Hz)', () => {
      const pcmData = new Uint8Array(100).fill(0);
      const base64PCM = btoa(String.fromCharCode(...pcmData));
      
      const result = convertPCMToWAV(base64PCM, 16000);
      
      const view = new DataView(result);
      const sampleRate = view.getUint32(24, true);
      expect(sampleRate).toBe(16000);
    });

    it('should handle different sample rates (48000 Hz)', () => {
      const pcmData = new Uint8Array(100).fill(0);
      const base64PCM = btoa(String.fromCharCode(...pcmData));
      
      const result = convertPCMToWAV(base64PCM, 48000);
      
      const view = new DataView(result);
      const sampleRate = view.getUint32(24, true);
      expect(sampleRate).toBe(48000);
    });

    it('should handle very small audio (1 byte)', () => {
      const pcmData = new Uint8Array([42]);
      const base64PCM = btoa(String.fromCharCode(...pcmData));
      
      const result = convertPCMToWAV(base64PCM);
      const bytes = new Uint8Array(result);
      
      expect(result.byteLength).toBe(45); // 44 header + 1 data
      expect(bytes[44]).toBe(42);
    });

    it('should handle large audio buffer', () => {
      const pcmData = new Uint8Array(100000).fill(127);
      const base64PCM = btoa(String.fromCharCode(...pcmData));
      
      const result = convertPCMToWAV(base64PCM);
      const bytes = new Uint8Array(result);
      
      expect(result.byteLength).toBe(100044); // 44 header + 100000 data
      // Verify header is intact
      expect(bytes[0]).toBe(0x52); // R
      expect(bytes[1]).toBe(0x49); // I
    });
  });
});
