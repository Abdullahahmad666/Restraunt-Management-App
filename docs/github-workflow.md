# GitHub workflow and branch protection

This is the setup guide for whoever administers the repository. Do all of it
before anyone starts feature work.

## 1. Repository settings

**Settings -> General -> Pull Requests**

- [x] Allow squash merging - **set the default commit message to "Pull request title and description"**
- [ ] Allow merge commits - *off*
- [ ] Allow rebase merging - *off*
- [x] Always suggest updating pull request branches
- [x] Automatically delete head branches

One merge method means one shape of history. Squash gives you one commit per PR
on `main`, which makes `git log` readable and `git revert` a single command.

## 2. Protect `main`

**Settings -> Rules -> Rulesets -> New branch ruleset**

- Name: `main protection`
- Enforcement status: **Active**
- Target branches: **Include default branch**

Enable these rules:

| Rule | Setting |
| --- | --- |
| Restrict deletions | on |
| Block force pushes | on |
| Require linear history | on |
| Require a pull request before merging | on |
| ↳ Required approvals | **1** |
| ↳ Dismiss stale approvals when new commits are pushed | on |
| ↳ Require review from Code Owners | **off for now** - see below |
| ↳ Require conversation resolution before merging | on |
| Require status checks to pass | on |
| ↳ Require branches to be up to date before merging | on |

### Code Owners: leave it off until there are two of you

[.github/CODEOWNERS](../.github/CODEOWNERS) is valid but currently names one
person, because it can only list accounts that already have write access.

GitHub never requests review from a PR's own author. So while Abdullah is the
only code owner, any PR he opens needs a code-owner approval that nobody is
able to give, and the PR is stuck with no exit but an admin bypass. Turn the
rule on once at least two people have write access and CODEOWNERS names them.

Two related gotchas:

- **Team syntax needs an organisation.** `@org/team-name` cannot resolve on a
  repo owned by a personal account. Use individual usernames until the project
  moves to a GitHub org.
- **Add the collaborator before the CODEOWNERS line.** Naming an account that
  lacks write access makes GitHub flag the entire file, not just that line.

**Bypass list: leave it empty.** A rule the admin can walk around is a
convention, not a rule. If you genuinely need to bypass it, you can add
yourself for five minutes and remove yourself after - and that action is
logged, which is the point.

### Status checks

Status checks only appear in the picker after they have run at least once.
So: open a throwaway PR that touches both `backend/` and `mobile/`, let CI run,
then come back and add these as required:

- `Lint (ruff)`
- `Tests (pytest)`
- `Lint, typecheck, test`

**Watch out:** both workflows use `paths:` filters, so a mobile-only PR never
runs the backend jobs. A required check that never runs leaves the PR blocked
forever. Two ways out, pick one:

1. **Don't require path-filtered checks** - require only checks that run on
   every PR. Simplest, and fine for a team of four.
2. Add a `paths-ignore`-free "skip job" that reports the same check name as a
   success when the path filter misses. More correct, more machinery.

Start with option 1: require nothing at first, watch for a week, then require
the checks that reliably run.

## 3. Roles

**Settings -> Collaborators and teams**

Give the three non-admin collaborators **Write**. Write is enough to push
branches and open PRs, and it does not include the ability to change protection
rules. Exactly one person needs **Admin**.

## 4. Same setup from the CLI

If you prefer not to click through the UI (needs `gh` and admin rights):

```bash
gh api --method PUT repos/:owner/:repo/branches/main/protection \
  --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": []
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}
JSON
```

Then set merge behaviour:

```bash
gh repo edit --enable-squash-merge --enable-merge-commit=false \
  --enable-rebase-merge=false --delete-branch-on-merge
```

Add required check names to `contexts` once they have run once.

## 5. Day-to-day flow

```
main
 │
 ├── feature/ahmad-order-management
 ├── feature/ali-inventory
 ├── feature/usman-auth
 └── feature/hamza-dashboard
              │
              ▼
        Pull Request
              │
        CI + 1 approval + conversations resolved
              │
              ▼
        Squash merge -> main, branch deleted
```

```bash
git switch main && git pull --ff-only
git switch -c feature/usman-auth
# ... work ...
git add -p && git commit -m "feat(auth): add JWT login endpoint"
git push -u origin feature/usman-auth
gh pr create --fill                 # or open it in the browser
```

## 6. Keeping four people out of each other's way

- **One issue, one branch, one PR.** If a branch grows a second purpose, split it.
- **Assign issues before coding.** Two people rewriting the same serializer is
  the most common waste on a small team.
- **Merge order matters for shared files.** Whoever touches `settings.py`,
  `package.json` or `config/urls.py` should merge first and tell the others to
  rebase.
- **Rebase daily.** `git fetch origin && git rebase origin/main`. A conflict
  found today is ten minutes; found in a week it is an afternoon.
- **Review within a working day.** With four people and one required approval,
  a slow reviewer blocks the whole team.

## 7. When protection gets in the way

It will, and that is usually the rule working.

**"My PR is blocked on a check that never ran."** Path filters. See the note in
section 2 - remove that check from the required list.

**"main is broken and I need to fix it now."** Open a `fix/` branch and PR like
always. With one approval and green CI that is about five minutes. Bypassing
protection to fix a break is how the second break happens.

**"Nobody is around to approve."** The approval requirement is the point. If
this is genuinely common, the team is too spread out - not the rule too strict.
Temporarily adding yourself to the bypass list is logged and reviewable; force
pushing is not.

**"I need to force push my own branch."** You can - protection only covers
`main`. Use `--force-with-lease`.
