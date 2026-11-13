# Release notes

One file per release, named after its tag: `vX.Y.Z.md` for a final release, and for release candidates either `vX.Y.Z-rc.md` (shared by every candidate of the version, updated as work lands) or `vX.Y.Z-rc.N.md` (one candidate only, takes precedence). The release workflow publishes the file as the body of the release in `Levix-Digital/docmapper-releases` (ADR-0015) and refuses to publish a release without it. It reads the file from `main`, so notes can be fixed after the tag is pushed and before the workflow runs again.

The Levix Digital website emails each release candidate to the people who signed up to test it and quotes the first 2000 characters of its notes, so put what testers need first. Plain Markdown, in English:

```markdown
## What changed
- ...

## What to try
- ...

## Known issues
- ...
```

Final release notes summarize the changes since the previous final release for people who download the product; they are not emailed.

## Releasing

1. Keep the version of the next release in `Cargo.toml` (`[workspace.package]`) and its candidate notes in `docs/releases/vX.Y.Z-rc.md` on `main`.
2. After every green CI run on `main`, the candidate workflow tags the head `vX.Y.Z-rc.N` (next N) and publishes the pre-release. It skips, with a note in its summary, when `vX.Y.Z` is already released, when the commit already has a candidate, or when there are no candidate notes, so merges before the notes exist cut no candidate. A candidate tag can still be pushed by hand.
3. When a candidate is accepted, add `docs/releases/vX.Y.Z.md` on `main` and run the promote workflow with the candidate tag (`gh workflow run promote.yml -f candidate=vX.Y.Z-rc.N`): it tags the candidate's commit `vX.Y.Z` and, after the approval of the `release` environment, publishes it as the latest release.
4. Bump the version in `Cargo.toml` for the next release; until then no new candidate is cut.

The website emails a version's first candidate only (once per product and version); later candidates of the same version are published but not emailed.
