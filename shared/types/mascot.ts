/**
 * Type definitions for Mascotbot integration
 */

/**
 * Viseme data point for lip-sync animation
 * Mascotbot API returns arrays of these for precise mouth movements
 */
export interface Viseme {
  /** Time offset in milliseconds when this viseme should be displayed */
  offset: number;
  /** Viseme ID (0-21) corresponding to mouth shape */
  visemeId: number;
}

/**
 * Configuration for Mascotbot feature
 */
export interface MascotConfig {
  /** Whether mascot lip-sync is enabled */
  enabled: boolean;
  /** Mascotbot API key for authentication */
  apiKey: string;
}
