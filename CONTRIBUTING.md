# Contributing

## The one rule

**Nobody pushes to `main`.** Not for a typo, not for a one-line config change,
not at 2am before a demo. Every change reaches `main` through a pull request
that one other person approved and that CI passed.

Branch protection enforces this, so a direct push will simply be rejected.

## Branching

Cut every branch from an up-to-date `main`:

```bash
git switch main
git pull --ff-only
git switch -c feature/ahmad-order-management
```

Naming: `<type>/<yourname>-<topic>`

| Type | Use for |
| --- | --- |
| `feature/` | new capability |
| `fix/` | bug fix |
| `chore/` | dependencies, config, tooling |
| `docs/` | documentation only |
| `refactor/` | no behaviour change |

There is no long-lived `develop` branch. `main` is always the stable version.
If we later need release trains, we will add them then - not before.

## Commits

Conventional Commits, because the squash-merge title becomes the changelog:

```
feat(orders): add order status transition endpoint
fix(auth): refresh token before retrying a 401
chore(deps): bump react-native to 0.77.1
docs(api): document the order lifecycle
```

Scopes: `auth`, `orders`, `inventory`, `payments`, `restaurants`, `api`, `ui`,
`ci`, `deps`.

## Pull requests

1. Push your branch: `git push -u origin feature/ahmad-order-management`
2. Open a PR against `main`. The template fills itself in - complete it.
3. **Keep it small.** Under ~400 changed lines gets a real review; 2,000 lines
   gets a rubber stamp. Split large work into stacked PRs.
4. Link the issue: `Closes #12`.
5. Request one reviewer. CODEOWNERS auto-requests the right person.
6. Fix CI before asking for review. A red PR is not ready.
7. Resolve every review conversation - either change the code or reply
   explaining why not. Unresolved conversations block the merge.
8. **Squash and merge.** One commit per PR on `main`.
9. Delete the branch (GitHub does this automatically).

### Keeping your branch current

`main` must be mergeable into your branch before GitHub will let you merge:

```bash
git switch feature/ahmad-order-management
git fetch origin
git rebase origin/main
git push --force-with-lease
```

Use `--force-with-lease`, never plain `--force` - it refuses to overwrite
commits you have not seen, which is what saves you when someone else pushed to
your branch.

## Reviewing

You are the second pair of eyes, not a linter - CI handles formatting.

Look for:

- Does it do what the issue asked?
- Is there a test for the behaviour that changed?
- Permissions: can a waiter hit an endpoint only a manager should reach?
- N+1 queries (`select_related` / `prefetch_related`)?
- Does a backend response shape change break the mobile client in this PR?
- Anything hardcoded that belongs in the environment?

Review conventions:

- **Turn PRs around within one working day.** A blocked teammate is more
  expensive than your context switch.
- Prefix non-blocking comments with `nit:`. Everything else blocks.
- "Request changes" for correctness and security. "Comment" for preferences.
- Approving means *you* are comfortable with this on `main`.

## Working across the stack

When a feature touches both sides, agree the API contract **before** writing
code - put the endpoint, request body and response shape in the issue. Then
build both halves in one PR so `main` is never in a state where the app and
the API disagree.

If the halves must ship separately, the backend goes first and stays backwards
compatible until the app catches up.

## Before you push

```bash
# backend
cd backend && ruff check . && ruff format . && pytest

# mobile
cd mobile && npm run lint && npm run typecheck && npm test
```

## Never commit

- `.env` files, secrets, API keys, keystores, service-account JSON
- `node_modules/`, `.venv/`, build output
- Commented-out code or debug `print` / `console.log`

If a secret does land in a commit, say so immediately in the team channel.
Rotating the credential is the fix - deleting the commit is not, because it is
already in everyone's clone and in GitHub's reflog.
