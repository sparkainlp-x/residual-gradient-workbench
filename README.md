# Gradient / Residual Workbench

[![CI](https://github.com/sparkainlp-x/residual-gradient-workbench/actions/workflows/ci.yml/badge.svg)](https://github.com/sparkainlp-x/residual-gradient-workbench/actions/workflows/ci.yml)
[![License: AGPL-3.0-only](https://img.shields.io/badge/License-AGPL--3.0--only-blue.svg)](LICENSE)
[![Pages](https://github.com/sparkainlp-x/residual-gradient-workbench/actions/workflows/pages.yml/badge.svg)](https://sparkainlp-x.github.io/residual-gradient-workbench/)
[![Evidence: SYNTHETIC](https://img.shields.io/badge/evidence-SYNTHETIC-blue.svg)](#honesty-labels)
[![DOI: pending](https://img.shields.io/badge/DOI-pending%20(no%20release%20yet)-lightgrey.svg)](#cite)

A self-contained browser prototype with two **strictly independent** lanes: a deterministic 32-component residual replay and a classical thermoelectric generator (TEG) model driven by explicit hot/cold reservoir temperatures. It demonstrates a category boundary, not a new source of energy: **residual change is never treated as work; predicted electrical output requires an external thermal gradient.**

**Live demo:** <https://sparkainlp-x.github.io/residual-gradient-workbench/> (static page; runs entirely in your browser, no network requests after load). Sample run record: [`reports/sample-report.json`](https://sparkainlp-x.github.io/residual-gradient-workbench/reports/sample-report.json).

## Honesty labels

- **Synthetic parameters.** Every default thermoelectric value is illustrative, not a measurement.
- **No hardware experiment performed.** TEG numbers are model predictions, not measured results.
- **Residual contributes zero work.** A falling `R` is a computational change, labelled *simulation*; `work from residual = 0` always.
- **No free-energy claim.** Predicted output exists only for an explicit external hot-to-cold gradient; zero or reversed gradients give no positive output.
- **Carnot is a ceiling only.** `1 − T_cold/T_hot` bounds heat-to-work conversion; it is not the TEG's efficiency.
- The two lanes share no state, inputs or energy accounting.

## Run locally

Requirements: Node.js 18+ for tests and report generation, and Python 3 (or any static file server) to serve the page. The browser app has no runtime dependencies and makes no network requests. From a clone:

```sh
git clone https://github.com/sparkainlp-x/residual-gradient-workbench.git
cd residual-gradient-workbench
node --test test/*.test.mjs
node scripts/generate-sample-report.mjs
python3 -m http.server 8000 --bind 127.0.0.1
```

Then open `http://127.0.0.1:8000/` in a browser on the same computer. Stop the server with `Ctrl+C`. `npm test`, `npm run report` and `npm run serve` run the same commands (no `npm install` needed). The server is bound to loopback; keep that binding if you want the prototype local-only. The page uses ES modules, so open it through a server rather than as a `file://` URL.

## Lane 01 — residual replay

The residual definition is pinned to [`sparkainlp-x/oes32-residual`](https://github.com/sparkainlp-x/oes32-residual) at commit [`b77b61254f15778c6ae221843dceac7a8571158e`](https://github.com/sparkainlp-x/oes32-residual/tree/b77b61254f15778c6ae221843dceac7a8571158e):

- `r_i = abs(y_i - x_i)`
- `R = max_i(r_i)`
- The upstream tolerance criterion fails exactly when `R > τ`.

The upstream reference implementation is Python. This browser app is a transparent JavaScript reimplementation of the pinned mathematical and input-validation contract; it is **not byte-identical to the upstream Python code**. The bounded correction step is a demonstrator-only addition: it selects the first worst component, moves only that observed component toward its reference by at most the cap, preserves all other components, then computes `R` again. Each step is appended to the observer log. A fall in `R` is labeled a **simulation**. `work from residual = 0` at all times.

The default fixture has `R = 0.55`, cap `0.25`, and tolerance `τ = 0.25`. One step changes the spike from `0.55` to `0.30`; therefore it cannot close the spike in one step and the observer latch remains held because `0.30 > 0.25`. The latch is only this residual/tolerance comparison. It is not an energy gate.

## Lane 02 — classical TEG model

For explicit reservoir inputs in °C (converted to K):

- `V_oc = S × (T_hot − T_cold)`
- `I = V_oc / (R_int + R_load)`
- `V_load = I × R_load`
- `P_elec = I² × R_load`
- `E_elec = P_elec × time`
- The maximum load power in this idealized Thevenin model occurs at `R_load = R_int`, with `P_max = V_oc² / (4 R_int)`.

A zero or reversed temperature gradient produces no positive predicted output. The Carnot value `1 − T_cold/T_hot` is shown only as a maximum fraction of heat convertible to work between the reservoirs; it is **not** the TEG's actual efficiency. The model calculates `Q_hot × (1 − T_cold/T_hot)` in joules only when a measured `Q_hot` value is explicitly entered and there is a positive hot-to-cold gradient. If heat input is blank, available-work energy in joules is reported as unknown.

Default parameters are illustrative synthetic values, not measurements: `T_hot=80 °C`, `T_cold=25 °C`, `S=0.025 V/K`, `R_int=4 Ω`, `R_load=4 Ω`, and `60 s`. No physical experiment was run. TEG predictions do not feed into residual scoring, and residual values do not feed into TEG output.

## Tests and sample report

Run `node --test test/*.test.mjs` for the 12 unit tests covering the vector contract, capped-step invariants, the 0.55/0.25 latch case, Celsius-to-Kelvin conversion, zero/reversed gradients, loaded power/energy equations, matched-load behavior, Carnot bounds, and conditional heat-input accounting. The deterministic sample report is [`reports/sample-report.json`](reports/sample-report.json); regenerate it with `node scripts/generate-sample-report.mjs`. The browser's “Download JSON report” button exports the current local run without uploading it.

## Future physical measurement protocol (not performed)

For a real comparison, use one identified TEG module, for example a commercially available thermoelectric module with a published rating (record the exact manufacturer, model and revision, and confirm the rating before testing). Couple its hot and cold faces to separate controlled reservoirs; measure both faces with calibrated thermocouples; connect a known load and measure voltage and current with a calibrated meter or power analyzer across that load; record the complete run duration; and measure heat flow into the hot side with a calibrated heat-flow sensor or a validated calorimetric method. Record uncertainties and ambient losses, and close the energy balance by comparing measured heat input, electrical output, and rejected heat. Do not infer heat input from temperature difference alone. This software has not run that experiment and its synthetic outputs are not measured hardware results.

## Files

- `index.html`, `styles.css`, `src/` — interactive app and model source (relative ES-module imports; works from any static host or subpath).
- `test/` — Node built-in test suite.
- `scripts/` — deterministic sample-report generator and the overclaim scan used in CI.
- `reports/sample-report.json` — sample synthetic run record.
- `docs/upstream-pinning.md` — exact upstream contract pin and implementation boundary.
- `docs/validation.md` — what the tests check and the measurement boundary.

## Related work

- [oes32-residual](https://github.com/sparkainlp-x/oes32-residual) — the normative OES-32 residual contract this workbench reimplements (pinned at `b77b612`); concept DOI [10.5281/zenodo.22985520](https://doi.org/10.5281/zenodo.22985520).
- [spark-membrane](https://github.com/sparkainlp-x/spark-membrane) — a fail-closed console that audits synthetic 32-channel frames against pinned OES repositories, including the same residual; concept DOI [10.5281/zenodo.23175490](https://doi.org/10.5281/zenodo.23175490).

## Cite

There is no release and no DOI yet. Version 0.1.0 is prepared in [CHANGELOG.md](CHANGELOG.md), [CITATION.cff](CITATION.cff) and [.zenodo.json](.zenodo.json). Until a release exists, cite the repository and the commit you used:

> Brisson, J.-F. (2026). *residual-gradient-workbench: a browser workbench separating an OES-32 residual replay from a classical thermoelectric generator model* (SYNTHETIC research prototype, version 0.1.0, unreleased) [Computer software]. Spark AI NLP. https://github.com/sparkainlp-x/residual-gradient-workbench

## Contributing, security, license

- Contributions: [CONTRIBUTING.md](CONTRIBUTING.md). Security reports: [SECURITY.md](SECURITY.md).
- License: AGPL-3.0-only ([LICENSE](LICENSE)). Commercial licensing: [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md).
