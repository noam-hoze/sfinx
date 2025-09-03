# Eleven Labs TTS Setup

To enable text-to-speech for Sfinx, you need to:

1. **Get your Eleven Labs API key:**

    - Visit: https://elevenlabs.io/app/profile
    - Sign up/login to Eleven Labs
    - Go to your profile settings
    - Copy your API key

2. **Add to your .env.local file:**

    ```
    ELEVENLABS_API_KEY=your_actual_api_key_here
    ```

3. **Restart your development server:**
    ```bash
    pnpm run dev
    ```

## Features Added:

-   ✅ **TTS API Route**: `/api/tts` generates speech from text
-   ✅ **Audio Playback**: Automatic playback of AI responses
-   ✅ **Fallback Handling**: Continues working if TTS fails
-   ✅ **Lip Sync Integration**: Audio syncs with avatar animations

## Voice Settings:

Currently using:

-   Voice ID: `21m00Tcm4TlvDq8ikWAM` (Rachel - Professional female voice)
-   Model: `eleven_monolingual_v1`
-   Stability: 0.5
-   Similarity Boost: 0.5

You can change the voice ID in `/app/api/tts/route.ts` to use different voices.
