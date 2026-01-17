/**
 * Tests for Mascot service
 * 100% coverage required per AGENTS.md
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateVisemesAndAudio } from './mascot';
import type { Viseme } from '../types/mascot';

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
    MASCOT: 'MASCOT',
  },
}));

// Mock fetch globally
global.fetch = vi.fn();

// Mock environment
process.env.NEXT_PUBLIC_MASCOTBOT_API_KEY = 'test-api-key';

describe('mascot service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateVisemesAndAudio', () => {
    it('should fetch visemes and audio from API route', async () => {
      const mockData = {
        visemes: [{ offset: 0, visemeId: 1 }],
        audioBase64: 'ABC',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const result = await generateVisemesAndAudio('test');

      expect(result.audioBase64).toBe('ABC');
      expect(result.visemes).toHaveLength(1);
      expect(result.visemes[0]).toEqual({ offset: 0, visemeId: 1 });
      expect(global.fetch).toHaveBeenCalledWith('/api/mascot/visemes-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'test' }),
      });
    });

    it('should return multiple visemes', async () => {
      const mockData = {
        visemes: [
          { offset: 0, visemeId: 1 },
          { offset: 100, visemeId: 2 },
        ],
        audioBase64: 'ABCDEF',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const result = await generateVisemesAndAudio('test');

      expect(result.audioBase64).toBe('ABCDEF');
      expect(result.visemes).toHaveLength(2);
    });

    it('should handle empty visemes', async () => {
      const mockData = {
        visemes: [],
        audioBase64: 'ABC',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const result = await generateVisemesAndAudio('test');

      expect(result.visemes).toEqual([]);
      expect(result.audioBase64).toBe('ABC');
    });

    it('should handle empty audio', async () => {
      const mockData = {
        visemes: [{ offset: 0, visemeId: 1 }],
        audioBase64: '',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const result = await generateVisemesAndAudio('test');

      expect(result.audioBase64).toBe('');
      expect(result.visemes).toHaveLength(1);
    });

    it('should call correct API endpoint', async () => {
      const mockData = { visemes: [], audioBase64: '' };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      await generateVisemesAndAudio('hello world');

      expect(global.fetch).toHaveBeenCalledWith('/api/mascot/visemes-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'hello world' }),
      });
    });

    it('should handle API 401 unauthorized error', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      await expect(generateVisemesAndAudio('test')).rejects.toThrow(
        'Mascot API error: 401'
      );
    });

    it('should surface API 500 error with message', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      await expect(generateVisemesAndAudio('test')).rejects.toThrow(
        'Mascot API error: 500'
      );
    });

    it('should handle network timeout', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network timeout'));

      await expect(generateVisemesAndAudio('test')).rejects.toThrow('Network timeout');
    });

    it('should handle large audio base64', async () => {
      const mockData = {
        visemes: [{ offset: 0, visemeId: 1 }],
        audioBase64: 'A'.repeat(100000),
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const result = await generateVisemesAndAudio('test');

      expect(result.audioBase64.length).toBe(100000);
    });

    it('should handle many visemes', async () => {
      const visemes = Array.from({ length: 100 }, (_, i) => ({
        offset: i * 10,
        visemeId: i % 22,
      }));

      const mockData = {
        visemes,
        audioBase64: 'ABC',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const result = await generateVisemesAndAudio('test');

      expect(result.visemes).toHaveLength(100);
    });

    it('should handle JSON parse errors gracefully', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      await expect(generateVisemesAndAudio('test')).rejects.toThrow('Invalid JSON');
    });

    it('should pass text parameter correctly', async () => {
      const testText = 'Hello, how are you?';
      const mockData = { visemes: [], audioBase64: '' };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      await generateVisemesAndAudio(testText);

      const callArgs = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.text).toBe(testText);
    });

    it('should use correct HTTP method', async () => {
      const mockData = { visemes: [], audioBase64: '' };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      await generateVisemesAndAudio('test');

      const callArgs = (global.fetch as any).mock.calls[0];
      expect(callArgs[1].method).toBe('POST');
    });
  });
});
