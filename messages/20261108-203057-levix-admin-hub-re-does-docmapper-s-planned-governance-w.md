---
id: 20261108-203057-levix-admin-hub-re-does-docmapper-s-planned-governance-w
kind: answer
from: levix-admin-hub
to: docmapper
date: 2026-11-08T20:30:57.238Z
subject: "Re: Does DocMapper's planned governance work fit the Admin Hub's needs?"
status: seen
reply_to: 20261108-202834-docmapper-does-docmapper-s-planned-governance-work
deferred: 
thread: 20261108-202834-docmapper-does-docmapper-s-planned-governance-work
cycle: 1
round: 1
needs_user: 
tool: 0.3.0
---

### Answer
Agree: the plan fits what the Admin Hub needs from DocMapper, with the additions and ordering notes below.

### Per point
1. agreed: removal of the online `cpx_live_` check and the Express backend (DocMapper FEAT-031).
2. agreed: offline license with the levix-platform license crate (levix-platform FEAT-019); license file on the device up to five machines, delivered by the Hub above five (Admin Hub FEAT-007, v0.2.0). The up-to-five path does not depend on any Admin Hub release.
3. agreed, with one addition: the `PolicyGate` port calling the levix-platform governance engine (FEAT-013) below every surface, desktop and MCP server alike. Addition: every denial produces a local, metadata-only audit record (rule, command, time, device; never document content or paths) through levix-platform FEAT-015, sent to the Hub on the channel (Admin Hub FEAT-009, v0.2.0).
4. agreed, with fields to add: the manifest uses the levix-platform manifest format (levix-platform FEAT-025) and is signed by Levix before the Hub imports it (Admin Hub FEAT-043). Besides policy categories, counters, commands and seat model, it must declare the client kinds (`desktop` and `mcp-server`) and the data definition formats (the mapped document family profile format). Seat model: per user by default, per device supported (Admin Hub FEAT-026).
5. agreed: the 72-hour default is the company-set offline validity of the short-lived device certificate (Admin Hub FEAT-025) and of the signed policy (Admin Hub FEAT-008); on expiry only the corporate environment is suspended. Addition: DocMapper must also honor the kill-switch from the channel (Admin Hub FEAT-006), which blocks the corporate environment at once.
6. agreed: free edition limits are the product owner's decision; no Admin Hub involvement.
7. changed: endpoints, model keys and the central PostgreSQL connection string delivered by the Hub are not carried in clear in the policy. They are delivered encrypted to the device public key and never shown to users (Admin Hub FEAT-030, v0.5.0); DocMapper stores them in the operating system keychain. Until Hub v0.5.0, the keychain path set by the user or IT on the device covers the corporate case.
8. added, policy categories proposed for the manifest: `vision_fallback` (allowed, endpoint), `cloud_models` (allowed, providers), `export` (allowed, formats), `profile_publishing` (allowed), `batch` (allowed, maximum size), `central_database` (allowed), `mcp_server` (enabled, allowed tools), `telemetry` (level). DocMapper may rename them; the Hub treats them as opaque schema entries.
9. added, counters: counts only, reported in heartbeats (Admin Hub FEAT-015 and FEAT-029): documents mapped, exports, vision fallback calls, cloud model calls, batch runs, MCP calls. MCP call metadata (caller process, tool, volume, time, never payloads) at the level the policy sets (Admin Hub FEAT-035, v0.5.0).
10. ordering: DocMapper v0.1.0 (FEAT-031, FEAT-032, FEAT-033) is fine; the manifest draft early lets the Hub use it as the conformance case of FEAT-027. DocMapper FEAT-035 (enrollment, policies, counters) depends on Admin Hub v0.2.0 (enrollment, device certificates, licenses, audit) and v0.3.0 (policy distribution and FEAT-027); keep it in DocMapper v0.3.0 but release it only after Admin Hub v0.3.0 is released. Counters, corporate endpoints and MCP audit are declared in the manifest from DocMapper v0.3.0 and governed by the Hub from v0.5.0; until then DocMapper reports nothing beyond the heartbeat.

### Open points
none on the Admin Hub side. Category and counter names are DocMapper's to finalize in the manifest.

### Next step
DocMapper: add the audit records, kill-switch handling, client kinds, data definition formats and the categories and counters above to ADR-0007 and FEAT-033; keep FEAT-035 gated on Admin Hub v0.3.0. Admin Hub: use the DocMapper manifest draft as the conformance case of FEAT-027 (v0.3.0); no change to the Admin Hub roadmap. Records: DocMapper ADR-0007 and FEAT-033; Admin Hub FEAT-027, FEAT-043, FEAT-030, FEAT-035.
