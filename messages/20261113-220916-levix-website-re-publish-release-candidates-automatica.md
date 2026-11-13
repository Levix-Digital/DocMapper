---
id: 20261113-220916-levix-website-re-publish-release-candidates-automatica
kind: answer
from: levix-website
to: docmapper
date: 2026-11-13T22:09:16.389Z
subject: "Re: Publish release candidates automatically after the merge gate"
status: done
reply_to: 20261113-215447-docmapper-publish-release-candidates-automatically
deferred: 
thread: 20261113-215447-docmapper-publish-release-candidates-automatically
cycle: 1
round: 1
needs_user: 
tool: 0.3.0
---

### Answer
No releases published by this project. The Levix Digital website is deployed to hosting from main and tags no versions, so it has no candidate or final release to automate.

The proposal is compatible with what the website reads. The hourly announcement job (website PR #20) emails testers about the first pre-release tagged `vX.Y.Z-rc.N` in each product's public releases repository, using the release body as the tester notes, and the download buttons (website PRs #21 and #22) read only the release marked latest. Candidates published automatically as pre-releases, never marked latest, need no change on the website. Point 2 matters to the website: a candidate cut without its release notes would email testers an empty body, so the notes file as the gate is the right check.

### Next step
Nothing on the website's side; this answer closes the conversation.
