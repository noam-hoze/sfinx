/**
 * createCandidates(interviewScript)
 * - Deterministically returns 20 candidates varied across four tiers:
 *   5x score 9.0, 5x 7.5, 5x 5.0, 5x 2.5.
 * - No randomness used.
 * - Each candidate has concise answers and a single-file React coding solution string.
 *
 * Usage:
 *   const candidates = createCandidates(interviewScript);
 *   // interviewScript is unused for logic (kept for interface parity).
 */

export type Tier = "expert" | "strong" | "average" | "weak";

export type Candidate = {
    id: string; // slug (e.g., "ava-taylor")
    name: string; // display name
    score: 9.0 | 7.5 | 5.0 | 2.5;
    tier: Tier;
    answers: {
        complexReactIntegration: string;
        crossContextComm: string;
        secureValidation: string;
        prodDebug: string;
        perfMeasureImprove: string;
        globalState: string;
        renderOptimize: string;
    };
    code: string; // Single-file React (App.tsx) per tier
};

export function createCandidates(_interviewScript: string): Candidate[] {
    const tiers: Array<{
        tier: Tier;
        score: Candidate["score"];
        count: number;
    }> = [
        { tier: "expert", score: 9.0, count: 5 },
        { tier: "strong", score: 7.5, count: 5 },
        { tier: "average", score: 5.0, count: 5 },
        { tier: "weak", score: 2.5, count: 5 },
    ];

    // ---- Answer banks (concise, deterministic, tiered) ----
    const answersBank: Record<Tier, Candidate["answers"][]> = {
        expert: [
            {
                complexReactIntegration:
                    "Multi-tenant React app embedding partner widgets via iframes + Module Federation; challenges: origin auth, schema versioning, and failure isolation.",
                crossContextComm:
                    "postMessage with strict origin whitelist, typed payloads (zod/io-ts), ACK/Retry with backoff; Workers for batching off main thread.",
                secureValidation:
                    "Runtime schema validation, allowlist of types, origin + channel binding, replay protection via ts nonce, and per-widget capability scoping.",
                prodDebug:
                    "Feature flags + source maps + RUM. Repro via session replay, correlate with server logs, verify fix with canary.",
                perfMeasureImprove:
                    "Track LCP/CLS/INP via Web Vitals; cut bundle with route splits, memoized selectors, virtualization; validate via Profiler and synthetic runs.",
                globalState:
                    "Co-locate state; Context for static config, Zustand/Redux for cross-cutting mutable state with selectors to avoid re-renders.",
                renderOptimize:
                    "Normalize data, derive state, memoize props, split heavy components, use `React.memo` and `useCallback` with stable deps.",
            },
            {
                complexReactIntegration:
                    "React host app orchestrating three vendor UIs; solved CORS + message schema drift with versioned contracts and compatibility layer.",
                crossContextComm:
                    "postMessage + origin pinning, structuredClone-safe payloads, message bus with type guards, backpressure via queues.",
                secureValidation:
                    "Zod-validated payloads, type→handler map, reject unknown versions, Content-Security-Policy + sandboxed iframes.",
                prodDebug:
                    "Only-in-prod? Compare build diffs, enable verbose logs via flag, inspect network + performance panel, bisect releases.",
                perfMeasureImprove:
                    "Set SLOs, profile long tasks, move parsing to Worker, lazy-load charts, prefetch on idle; confirm LCP↓ and INP↓.",
                globalState:
                    "Event-sourced store for integrations, UI slice minimal; selectors + memoization; avoid context value churn.",
                renderOptimize:
                    "Keyed lists, avoid expanding objects inline, use `useMemo` for derived lists, split routes/components.",
            },
            {
                complexReactIntegration:
                    "Payments dashboard wrapped third-party KYC flows; had to bridge focus, sizing, and auth—solved with resize observers + token relay.",
                crossContextComm:
                    "Parent↔iframe protocol with `type` enums, ACKs, exponential backoff, and idle-time batching.",
                secureValidation:
                    "Per-origin keys, strict types, reject unknown `type`, rate-limit noisy widgets, sanitize strings.",
                prodDebug:
                    "Session ID drilldown, turn on `debug` channel, capture HAR, use sourcemapped stack traces, add guardrails.",
                perfMeasureImprove:
                    "Chunk split vendors, inline critical CSS, cache SW; verify with Lighthouse CI and WPT.",
                globalState:
                    "Keep global state small; remote cache in SW; local UI state per component.",
                renderOptimize:
                    "Stabilize refs, avoid prop waterfalls, split heavy children; measure with Profiler flamecharts.",
            },
            {
                complexReactIntegration:
                    "Electron shell hosting React + webviews; unified message bus across renderer/process with schema and capabilities.",
                crossContextComm:
                    "Abstract transport: postMessage in web, IPC in Electron; same envelope/protocol.",
                secureValidation:
                    "Handshake on boot, capability tokens, schema hash, timeout/circuit-breakers.",
                prodDebug:
                    "Symbolicated traces, controlled experiments, guard to fallback UI.",
                perfMeasureImprove:
                    "Preload critical, defer non-critical, move CPU to Worker, cache JSON.",
                globalState:
                    "Redux for cross-surface; RTK Query for data; keep UI local.",
                renderOptimize:
                    "Selector granularity + memoized view models; windowing for feeds.",
            },
            {
                complexReactIntegration:
                    "Complex B2B embed with nested iframes; solved resize loops and auth using postMessage + ResizeObserver + token refresh.",
                crossContextComm:
                    "Define `Envelope {type, version, ts, payload}`; enforce version gates and origin checks.",
                secureValidation:
                    "Strict allowlist, sanitize payload, monitor anomalies, kill-switch flag.",
                prodDebug:
                    "Compare traces before/after, live metrics dashboard, roll forward with hotfix.",
                perfMeasureImprove:
                    "Reduce hydration cost, defer third-party, use `useTransition`; verify RUM deltas.",
                globalState:
                    "Zustand stores per domain; selectors + shallow compare; avoid global write storms.",
                renderOptimize:
                    "Memo heavy charts, split Suspense boundaries, `startTransition` for filters.",
            },
        ],
        strong: [
            {
                complexReactIntegration:
                    "Host app embedding vendor config wizards; handled auth tokens and sizing.",
                crossContextComm:
                    "postMessage with origin check and typed payloads; simple ACK pattern.",
                secureValidation:
                    "Type guards + allowlisted event names; ignore unknown fields.",
                prodDebug:
                    "Enable debug logs via env flag; inspect network + console; use source maps.",
                perfMeasureImprove:
                    "Code-splitting, memoization, list virtualization; track Web Vitals.",
                globalState:
                    "Context for static config; Zustand/Redux for shared mutable data.",
                renderOptimize:
                    "`React.memo`, `useCallback`, avoid new object literals in props.",
            },
            {
                complexReactIntegration:
                    "Micro-frontend widget integrated via Module Federation.",
                crossContextComm:
                    "postMessage channel; version field in messages.",
                secureValidation: "Origin check + basic schema validation.",
                prodDebug:
                    "Remote logging + feature flags; replicate in staging.",
                perfMeasureImprove: "Lazy-load heavy charts; cache data.",
                globalState: "Redux Toolkit + selectors; keep slices small.",
                renderOptimize: "Split large components; memo expensive calcs.",
            },
            {
                complexReactIntegration:
                    "Analytics overlay added as embedded widget.",
                crossContextComm: "Whitelisted origins and message types.",
                secureValidation: "Schema guard; reject unknown types.",
                prodDebug: "Sourcemaps + Sentry breadcrumbs.",
                perfMeasureImprove: "Remove unused deps; prefetch routes.",
                globalState: "Zustand with slices; avoid prop drilling.",
                renderOptimize: "Memo lists; `useMemo` for derived data.",
            },
            {
                complexReactIntegration:
                    "React admin integrating payments iframe.",
                crossContextComm: "postMessage with ACK timeout.",
                secureValidation: "Allowlist + type guard.",
                prodDebug: "Feature toggle + logs.",
                perfMeasureImprove: "Tree-shake + split vendors.",
                globalState: "Context for config; store for data.",
                renderOptimize: "`memo` + selectors.",
            },
            {
                complexReactIntegration:
                    "Dashboard embedding support chat widget.",
                crossContextComm: "Message router by `type`.",
                secureValidation: "Drop unknown payloads.",
                prodDebug: "Capture user session ID.",
                perfMeasureImprove: "Compress JSON, cache.",
                globalState: "Redux slices, RTK Query.",
                renderOptimize: "Defer non-critical UI.",
            },
        ],
        average: [
            {
                complexReactIntegration:
                    "Added third-party form inside iframe; basic sizing and auth.",
                crossContextComm: "Used postMessage; minimal origin check.",
                secureValidation: "Checked `type`; light shape checking.",
                prodDebug: "Console logs, network tab, basic alerts.",
                perfMeasureImprove: "Split routes, memo some components.",
                globalState: "Context + reducer; some prop drilling remains.",
                renderOptimize: "Used `memo` in hot paths, not everywhere.",
            },
            {
                complexReactIntegration:
                    "Integrated marketing widget with simple API.",
                crossContextComm: "postMessage, assumed same version.",
                secureValidation: "Checked `type` only.",
                prodDebug: "Replicated on staging.",
                perfMeasureImprove: "Image optimization; gzip.",
                globalState: "Redux with a few large slices.",
                renderOptimize: "Avoided inline functions in lists.",
            },
            {
                complexReactIntegration:
                    "Embed calendar; handled height changes.",
                crossContextComm: "Message listener per page.",
                secureValidation: "Trusted origin by config.",
                prodDebug: "Look at stack traces.",
                perfMeasureImprove: "Bundle split by route.",
                globalState: "Context for app-wide state.",
                renderOptimize: "Basic memoization.",
            },
            {
                complexReactIntegration: "Added analytics tag manager UI.",
                crossContextComm: "One-way messages to parent.",
                secureValidation: "String checks only.",
                prodDebug: "Browser devtools.",
                perfMeasureImprove: "Reduced re-renders a bit.",
                globalState: "Single store; few selectors.",
                renderOptimize: "Some `useCallback`s.",
            },
            {
                complexReactIntegration: "Simple iframe for docs.",
                crossContextComm: "Minimal listener.",
                secureValidation: "Type presence check.",
                prodDebug: "Console output.",
                perfMeasureImprove: "Lazy load some routes.",
                globalState: "Context provider.",
                renderOptimize: "Memo big lists.",
            },
        ],
        weak: [
            {
                complexReactIntegration: "Embedded a page with an iframe.",
                crossContextComm: "Did not use origin checks.",
                secureValidation: "Trusted all fields.",
                prodDebug: "Added `console.log`.",
                perfMeasureImprove: "No metrics collected.",
                globalState: "Single global context.",
                renderOptimize: "No memoization.",
            },
            {
                complexReactIntegration: "Copied code from example.",
                crossContextComm: "Listened to all messages.",
                secureValidation: "None implemented.",
                prodDebug: "Reload until it works.",
                perfMeasureImprove: "None.",
                globalState: "Put everything in context.",
                renderOptimize: "Rendered whole tree.",
            },
            {
                complexReactIntegration: "Iframe with default settings.",
                crossContextComm: "Any origin allowed.",
                secureValidation: "Only checked `type` exists.",
                prodDebug: "Alert() for errors.",
                perfMeasureImprove: "Huge bundle.",
                globalState: "No store; props everywhere.",
                renderOptimize: "Inline functions in lists.",
            },
            {
                complexReactIntegration: "Did not need special integration.",
                crossContextComm: "N/A.",
                secureValidation: "N/A.",
                prodDebug: "Looked at console.",
                perfMeasureImprove: "Not measured.",
                globalState: "Global vars.",
                renderOptimize: "None.",
            },
            {
                complexReactIntegration: "Basic embed, no comms.",
                crossContextComm: "Not implemented.",
                secureValidation: "Not implemented.",
                prodDebug: "Guess-and-check.",
                perfMeasureImprove: "Ignored.",
                globalState: "Ad-hoc state.",
                renderOptimize: "Re-renders everywhere.",
            },
        ],
    };

    // ---- Code variants per tier (single-file React) ----
    const codeByTier: Record<Tier, string> = {
        expert: `import React, { useEffect, useMemo, useRef, useState } from "react";

export default function App() {
  type AnalyticsEvent = { type: "analytics:event"; name: string; ts: number; version?: "1.0" };
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const allowedOrigin = useMemo(() => window.location.origin, []); // demo: same-origin
  const queueRef = useRef<AnalyticsEvent[]>([]);
  const flushTimer = useRef<number | null>(null);

  // Simple schema guard
  const isAnalytics = (d: any): d is AnalyticsEvent =>
    d && d.type === "analytics:event" && typeof d.name === "string" && typeof d.ts === "number";

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      // ✅ origin check (here same-origin for demo, adapt in real use)
      if (e.origin !== allowedOrigin) return;
      if (!isAnalytics(e.data)) return;

      queueRef.current.push(e.data);
      if (flushTimer.current == null) {
        flushTimer.current = window.setTimeout(() => {
          setEvents(prev => [...prev, ...queueRef.current]);
          queueRef.current = [];
          flushTimer.current && window.clearTimeout(flushTimer.current);
          flushTimer.current = null;
        }, 300); // batch to avoid UI thrash
      }

      // Optional ACK pattern (echo back)
      (e.source as Window)?.postMessage(
        { type: "analytics:ack", name: e.data.name, ts: Date.now() },
        e.origin
      );
    };

    window.addEventListener("message", onMsg);
    return () => {
      window.removeEventListener("message", onMsg);
      if (flushTimer.current) window.clearTimeout(flushTimer.current);
    };
  }, [allowedOrigin]);

  // Simulated child-post (no real iframe per prompt)
  const sendMock = (name: string) => {
    const msg: AnalyticsEvent = { type: "analytics:event", name, ts: Date.now(), version: "1.0" };
    window.postMessage(msg, allowedOrigin);
  };

  return (
    <div style={{ padding: 16, fontFamily: "sans-serif" }}>
      <h3>Analytics Event Receiver (Expert)</h3>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button onClick={() => sendMock("WidgetLoaded")}>Send "WidgetLoaded"</button>
        <button onClick={() => sendMock("ButtonClicked")}>Send "ButtonClicked"</button>
      </div>
      <div>Count: {events.length}</div>
      <ul style={{ marginTop: 8 }}>
        {events.map((e, i) => (
          <li key={i}>{e.name} · {new Date(e.ts).toLocaleTimeString()}</li>
        ))}
      </ul>
    </div>
  );
}
`,
        strong: `import React, { useEffect, useState } from "react";

export default function App() {
  type AnalyticsEvent = { type: "analytics:event"; name: string; ts: number };
  const [events, setEvents] = useState<string[]>([]);
  const allowedOrigin = window.location.origin; // assume same-origin for test

  const isAnalytics = (d: any): d is AnalyticsEvent =>
    d?.type === "analytics:event" && typeof d.name === "string" && typeof d.ts === "number";

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.origin !== allowedOrigin) return;
      if (!isAnalytics(e.data)) return;
      setEvents(prev => [...prev, e.data.name]);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [allowedOrigin]);

  const sendMock = (name: string) =>
    window.postMessage({ type: "analytics:event", name, ts: Date.now() }, allowedOrigin);

  return (
    <div style={{ padding: 16, fontFamily: "sans-serif" }}>
      <h3>Analytics Event Receiver (Strong)</h3>
      <button onClick={() => sendMock("WidgetLoaded")}>Send</button>
      <ul style={{ marginTop: 12 }}>
        {events.map((n, i) => <li key={i}>{n}</li>)}
      </ul>
    </div>
  );
}
`,
        average: `import React, { useEffect, useState } from "react";

export default function App() {
  const [events, setEvents] = useState<string[]>([]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      // ⚠️ Minimal checks (average): only type/name present, no origin gating
      const d: any = e.data;
      if (!d || d.type !== "analytics:event" || typeof d.name !== "string") return;
      setEvents(prev => [...prev, d.name]);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const sendMock = (name: string) =>
    window.postMessage({ type: "analytics:event", name, ts: Date.now() }, "*");

  return (
    <div style={{ padding: 16, fontFamily: "sans-serif" }}>
      <h3>Analytics Event Receiver (Average)</h3>
      <button onClick={() => sendMock("WidgetLoaded")}>Send</button>
      <ul style={{ marginTop: 12 }}>
        {events.map((n, i) => <li key={i}>{n}</li>)}
      </ul>
    </div>
  );
}
`,
        weak: `import React, { useEffect, useState } from "react";

export default function App() {
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    const h = (e: MessageEvent) => {
      // ❌ Weak: accepts all messages; no schema or origin checks
      setEvents(prev => [...prev, e.data]);
    };
    window.addEventListener("message", h);
    // ❌ Weak: no cleanup
  }, []);

  const sendMock = () => window.postMessage({ any: "thing" } as any, "*");

  return (
    <div style={{ padding: 16, fontFamily: "sans-serif" }}>
      <h3>Analytics Event Receiver (Weak)</h3>
      <button onClick={sendMock}>Send</button>
      <ul style={{ marginTop: 12 }}>
        {events.map((d, i) => <li key={i}>{JSON.stringify(d)}</li>)}
      </ul>
    </div>
  );
}
`,
    };

    // deterministic pick helper
    const pick = <T>(arr: T[], idx: number) => arr[idx % arr.length];

    // Fixed deterministic names (mixed male/female)
    const names: Array<{ name: string; slug: string }> = [
        { name: "Ava Taylor", slug: "ava-taylor" },
        { name: "Liam Carter", slug: "liam-carter" },
        { name: "Emma Brooks", slug: "emma-brooks" },
        { name: "Noah Bennett", slug: "noah-bennett" },
        { name: "Olivia Reed", slug: "olivia-reed" },
        { name: "Ethan Parker", slug: "ethan-parker" },
        { name: "Mia Collins", slug: "mia-collins" },
        { name: "James Turner", slug: "james-turner" },
        { name: "Sophia Hayes", slug: "sophia-hayes" },
        { name: "Henry Cooper", slug: "henry-cooper" },
        { name: "Grace Martin", slug: "grace-martin" },
        { name: "Lucas Wright", slug: "lucas-wright" },
        { name: "Isabella Price", slug: "isabella-price" },
        { name: "Jacob Foster", slug: "jacob-foster" },
        { name: "Chloe Murphy", slug: "chloe-murphy" },
        { name: "Daniel Ross", slug: "daniel-ross" },
        { name: "Harper Diaz", slug: "harper-diaz" },
        { name: "Samuel Ward", slug: "samuel-ward" },
        { name: "Lily Cook", slug: "lily-cook" },
        { name: "Alexander Gray", slug: "alexander-gray" },
    ];

    // Build candidates
    const out: Candidate[] = [];
    let n = 0;

    for (const { tier, score, count } of tiers) {
        const bank = answersBank[tier];
        for (let i = 0; i < count; i++) {
            const a = pick(bank, i);
            out.push({
                id: names[n % names.length].slug,
                name: names[n % names.length].name,
                score,
                tier,
                answers: { ...a },
                code: codeByTier[tier],
            });
            n++;
        }
    }

    return out;
}
