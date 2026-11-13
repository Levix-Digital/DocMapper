# Release notes

One file per release, named after its tag: `vX.Y.Z-rc.N.md` for a release candidate, `vX.Y.Z.md` for a final release. The release workflow publishes the file as the body of the release in `Levix-Digital/docmapper-releases` (ADR-0015) and refuses to publish a release without it. It reads the file from `main`, so notes can be fixed after the tag is pushed and before the workflow runs again.

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

1. Add `docs/releases/vX.Y.Z-rc.N.md` on `main` with the workspace version `X.Y.Z` in `Cargo.toml`.
2. Tag the commit `vX.Y.Z-rc.N` and push the tag: the release workflow publishes the pre-release.
3. When a candidate is accepted, add `docs/releases/vX.Y.Z.md` on `main` and run the promote workflow with the candidate tag (`gh workflow run promote.yml -f candidate=vX.Y.Z-rc.N`): it tags the candidate's commit `vX.Y.Z` and publishes it as the latest release.
