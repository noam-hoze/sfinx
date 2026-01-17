# Unit Testing Guide for Sfinx

This document describes the unit testing setup and patterns used in the Sfinx codebase.

## Test Infrastructure

### Tools & Setup
- **Test Runner**: Vitest v2.1.9
- **Test Environment**: jsdom (for browser APIs like localStorage, Blob, etc.)
- **Configuration**: `vitest.config.ts`
- **Setup File**: `vitest.setup.ts` (polyfills and global test setup)

### Running Tests
```bash
npm test              # Run all tests
npm test -- <file>    # Run specific test file
```

### Configuration Files

**vitest.config.ts**:
- Environment: jsdom for browser API support
- Path aliases: `@` → project root, `app` → app directory
- Setup file: `vitest.setup.ts`

**vitest.setup.ts**:
- Polyfill for `Blob.arrayBuffer()` (not natively supported in jsdom)
- Future global mocks and test utilities

## Test Coverage

### ✅ Completed Test Files (72 tests)

#### Utilities
- `shared/utils/audioCache.test.ts` (8 tests)
  - Tests for localStorage-based audio caching
  - Blob/ArrayBuffer conversion
  - Cache management

- `shared/services/backgroundSessionGuard.test.ts` (14 tests)
  - Timer management functions
  - Session transition logic
  - Category completion detection

#### Redux State Management
- `shared/state/slices/cpsSlice.test.ts` (8 tests)
  - Evidence timestamp/key management
  - Caption state

- `shared/state/slices/navigationSlice.test.ts` (9 tests)
  - Navigation history tracking
  - Breadcrumb source management
  - SessionStorage persistence behavior

- `shared/state/slices/interviewSlice.test.ts` (13 tests)
  - Interview lifecycle (start, end, reset)
  - Stage transitions
  - Recording state
  - Company/session context
  - Preloaded data handling
  - Global reset action

- `shared/state/slices/backgroundSlice.test.ts` (12 tests)
  - Chat message management
  - Timer functionality
  - Timebox validation
  - State reset

#### Constants & Prompts
- `shared/constants/interview.test.ts` (2 tests)
  - Validates interview constants

- `shared/prompts/openAIInterviewerPrompt.test.ts` (6 tests)
  - Prompt generation with company context
  - Category inclusion
  - Behavioral rules validation

## Testing Patterns

### 1. Redux Slice Testing Pattern

```typescript
import { describe, it, expect } from "vitest";
import reducer, { action1, action2 } from "./slice";

describe("sliceName", () => {
  const initialState = { /* ... */ };

  it("should return initial state", () => {
    const state = reducer(undefined, { type: "@@INIT" });
    expect(state).toEqual(initialState);
  });

  it("should handle action", () => {
    const state = reducer(initialState, action1(payload));
    expect(state.field).toBe(expectedValue);
  });
});
```

### 2. Utility Function Testing

```typescript
import { describe, it, expect } from "vitest";
import { utilFunction } from "./utils";

describe("utilFunction", () => {
  it("should handle normal case", () => {
    expect(utilFunction(input)).toBe(output);
  });

  it("should handle edge case", () => {
    expect(utilFunction(edgeInput)).toBe(edgeOutput);
  });
});
```

### 3. Mocking External Dependencies

```typescript
// Mock logger
vi.mock("app/shared/services/logger", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock with config
vi.mock("app/shared/services/logger.config", () => ({
  LOG_CATEGORIES: {
    CACHE: "cache",
  },
}));
```

### 4. Testing Browser APIs

Browser APIs like localStorage, sessionStorage, Blob are available via jsdom environment:

```typescript
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

it("should use localStorage", () => {
  localStorage.setItem("key", "value");
  expect(localStorage.getItem("key")).toBe("value");
});
```

## Guidelines

### DO:
- ✅ Test public APIs and exported functions
- ✅ Test edge cases (null, undefined, empty, invalid inputs)
- ✅ Test state transitions in Redux slices
- ✅ Clear mocks and storage between tests
- ✅ Use descriptive test names
- ✅ Group related tests with describe blocks

### DON'T:
- ❌ Test implementation details
- ❌ Test third-party library code
- ❌ Create overly complex test setups
- ❌ Use variables in vi.mock (hoisting issues)
- ❌ Forget to clean up side effects

## Future Test Areas

To achieve comprehensive coverage, additional tests should be added for:

### High Priority
- [ ] `shared/state/slices/codingSlice.ts`
- [ ] `shared/services/openAIFlowController.ts`
- [ ] `shared/services/backgroundInterview/*`
- [ ] Additional prompt builders in `shared/prompts/`

### Medium Priority
- [ ] API routes in `app/api/interviews/*` (requires Next.js testing setup)
- [ ] React components in `app/(features)/*` (requires React Testing Library)
- [ ] Server-side utilities in `server/*`

### Low Priority  
- [ ] Integration tests for full interview flows
- [ ] E2E tests with Playwright (already configured)

## Troubleshooting

### "localStorage is not defined"
- Ensure `vitest.config.ts` has `environment: "jsdom"`

### "Blob.arrayBuffer is not a function"
- Check that `setupFiles: ["./vitest.setup.ts"]` is in vitest config
- Verify polyfill exists in `vitest.setup.ts`

### "Cannot access variable before initialization" in vi.mock
- Don't use variables in vi.mock factory functions (hoisting issue)
- Define mocks inline or use vi.fn() directly

### Import path errors
- Check path aliases in `vitest.config.ts`
- Ensure `app` alias points to correct directory

## Test Metrics

- **Total Test Files**: 8
- **Total Tests**: 72
- **Pass Rate**: 100%
- **Coverage**: ~5% of codebase (198 total source files)

## Contributing Tests

When adding new tests:
1. Follow existing patterns in similar test files
2. Use clear, descriptive test names
3. Test both happy path and edge cases
4. Add tests in the same directory as the source file
5. Run tests before committing: `npm test`
