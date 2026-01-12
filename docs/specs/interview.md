# Interview Feature Spec

## Overview
The interview feature guides candidates through a background Q&A stage before transitioning to the coding IDE, coordinating audio/visual cues, recording, and session state.

## Background Interview
- Background questions are spoken aloud, accompanied by the interviewer avatar and camera UI.
- Announcements precede the first question, with word-by-word typing synced to speech completion.

## HeyGen Streaming Avatar Integration
- The background stage can use HeyGen Streaming Avatar for lip-synced delivery of questions and announcements.
- Feature flags:
  - `NEXT_PUBLIC_HEYGEN_ENABLED` enables HeyGen for the background stage.
  - `NEXT_PUBLIC_HEYGEN_FALLBACK_STATIC` allows fallback to the static avatar when HeyGen fails.
- Required configuration:
  - `NEXT_PUBLIC_HEYGEN_API_KEY`
  - `NEXT_PUBLIC_HEYGEN_AVATAR_ID`
  - `NEXT_PUBLIC_ELEVEN_LABS_CANDIDATE_VOICE_ID`
- When HeyGen is disabled, the background stage falls back to the existing `/api/tts` flow.
