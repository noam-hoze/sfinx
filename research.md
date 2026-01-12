# Library Scan

## Logger category filtering
- **Candidates:** loglevel built-in configuration, loglevel-plugin-prefix, loglevel-plugin-remote, loglevel-filter.
- **Decision:** keep existing loglevel usage and add lightweight category filtering in the local logger wrapper.
- **Rationale:** existing logger already wraps loglevel and provides label filtering; category filtering is a small extension without additional runtime dependencies.
- **Alternatives:** adopt loglevel-filter or replace logger with a structured logging library (e.g., pino) for category routing.

## Job category generation (OpenAI)
- **Candidates:** OpenAI chat completions (existing dependency), Anthropic Messages API, Azure OpenAI.
- **Decision:** use the existing OpenAI client and chat completions with JSON output.
- **Rationale:** OpenAI is already integrated in the codebase, supports response JSON formatting, and avoids adding new SDKs.
- **Alternatives:** evaluate Anthropic for structured output, or Azure OpenAI for enterprise key management.
