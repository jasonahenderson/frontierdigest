# Test Suite Fixes

**Date:** 2026-03-26

## Summary

Fixed all 13 failing tests across the test suite (268 pass, 5 skip, 0 fail). The test plan and test files had been written in a prior session but were never run against the actual implementation, resulting in mismatches between test expectations and real code behavior.

## What Was Fixed

### Test Fixes
- **Pipeline tests** (`pipeline-full.test.ts`, `pipeline-e2e.test.ts`): Changed `.step` to `.name` and `"success"` to `"completed"` to match the `StepResult` schema and `RunTracker` implementation
- **Persist-to-slack tests** (`persist-to-slack.test.ts`): Fixed `getSourceBundle` calls to use `"topicKey/YYYY_MM_DD"` ref format instead of `sourceBundle.id`
- **CLI tests** (smoke + E2E): Rewrote `runCli()` helper to use file-based output capture with an explicit clean env, working around a Bun test runner bug where inherited env breaks subprocess stdout/stderr capture
- **LLM provider test** (`llm-provider.test.ts`): Isolated the `openai-compatible` base_url validation test in a subprocess to avoid `mock.module` contamination from pipeline tests
- **Mock cleanup**: Added `mock.restore()` to pipeline test `afterAll` blocks; preserved original `createModel` in mocks instead of replacing with `() => ({})`

### Production Bug Fix
- **`file-store.ts` `digestIdToDate`**: Updated regex from `^weekly_(\d{4})_(\d{2})_(\d{2})$` to `(\d{4})[_-](\d{2})[_-](\d{2})$` — fixes a real bug where `getDigestEntries(digest.id)` silently returned `[]` when digest IDs use dashes (e.g., `weekly-digest-2026-03-23`). This affected CLI commands `diff-weekly` and `slack-post-weekly`.

## Key Decisions
- Bun test runner has a known limitation: `Bun.spawn()` with inherited `process.env` inside `bun test` produces empty stdout/stderr. Workaround: use `Bun.file()` output targets and a minimal explicit env.
- Bun's `mock.module()` leaks across test files and `mock.restore()` does not undo module mocks. Workaround: subprocess isolation for tests that need the un-mocked module.

## Files Changed
- `packages/core/src/persist/file-store.ts` (production fix)
- `packages/core/test/integration/pipeline-full.test.ts`
- `packages/core/test/integration/persist-to-slack.test.ts`
- `packages/core/test/integration/synthesize-mocked.test.ts`
- `packages/core/test/e2e/pipeline-e2e.test.ts`
- `packages/core/test/synthesize/llm-provider.test.ts`
- `packages/cli/test/integration/cli-smoke.test.ts`
- `packages/cli/test/e2e/cli-e2e.test.ts`

## Next Steps
- Commit the test fixes and the `digestIdToDate` bug fix
- Consider adding CI configuration (`bun test --recursive` on every push)
