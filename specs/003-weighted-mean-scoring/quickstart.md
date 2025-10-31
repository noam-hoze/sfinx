# Quickstart: Weighted Mean Scorer

## API

Paths:

- Core: `shared/services/weightedMean/scorer.ts`
- Types: `shared/services/weightedMean/types.ts`

Exports:

- `computeWeight(d,q,w_ind,w_rec,w_max?)`
- `initState(cfg?)`, `reset(cfg?)`
- `update(state, {trait, r, w}, cfg?) → { state, snapshot }`
- `merge(a,b,cfg?)`
- `confidences(state,cfg?)`, `stopCheck(state, coverage, cfg?)`

## Config
```ts
const cfg = { w_max: 1.0, c: 2, τ: 0.7, initialScore: 0.5 };
```

## Initialize
```ts
const S0 = initState(cfg); // { A:{S:0.5,W:0,n:0}, C:{...}, R:{...} }
```

## Compute a weight
```ts
const w = computeWeight(d, q, w_ind, w_rec, cfg.w_max);
if (w === 0) { /* skip */ }
```

## Update with a sample
```ts
const { state: S1, snapshot } = update(S0, { r: {A:0.7, C:0.6, R:0.8}, w, evidence:{A:true,C:true,R:false} });
// snapshot contains {trait, r_T, w, S_before, W_before, S_after, W_after, n_after}
```

## Confidence & stop
```ts
const conf = confidences(S1); // per-trait conf_T = W_T/(W_T + c)
const ready = stopCheck(S1, {A:true, C:true, R:false}); // coverage + n≥2 + conf≥τ
```

## Merge
```ts
const Sm = merge(Sa, Sb); // commutative/associative; handles zero-sum branch
```
