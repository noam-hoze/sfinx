/**
 * Tests for TTS service
 * 100% coverage required per AGENTS.md
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateTTS } from './tts';

// Mock logger service
vi.mock('app/shared/services/logger', () => ({
  log: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock logger config
vi.mock('app/shared/services/logger.config', () => ({
  LOG_CATEGORIES: {
    TTS: 'TTS',
  },
}));

// Mock fetch globally
global.fetch = vi.fn();

describe('tts service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateTTS', () => {
    it('should return ArrayBuffer on successful TTS generation', async () => {
      const mockArrayBuffer = new ArrayBuffer(100);
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => mockArrayBuffer,
      });

      const result = await generateTTS('Hello world');

      expect(result).toBe(mockArrayBuffer);
      expect(result.byteLength).toBe(100);
    });

    it('should call fetch with correct endpoint', async () => {
      const mockArrayBuffer = new ArrayBuffer(100);
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => mockArrayBuffer,
      });

      await generateTTS('Test text');

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/tts',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: 'Test text' }),
        })
      );
    });

    it('should call fetch with correct headers', async () => {
      const mockArrayBuffer = new ArrayBuffer(100);
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => mockArrayBuffer,
      });

      await generateTTS('Test');

      const call = (global.fetch as any).mock.calls[0];
      expect(call[1].headers).toEqual({ 'Content-Type': 'application/json' });
    });

    it('should throw error for empty text', async () => {
      await expect(generateTTS('')).rejects.toThrow('Text cannot be empty');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should throw error for whitespace-only text', async () => {
      await expect(generateTTS('   ')).rejects.toThrow('Text cannot be empty');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should surface API 400 error correctly', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      });

      await expect(generateTTS('test')).rejects.toThrow(
        'TTS API error: 400 Bad Request'
      );
    });

    it('should surface API 500 error correctly', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(generateTTS('test')).rejects.toThrow(
        'TTS API error: 500 Internal Server Error'
      );
    });

    it('should handle network error gracefully', async () => {
      (global.fetch as any).mockRejectedValueOnce(
        new Error('Network error')
      );

      await expect(generateTTS('test')).rejects.toThrow('Network error');
    });

    it('should validate response is ArrayBuffer type', async () => {
      const mockArrayBuffer = new ArrayBuffer(50);
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => mockArrayBuffer,
      });

      const result = await generateTTS('test');

      expect(result).toBeInstanceOf(ArrayBuffer);
    });
  });
});
