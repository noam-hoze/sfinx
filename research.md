# Library Scan

## Logger category filtering
- **Candidates:** loglevel built-in configuration, loglevel-plugin-prefix, loglevel-plugin-remote, loglevel-filter.
- **Decision:** keep existing loglevel usage and add lightweight category filtering in the local logger wrapper.
- **Rationale:** existing logger already wraps loglevel and provides label filtering; category filtering is a small extension without additional runtime dependencies.
- **Alternatives:** adopt loglevel-filter or replace logger with a structured logging library (e.g., pino) for category routing.
