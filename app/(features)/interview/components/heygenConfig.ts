/**
 * HeyGen client configuration helpers for interview streaming.
 */
export type HeyGenClientConfig = {
  enabled: boolean;
  allowFallback: boolean;
  apiKey: string | undefined;
  avatarId: string | undefined;
  voiceId: string | undefined;
};

/**
 * Reads HeyGen client configuration from environment variables.
 */
export function getHeyGenClientConfig(): HeyGenClientConfig {
  return {
    enabled: process.env.NEXT_PUBLIC_HEYGEN_ENABLED === "true",
    allowFallback: process.env.NEXT_PUBLIC_HEYGEN_FALLBACK_STATIC === "true",
    apiKey: process.env.NEXT_PUBLIC_HEYGEN_API_KEY,
    avatarId: process.env.NEXT_PUBLIC_HEYGEN_AVATAR_ID,
    voiceId: process.env.NEXT_PUBLIC_ELEVEN_LABS_CANDIDATE_VOICE_ID,
  };
}
