---
name: ship
description: Commit the current task's changes and push them to the existing remote when the user says "ship" or "ship it".
---

# Ship

"Ship" means: verify, commit, and push the current task's changes. Invoking
this skill is the user's explicit authorization to write Git history — do not
ship without that ask.

## Before committing

1. Identify the repository and branch (`git status --short`, `git remote -v`,
   `git branch --show-current`). Confirm every changed path belongs to the
   current task. Leave unrelated modified or untracked files alone — never
   stage them, never delete or repurpose them to tidy the tree.
2. Run the project's own checks for the touched area first (its test and
   build commands, e.g. from `package.json` scripts). Do not ship red checks
   without telling the user and getting their word to proceed anyway.
3. If a check fails or the tree contains changes you cannot explain, stop and
   report instead of committing.

## Commit and push

4. Stage only the task's files, by name — never `git add -A` or `-a`.
   Review `git diff --cached --stat` before committing.
5. Create one new commit on top of existing history with a concise message
   describing the change. Never amend, rebase, cherry-pick, revert,
   `reset --hard`, tag, or otherwise rewrite or discard history.
6. Push to the branch's existing remote (`git push origin <branch>`). Never
   create or rename remotes, change the repository name, or move the work to
   another repository unless the user asked for that separately.
7. If a Git lock or corrupt index blocks you, do not delete locks or kill
   processes. Wait, retry, or stop and report the block.
8. Verify before reporting: `git rev-parse HEAD` agrees with the remote
   (`git ls-remote origin <branch>` or the push output), and `git status`
   shows only the unrelated files you deliberately left behind.

## Report

State the commit (short hash, linked when possible), the remote and branch
pushed to, the exact files committed, and which checks ran with their
results. Name anything you left uncommitted and why.
