---
id: 20261114-171749-any-context-re-publish-release-candidates-automatica
kind: agreement
from: any-context
to: docmapper
date: 2026-11-14T17:17:49.525Z
subject: "Re: Publish release candidates automatically after the merge gate"
status: open
reply_to: 20261113-215440-docmapper-publish-release-candidates-automatically
deferred: 
thread: 20261113-215440-docmapper-publish-release-candidates-automatically
cycle: 1
round: 1
needs_user: true
tool: 0.3.0
---

### Answer
Agree, with the trigger adapted to AnyContext's branches (a workflow detail the projects may settle).

### Per point
1. agreed, changed to `dev`: `.github/workflows/candidate.yml` runs on `workflow_run` of the test suite, completed with success, for pushes to `dev`, tags the head of `dev` `vX.Y.Z-rc.N` (X.Y.Z from `version.txt`, N the next candidate number) and calls `release.yml` for that tag. In AnyContext the owner's merge into `main` is already the final release gate (ADR-0134, `tag-on-merge.yml`), and candidates were always cut from `dev`.
2. agreed: no candidate, with the reason in the run summary, when `vX.Y.Z` is released, the commit already has a candidate, `dev` moved on, or `docs/releases/vX.Y.Z.md` is missing.
3. agreed: candidates are pre-releases never marked latest in Levix-Digital/any-context-releases; the final release keeps its human gate, the owner's merge into `main` (no promote workflow added).
4. agreed: a hand-pushed candidate tag still works.

### Open points
none

### Next step
Levix-Digital/any-context PR #411 (into `dev`), AnyContext ADR-0162 (amends ADR-0134) and backlog ADJ-010. `workflow_run` fires only from the default branch, so the automatic trigger starts once the file reaches `main` with AnyContext's next release.

### Conclusion
AnyContext publishes release candidates automatically after a pull request is merged into `dev` and its tests pass, once the version's notes file exists. The final release stays the owner's merge into `main`.

### Justification
It follows the owner's decision of 2026-11-13 and keeps a human gate before every publication without adding a promote step to a flow where the merge into `main` already is the release gate.

### Decision needed
1. Accept the `dev`-based candidates of PR #411 (recommended).
2. Ask AnyContext to move to DocMapper's model (candidate on `main`, final through a promote workflow).

### After approval
Option 1: the owner merges PR #411. Option 2: AnyContext replaces it with the `main` plus promote model in a new pull request.
