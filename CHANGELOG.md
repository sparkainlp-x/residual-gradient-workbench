# Changelog

All notable changes to this project. Every thermoelectric parameter is SYNTHETIC; no hardware experiment has been performed.

## 0.1.0 (prepared, not released)

There is no tag, no GitHub release and no DOI yet. No release will be minted until the Zenodo webhook is enabled for this repository.

### Added

- **Lane 01, residual replay.** JavaScript reimplementation of the normative OES-32 residual contract pinned to [oes32-residual](https://github.com/sparkainlp-x/oes32-residual) at `b77b612` (`r_i = |y_i - x_i|`, `R = max r_i`, fail iff `R > τ`; exactly 32 finite values). One capped correction moves only the first worst component toward its reference; a falling `R` is labelled a simulation; `work from residual = 0` always. Default fixture: `R = 0.55`, cap `0.25`, `τ = 0.25`; after one step `R = 0.30`, so the observer latch stays held.
- **Lane 02, thermoelectric model.** Classical linear Thevenin TEG model (`V_oc = SΔT`, `I = V_oc/(R_int + R_load)`, `P = I²R_load`, matched-load maximum `V_oc²/(4R_int)`), with the Carnot fraction shown as a ceiling only and available work computed only from an explicitly entered measured heat input.
- 12 Node built-in tests and a deterministic sample report (`reports/sample-report.json`).
- GitHub Actions CI on Node 18, 20 and 22 (tests, byte-identical report regeneration, overclaim scan) and a GitHub Pages deployment of the static app.
- Repository files: AGPL-3.0-only `LICENSE`, `COMMERCIAL-LICENSE.md`, `CITATION.cff`, `.zenodo.json`, `SECURITY.md`, `CONTRIBUTING.md`, issue templates, `CODEOWNERS`.

### Changed from the shared prototype

- Package renamed from `residual-gradient-harvest` 1.0.0 to `residual-gradient-workbench` 0.1.0 with `license: AGPL-3.0-only`; the test script uses an explicit `test/*.test.mjs` path.
- README: portable run instructions; the named commercial module and shop link in the future measurement protocol were replaced with generic wording; badges, honesty summary, Pages link and related work added.
- Page: a persistent honesty banner, a link to the sample JSON report, and links to the repository and related work. The model and app logic are unchanged.
