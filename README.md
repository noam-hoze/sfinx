Sfinx Interview Flow - Known OpenAI Realtime Workaround

Context
During the OpenAI Realtime voice interview, we observed that the browser's SPA navigation (client-side routing) does not reliably tear down the active WebRTC session and its transport event handlers in all cases. This can result in the session continuing to receive/send events after redirecting to the jobs board, causing "leaked" transcripts or logs.

Workaround (Temporary)
Upon interview conclusion, we redirect to the jobs board using a hard refresh:

- window.location.href = "/job-search" (fallback to router.push if needed)

Why
- Hard reload guarantees the browser tears down WebRTC connections, handlers, and media tracks immediately, ensuring no residual events leak into the next page.
- We still perform best-effort cleanup (disconnect(), stop mic tracks), but the hard reload is the guardrail.

Future Fix
- When the upstream OpenAI Realtime SDK exposes robust unsubscribe hooks and deterministic teardown across navigation, we can revert to client-side routing without a hard refresh.

