# Principles

## Interview Flow
- AI chat transcripts MUST contain only messages emitted by OpenAI responses.
- The system MUST NOT inject or simulate AI chat messages manually. Every AI utterance must originate from the model.
- If interview flow behavior diverges from the expected script, the system MUST throw an explicit error—never fall back silently.

