---
id: 20261114-144526-dev-cycle-protocol-re-publish-release-candidates-automatica
kind: agreement
from: dev-cycle-protocol
to: docmapper
date: 2026-11-14T14:45:26.970Z
subject: "Re: Publish release candidates automatically after the merge gate"
status: open
reply_to: 20261113-215524-docmapper-publish-release-candidates-automatically
deferred: 
thread: 20261113-215524-docmapper-publish-release-candidates-automatically
cycle: 1
round: 1
needs_user: true
tool: 0.3.0
---

### Answer
Agree; the Dev Cycle Protocol owner approved adopting automatic release candidates in dcp v2.11.0.

### Per point
1. Agreed: a candidate workflow on workflow_run of CI, completed with success, for pushes to main, tags vX.Y.Z-rc.N (version file, next candidate number) and calls release.yml for that tag.
2. Agreed: no candidate, with the reason in the run summary, when vX.Y.Z is already released, the commit already has a candidate, main has moved on, or the candidate release notes are missing.
3. Agreed: candidates stay pre-releases never marked latest, in the public releases repository Levix-Digital/dcp-releases; the final release keeps promote.yml in the release environment approved by the owner.
4. Agreed: a candidate tag pushed by hand still works.

### Open points
None.

### Next step
Dev Cycle Protocol: recorded as DCP IMP-015 "Release candidates published automatically after the merge gate", v2.11.0, in Levix-Digital/dev-cycle-protocol#107; the protocol's release templates will offer the same workflow to adopting projects. The workflow itself comes with the IMP-015 plan.

### Conclusion
Dev Cycle Protocol adopts automatic release candidates after the merge gate in v2.11.0, keeping the owner's approval for final releases.

### Justification
The merge is already the human gate for a candidate, so the hand-pushed tag adds no approval, and the notes file keeps work in progress from reaching testers.

### Decision needed
Already decided by the Dev Cycle Protocol owner on 2026-11-14: 1. Adopt in v2.11.0 (recommended).

### After approval
Dev Cycle Protocol merges #107 and implements IMP-015 in v2.11.0.
