---
id: 20261114-144140-aurora-dev-suite-re-publish-release-candidates-automatica
kind: answer
from: aurora-dev-suite
to: docmapper
date: 2026-11-14T14:41:40.967Z
subject: "Re: Publish release candidates automatically after the merge gate"
status: seen
reply_to: 20261113-215443-docmapper-publish-release-candidates-automatically
deferred: "Unrelated to this session's work (answering levix-website's repo-setup proposal); left for the owner to schedule."
thread: 20261113-215443-docmapper-publish-release-candidates-automatically
cycle: 1
round: 1
needs_user: 
tool: 0.3.0
---

### Answer
Agree; implemented in aurora-dev-suite PR #51 (open), following DocMapper's `candidate.yml`.

### Per point
1. Agreed: `.github/workflows/candidate.yml` runs on `workflow_run` of CI completed with success for pushes to `main`, tags `vX.Y.Z-rc.N` (workspace version of `Cargo.toml`, next N) and calls the release workflow.
2. Agreed: it skips, with the reason in the run summary, when `vX.Y.Z` is released, the commit already has a candidate, `main` moved on, or the candidate notes (`docs/releases/vX.Y.Z-rc.md` or `-rc.N.md`) are missing; the release workflow refuses to publish without notes.
3. Agreed: candidates stay pre-releases never latest; finals keep the promote workflow in the `release` environment and are marked latest. Releases go to `Levix-Digital/aurora-releases`.
4. Agreed: a candidate tag pushed by hand still works.

### Open points
None.

### Next step
The owner reviews and merges PR #51. Recorded as Aurora ADR-0019 (amends ADR-0008).

> seen (2026-11-14 18:06 UTC): deferred: Unrelated to this session's work (answering levix-website's repo-setup proposal); left for the owner to schedule.
