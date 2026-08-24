## What does this change?

<!-- One or two sentences. What behaviour is different after this merges? -->

## Why?

Closes #<!-- issue number -->

## Scope

- [ ] Backend (`backend/`)
- [ ] Mobile (`mobile/`)
- [ ] Docs / CI / tooling

## How was this tested?

<!-- Commands you ran, screens you tapped through, device/emulator used. -->

## API contract

- [ ] No API change
- [ ] API changed - endpoints, request/response shapes and status codes are
      described below, and `mobile/src/api/endpoints.ts` + `mobile/src/types/api.ts`
      are updated in this PR

<!-- If the API changed, describe it here. -->

## Screenshots / recordings

<!-- Required for any UI change. -->

## Checklist

- [ ] Branch is named `feature/<name>-<topic>` (or `fix/`, `chore/`, `docs/`)
- [ ] Rebased on the latest `main`
- [ ] Tests added or updated for the behaviour I changed
- [ ] `makemigrations` run and the migration committed (backend model changes)
- [ ] No secrets, tokens, `.env` files or API keys in the diff
- [ ] No stray `console.log` / `print` / commented-out code
- [ ] Self-reviewed the diff before requesting review
