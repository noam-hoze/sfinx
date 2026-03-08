# E2E Test — Inputs & Expected Outputs

Profile: **strong-candidate** | Job: `uvision-test-rt-embedded-software-developer`

---

## Inputs

### Identities
| Role | Email | ID |
|---|---|---|
| Candidate | noam.hoze@gmail.com | `candidate-noam-hoze` (display: Noam Hoze) |
| Company | manager@uvision-test.com | `uvision-test` |

### Background Stage
One answer submitted via text input, then force-complete:

> "In my last role at a robotics company, I designed the real-time firmware scheduler for a 6-axis robotic arm using FreeRTOS. The main challenge was meeting 1ms control loop deadlines while handling CAN bus interrupts. I solved it by implementing a priority-based preemptive scheduler with dedicated ISR handlers that reduced jitter to under 50 microseconds."

### Coding Stage
Typed character-by-character into Monaco:
```
function fibonacci(n: number): number {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}
```
Paste detection: **disabled** — see ARCH-002 in `docs/open-issues.md`.

### Active Feature Flags (from `.env.test`)
| Flag | Value | Effect |
|---|---|---|
| `NEXT_PUBLIC_AUTOMATIC_MODE` | true | Submit button appears on IDE load |
| `NEXT_PUBLIC_USE_SPLIT_EVALUATION` | true | 3-call background eval architecture |
| `NEXT_PUBLIC_CODE_EVALUATION_THROTTLE_MS` | 3000 | Min ms between coding evaluations |
| `NEXT_PUBLIC_OPENAI_EVALUATION_MODEL` | gpt-4o-mini | Model for all evaluations |
| `NEXT_PUBLIC_SKIP_SCREEN_SHARE` | true | Skips screen share prompt |
| `NEXT_PUBLIC_SKIP_ANNOUNCEMENT` | true | Skips announcement screen |

---

## Evaluation Pipeline

After each background answer, three API calls fire in sequence:

```
answer submitted
  ├─ next-question   (~300ms)   → next question rendered; evaluatingAnswer → false
  ├─ score-answer    (~2–3s)    → categoryStats updated in Redux (stage 1 contributions)
  └─ evaluate-answer (~8–10s)  → categoryStats re-updated; bg-eval-completed count++ (stage 2)

forceCompleteBackground (called only after bg-eval-completed increments)
  └─ background stage ends → background-complete screen shown

"Start Coding Challenge" clicked
  └─ Monaco editor loads → Submit button appears (isCodingStarted=true)

code typed in editor
  └─ evaluate-code-change (~throttled 3s) → CategoryContribution written to DB; eval-completed count++

CPS page load  [ARCH-001: should move to interview end]
  └─ POST background-summary → OpenAI generates BackgroundSummary record
```

---

## Expected Outputs

### 1. Background complete
| Signal | Condition |
|---|---|
| `[data-testid="background-complete"]` visible | — |
| `data-session-id` attribute | non-empty string |

### 2. Coding contributions
`GET /api/interviews/session/{sessionId}/contributions` — polled up to 30s, interval 4s

| Field | Condition |
|---|---|
| `contributions.length` | > 0 |
| `categoryStats.length` | > 0 |
| contributions where `codeChange !== ""` | ≥ 1 |
| every contribution: `categoryName` | truthy |
| every contribution: `contributionStrength` | > 0 |
| every contribution: `explanation` | truthy |
| every contribution: `caption` | truthy |
| every categoryStats entry: `confidence` | in [0, 1] |
| every categoryStats entry: `avgStrength` | ≥ 0 |

### 3. CPS page
| Element | Condition |
|---|---|
| `[data-testid="cps-page"]` visible | within 30s |
| `[data-testid="cps-candidate-story"]` | text length > 10 |
| `[data-testid="cps-evidence-reel"]` | visible |
| `[data-testid="cps-experience-section"]` | visible |

**Score assertion — internal consistency:**

The displayed score is not a hardcoded expected value. Instead, fetch the raw DB data and
recompute using the same formula the app uses, then assert the UI matches exactly:

```
experienceScores  ← GET /background-summary  → experienceCategories[cat].score
categoryScores    ← GET /contributions        → categoryStats[cat].avgStrength
scoringConfig     ← GET /scoring-config       → experienceWeight, codingWeight

expectedScore = calculateScore(experienceScores, categoryScores, scoringConfig)

assert cps-overall-score === expectedScore
```

### 4. Background summary
`GET /api/interviews/session/{sessionId}/background-summary` — polled up to 90s, interval 3s
> Note: only available after CPS page loads (ARCH-001).

| Field | Condition |
|---|---|
| `summary.executiveSummary` | truthy |

### 5. Background evidence
`GET /api/interviews/session/{sessionId}/background-evidence` — polled up to 60s

| Field | Condition |
|---|---|
| `evidence.length` | > 0 |

### 6. Evidence clip timestamps
Two clips are expected — one per stage. Timestamps are computed from wall-clock values
captured by the test, making them exactly predictable.

**How to assert:**

```
t0 = Date.now()  // before answerQuestion
answerQuestion(...)
t1 = Date.now()  // after bg-eval-completed increments

t2 = Date.now()  // before typeInEditor
typeInEditor(...)
t3 = Date.now()  // after eval-completed increments

recordingStartedAt = GET /api/interviews/session/{sessionId}  →  session.recordingStartedAt
```

| Clip | Source | Expected startTime |
|---|---|---|
| Background answer | `BackgroundEvidence.timestamp` ∈ `[t0, t1]` | `Math.floor((evidenceTimestamp - recordingStartedAt) / 1000)` |
| Code contribution | `EvidenceClip.startTime` for coding category | `Math.floor((codeChangeTimestamp - recordingStartedAt) / 1000)` |

Both clips' `startTime` values must equal the formula above within ±1s (integer floor rounding).

### 7. Video loaded
The CPS page plays the interview recording. Two assertions:

1. **Recording URL exists** — `GET /api/interviews/session/{sessionId}` → `session.videoUrl` is a non-empty string
2. **Video element loaded** — the `<video>` element on the CPS page reaches `readyState >= 2` (HAVE_CURRENT_DATA), meaning the browser successfully fetched and decoded the stream

```ts
const videoUrl = (await page.request.get(`/api/interviews/session/${sessionId}`)).json().videoUrl;
expect(videoUrl).toBeTruthy();

await page.waitForFunction(
  () => (document.querySelector('video')?.readyState ?? 0) >= 2,
  { timeout: 30_000 }
);
```

### Not asserted (known issues)
| Assertion | Reason |
|---|---|
| `ExternalToolUsage` records | Paste disabled — ARCH-002 |
