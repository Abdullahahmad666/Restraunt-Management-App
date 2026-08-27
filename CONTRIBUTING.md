# Contributing

## The one rule

**Nobody pushes to `stage` or `main`.** Not for a typo, not for a one-line
config change, not at 2am before a demo. Every change reaches them through a
pull request that one other person approved and that CI passed.

Branch protection enforces this on both, so a direct push is simply rejected.

## The two long-lived branches

```
feature/abdullah-attendance ─┐
feature/ali-compliance ──────┼──► PR ──► stage ──► PR ──► main
feature/usman-scan ──────────┘            │                │
                                    integration        released
```

| Branch | What it is |
| --- | --- |
| `stage` | where everything integrates. Your PRs go here. **This is the default branch**, so a fresh clone lands on it and new PRs target it automatically. |
| `main` | the last known-good release. Only ever receives a PR from `stage`. |

## Branching

Cut every branch from an up-to-date `stage`, never from `main`:

```bash
git switch stage
git pull --ff-only
git switch -c feature/ahmad-attendance-scan
```

Naming: `<type>/<yourname>-<topic>`

| Type | Use for |
| --- | --- |
| `feature/` | new capability |
| `fix/` | bug fix |
| `chore/` | dependencies, config, tooling |
| `docs/` | documentation only |
| `refactor/` | no behaviour change |

`stage` is the integration branch, so `main` only changes at a release. If you
find yourself wanting to branch from `main`, the exception is a hotfix - see
below.

## Commits

Conventional Commits, because the squash-merge title becomes the changelog:

```
feat(attendance): add the barcode scan endpoint
fix(auth): refresh token before retrying a 401
chore(deps): bump react-native to 0.87.1
docs(api): document the check-in lifecycle
```

Scopes: `auth`, `attendance`, `payroll`, `compliance`, `equipment`, `audit`,
`notifications`, `restaurants`, `api`, `ui`, `ci`, `deps`.

## Pull requests

1. Push your branch: `git push -u origin feature/ahmad-attendance-scan`
2. Open a PR against **`stage`**. It is the default branch so this is
   pre-selected, but check the base on the PR page - a PR aimed at `main` will
   be rejected by CI.
3. **Keep it small.** Under ~400 changed lines gets a real review; 2,000 lines
   gets a rubber stamp. Split large work into stacked PRs.
4. Link the issue: `Closes #12`.
5. Request one reviewer. CODEOWNERS auto-requests the right person.
6. Fix CI before asking for review. A red PR is not ready.
7. Resolve every review conversation - either change the code or reply
   explaining why not. Unresolved conversations block the merge.
8. **Squash and merge.** One commit per PR on `stage`.
9. Delete the branch (GitHub does this automatically).

### Releasing: `stage` to `main`

When `stage` is in a state worth keeping, open a PR from `stage` into `main`.

**Use a merge commit, not squash.** Squashing would put a commit on `main` that
exists nowhere in `stage`'s history; the two would diverge permanently and every
later release PR would show conflicts in files nobody touched. This is the one
place we do not squash.

### Hotfixes

A bug on `main` that cannot wait for `stage`:

```bash
git switch main && git pull --ff-only
git switch -c fix/abdullah-whatever
# ... fix, PR into main, merge ...
```

Then **immediately merge it back down**, or the next release silently reverts it:

```bash
git switch stage
git pull --ff-only
git merge origin/main
git push
```

Every merge into `main` that did not come from `stage` gets back-merged. No
exceptions - this is the most common way this branching model goes wrong.

### Keeping your branch current

`stage` must be mergeable into your branch before GitHub will let you merge:

```bash
git switch feature/ahmad-attendance-scan
git fetch origin
git rebase origin/stage
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
- Permissions: can a staff token reach an admin-only endpoint?
- N+1 queries (`select_related` / `prefetch_related`)?
- Does a backend response shape change break the mobile client in this PR?
- Can a failed check be closed without a corrective action? It must not be.
- Is anything written to the audit trail also editable somewhere else?
- Anything hardcoded that belongs in the environment?

Review conventions:

- **Turn PRs around within one working day.** A blocked teammate is more
  expensive than your context switch.
- Prefix non-blocking comments with `nit:`. Everything else blocks.
- "Request changes" for correctness and security. "Comment" for preferences.
- Approving means *you* are comfortable with this on `stage`.

## Database and migrations

**Never write CREATE TABLE by hand, and never share a `.sql` file.** Django owns
the schema. If you create a table with raw SQL, Django's migration state does
not know it exists and the next `makemigrations` tries to create it again.

Changing the schema:

```bash
vim backend/apps/attendance/models.py
python manage.py makemigrations attendance   # generates the migration file
python manage.py migrate                     # applies it to your local database
git add backend/apps/attendance/             # model AND migration, one commit
```

Picking up someone else's change:

```bash
git pull
python manage.py migrate
```

`migrate` is always safe to run. Django records applied migrations in a
`django_migrations` table in your own database, so a second run does nothing.

### The rules

1. **The model and its migration go in the same commit.** CI runs
   `makemigrations --check --dry-run`, so a model change without its migration
   fails the build.
2. **Never edit a migration that has been merged.** Once it is on `stage` it may
   already be applied on three other machines. Change it with a *new* migration.
3. **One person owns one app at a time.** Migration conflicts can only happen
   inside a single app, so dividing apps between us removes almost all of them.
4. **If you do get a conflict** - two `0002_*.py` files in one app after a merge
   - Django says "Conflicting migrations detected; multiple leaf nodes". Fix it
   with `python manage.py makemigrations --merge`, or rebase and regenerate.
   Never hand-edit the numbers.
5. **Migrations get reviewed like code.** They are the schema's history and they
   run against production.

### Useful

```bash
python manage.py sqlmigrate attendance 0001   # show the actual SQL
python manage.py dbshell                      # psql against your local database
python manage.py showmigrations               # what is applied and what is not
python manage.py seed_demo                    # development data (refuses in prod)
```

### Demo data vs reference data

- **Reference data the application depends on** - the standard set of
  food-safety check types, for instance - goes in a **data migration**, so every
  environment including production has it.
- **Anything you just want to click around in** goes in **`seed_demo`**. Never
  in a migration: migrations run in production.

## Working across the stack

When a feature touches both sides, agree the API contract **before** writing
code - put the endpoint, request body and response shape in the issue. Then
build both halves in one PR so `stage` is never in a state where the app and
the API disagree.

If the halves must ship separately, the backend goes first and stays backwards
compatible until the app catches up.

## Before you push

```bash
# backend (needs the database up: docker compose up -d db)
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
