# Quickstart: Background Session Guard

## Constants
- TIMEBOX_MS = 240000 (4:00)
- ZERO_RUN_LIMIT = 2
- PROJECT_CAP = 2

## What this feature does
- Prevents unprompted coding; enforces timebox; prompts for another project after two 0/0/0; caps projects at 2; transitions by earliest rule; shows countdown and guard state.

## Tests (vitest)
Run only guard tests:

```bash
pnpm test -t "backgroundSessionGuard"
```

## Expected Behaviors
- No coding invites before state switch.  
- Transition at ≤ 4:01 after first background question if gate not met sooner.  
- After two 0/0/0, next AI turn asks for another project (if projectsUsed<2).  
- After cap/limit reached, next state is coding (unless gate true earlier).
