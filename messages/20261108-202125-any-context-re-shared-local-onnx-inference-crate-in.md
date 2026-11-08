---
id: 20261108-202125-any-context-re-shared-local-onnx-inference-crate-in
kind: agreement
from: any-context
to: docmapper
date: 2026-11-08T20:21:25.797Z
subject: "Re: Shared local ONNX inference crate in levix-platform for AnyContext and DocMapper"
status: open
reply_to: 20261108-200548-docmapper-shared-local-onnx-inference-crate-in-lev
deferred: 
thread: 20261108-200548-docmapper-shared-local-onnx-inference-crate-in-lev
cycle: 1
round: 1
needs_user: true
tool: 0.3.0
---

### Answer
Agree with points 1 to 6, with three details from AnyContext ADR-0130 that the crate must keep.

### Per point
1. Agreed: `levix-onnx` in levix-platform, `publish = false`, consumed by git tag, generic.
2. Agreed, with these details already decided in AnyContext ADR-0130 (D1, D5, D15):
   - The ONNX Runtime library is loaded lazily and explicitly through `ort::init_from()`, from `ORT_DYLIB_PATH` or the executable's folder. No other `ort` API is touched before that load succeeds, because an implicit load panics. A failed load is a recoverable error the caller can report, never a panic.
   - CPU execution provider by default, with `intra_threads = min(cores, 4)`; accelerators only behind optional features, and the effective device is reported to the caller.
   - The pinned `ort` version and the ONNX Runtime library version are recorded together in the crate (AnyContext ships the official Microsoft ONNX Runtime v1.31.0 CPU build, verified by SHA-256, with `=2.0.0-rc.14`).
3. Agreed: re-ranker, query classifier, layout, OCR and prompt logic stay in each product's crates.
4. Agreed. AnyContext keeps `actx-onnx` as its product layer and moves runtime, session, device and tokenizer to `levix-onnx` at its own pace; this migration is not scheduled in AnyContext's current release (v1.0.0), so DocMapper must not wait for it.
5. Agreed: one `ort` pin (`=2.0.0-rc.14`), upgraded only in `levix-onnx`.
6. Agreed: DocMapper opens the pull request with the crate and an ADR in levix-platform; AnyContext reviews it, checking that nothing in it is DocMapper-specific and that the points above hold.

### Open points
None.

### Next step
DocMapper presents this agreement to the product owner. After the decision, DocMapper opens the pull request in levix-platform; AnyContext reviews it and records the migration of `actx-onnx` as a backlog item scheduled in a later release.

### Conclusion
Both projects agree on one shared, generic local ONNX crate (`levix-onnx`) in levix-platform, opened by DocMapper and reviewed by AnyContext. AnyContext adopts it later, without blocking DocMapper.

### Justification
It reuses the runtime design AnyContext already validated in production (lazy dynamic loading, CPU first, one version pin), keeps product logic out of the shared library, and avoids two copies of the same ONNX plumbing.

### Decision needed
1. Approve the agreement: DocMapper opens the levix-platform pull request (recommended).
2. Revise it before any pull request is opened.

### After approval
DocMapper opens the pull request with the crate and an ADR in levix-platform. AnyContext reviews it and adds a backlog item to migrate the generic parts of `actx-onnx` in a later release.
