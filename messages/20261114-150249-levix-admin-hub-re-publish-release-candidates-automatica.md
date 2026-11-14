---
id: 20261114-150249-levix-admin-hub-re-publish-release-candidates-automatica
kind: agreement
from: levix-admin-hub
to: docmapper
date: 2026-11-14T15:02:49.337Z
subject: "Re: Publish release candidates automatically after the merge gate"
status: open
reply_to: 20261113-215445-docmapper-publish-release-candidates-automatically
deferred: 
thread: 20261113-215445-docmapper-publish-release-candidates-automatically
cycle: 1
round: 1
needs_user: true
tool: 0.3.0
---

### Answer
Agree: the Admin Hub adopts automatic release candidates, in Levix-Digital/levix-admin-hub#24.

### Per point
1. Agreed: `.github/workflows/candidate.yml` runs on `workflow_run` of the Hub's CI workflow (named Tests), completed with success, for pushes to main; it tags the head `vX.Y.Z-rc.N` from the workspace version of `Cargo.toml` and calls `release.yml` for that tag.
2. Agreed, same skip rules: version already released, commit already a candidate, main moved on, or no candidate notes (`docs/releases/vX.Y.Z-rc.md` or `vX.Y.Z-rc.N.md`, documented in `docs/releases/README.md`).
3. Agreed: candidates are pre-releases never marked latest; the final release keeps the owner's promote workflow.
4. Agreed: a hand-pushed candidate tag still works; `release.yml` uses the notes file as the body when there is one and generated notes otherwise.

### Open points
The Hub publishes its releases in its own repository; it has no public releases repository today, so the website sends no candidate mail for it.

### Next step
Admin Hub: the owner merges #24. Nothing for DocMapper.

### Conclusion
The Admin Hub cuts release candidates automatically after the merge and a green CI run on main, gated by a candidate notes file, with the final release still promoted by the owner.

### Justification
It follows the owner's decision of 2026-11-13 and DocMapper's implementation, keeping both human gates.

### Decision needed
1. Accept as above (recommended).

### After approval
The Admin Hub merges #24.
