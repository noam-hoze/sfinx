# Research: Weighted Mean Scorer

## Decisions

- Use cumulative weighted mean per trait: `S_T = Σ(w·r_T)/Σw`, tracked incrementally as `(W·S + w·r)/(W+w)`.
- Confidence: `conf_T = W_T/(W_T + c)` with default `c=2` (evidence‑based, monotonic).
- Weight builder: `w = clip(d)·clip(q)·((clip(w_ind)+clip(w_rec))/2)` then `w = min(w,w_max)`; default `w_max=1.0`.
- Inputs outside [0,1] are clipped; invalid/NaN throw `InvalidInputError`.
- Merge is commutative/associative; zero‑sum merge returns `{S=initialScore,W=0,n=0}`.

## Rationale

- Deterministic, order‑invariant arithmetic is easy to test and reason about.
- Evidence‑based confidence (W) avoids coupling to raw scores and prevents premature gating.
- Exposed snapshots improve observability and aid debugging.

## Alternatives Considered

- EMA (exponential moving average): rejected (order‑dependent, spec forbids EMAs).
- Bayesian aggregation: rejected (overkill, spec forbids Bayes; requires priors, complicates debugging).
- Off‑the‑shelf stats libraries: rejected (overhead; minimal arithmetic needed).
