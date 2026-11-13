---
id: 15
title: Installers built by the Tauri bundler and published in docmapper-releases
status: accepted
date: '2026-11-13'
version: v0.1.0
subsystems: [desktop]
supersedes: []
superseded_by: []
amends: []
amended_by: []
---

# ADR-0015: Installers built by the Tauri bundler and published in docmapper-releases

## Context

DocMapper has a CI workflow but no release workflow (FEAT-049), and the first v0.1.0 candidate needs one. The product owner decided on 2026-11-13 that every product publishes its releases in a dedicated public releases repository, so downloads stay public even if the source code is closed one day; for DocMapper it is `Levix-Digital/docmapper-releases`. The Levix Digital website reads that repository: it emails every release candidate (a pre-release tagged `vX.Y.Z-rc.N`, with its notes in the release body) to the people who signed up to test it, and it shows "Download vX.Y.Z" with one direct installer link per operating system from the latest release. The Dev Cycle's trunk model releases candidates `vX.Y.Z-rc.N` from `main` and promotes an accepted candidate with the promote workflow; Aurora already ships this way (Aurora ADR-0008), and AnyContext publishes in `any-context-releases`.

## Decision

- The Tauri bundler builds the installers from the `bundle` section of `crates/docmapper-desktop/tauri.conf.json`, with the Tauri CLI of the frontend lockfile: a Windows NSIS installer (per user), a macOS universal disk image (Apple silicon and Intel), and a Linux AppImage and `.deb` built on Ubuntu 22.04 so they run there. Packages take their version from the workspace `Cargo.toml` only; the tag is checked against it.
- `.github/workflows/release.yml` runs on `v*` tags and from the promote workflow, and as a dry run on pull requests that change the packaging and by hand. It tests and packages on the three platforms, and only after all of them succeed one job publishes the release with `SHA256SUMS.txt` through the GitHub CLI: candidates as pre-releases never marked latest, final versions marked latest. A dry run keeps the installers as run artifacts and publishes nothing.
- The release body is `docs/releases/<tag>.md`, read from `main` (or from the tagged commit); a release without notes is not published.
- The installer names are the same in every release: `docmapper-installer.exe` (Windows), `docmapper.dmg` (macOS), `docmapper-installer` (Linux AppImage), plus `docmapper.deb` and `SHA256SUMS.txt`.
- `.github/workflows/promote.yml` is the trunk release gate: in the `release` environment it tags the accepted candidate's commit `vX.Y.Z` and calls the release workflow.
- Releases go to the repository named by the `RELEASES_REPOSITORY` variable (`Levix-Digital/docmapper-releases`) with the `RELEASES_TOKEN` secret, and to the source repository when the variable is not set.

## Alternatives Considered

- **Tauri's default file names (with the version)**: no renaming step, but the site would need the version to build each link and every release would break links shared before.
- **Generated release notes**: no notes file to write, but they would be generated in the releases repository, which has no pull requests, and testers need what changed, what to try and the known issues.
- **A third-party release action**: a supply-chain dependency where the preinstalled GitHub CLI suffices; same choice as Aurora.
- **Publishing from each build job**: a failed platform would leave a half-published release.

## Consequences

- The site announces each candidate and updates its download links with no manual step on either side.
- The installers are not signed until FEAT-041: Windows SmartScreen and macOS Gatekeeper warn on first launch.
- The releases repository must exist with at least one commit, the `RELEASES_TOKEN` secret (contents write on it) and the `RELEASES_REPOSITORY` variable must be set, and the `release` environment should require the owner's approval.
- Every release candidate needs its notes in `docs/releases/` before the tag is pushed (`docs/releases/README.md`).
