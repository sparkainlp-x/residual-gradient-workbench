# Contributing to residual-gradient-workbench

Thank you for helping. Keep changes small, explicit and easy to review. Report security issues privately as described in [SECURITY.md](SECURITY.md), not as public issues.

## Ground rules

- **Synthetic parameters only.** Default thermoelectric values are illustrative, not measurements. Never present a model output as a hardware result. If you add measured data, state the instrument, calibration, uncertainty and procedure, and keep it separate from the synthetic defaults.
- **Two lanes, no bridge.** The residual replay and the thermoelectric (TEG) model share no state, inputs or energy accounting. `work from residual` is always `0`. Do not add any term that turns a residual change into work, power or energy.
- **Thermodynamics first.** Predicted electrical output requires an explicit external hot-to-cold gradient. The Carnot fraction is a ceiling on heat-to-work conversion, never the device's actual efficiency. Zero or reversed gradients give no positive output.
- **No overclaims.** This is an educational classical software model. Free energy is never claimed, and there are no claims about biological, physical or space systems beyond the stated textbook equations. `scripts/overclaim-scan.mjs` enforces this in CI.
- **Pin, don't copy.** The residual definition follows [oes32-residual](https://github.com/sparkainlp-x/oes32-residual) at `b77b612`. The JavaScript is a labelled reimplementation of that contract; keep it small and say so if it diverges.
- **No dependencies, no network.** The app must keep working from any static host or subpath using relative ES-module imports.
- **License.** AGPL-3.0-only (see [LICENSE](LICENSE) and [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md)). By contributing, you agree that your contribution is licensed under the same terms.

## Before you open a pull request

Run the checks CI runs (Node 18, 20 or 22; no `npm install` needed):

```sh
node --test test/*.test.mjs
node scripts/generate-sample-report.mjs && git diff --exit-code -- reports/sample-report.json
node scripts/overclaim-scan.mjs
```

If you change the model or the report generator, regenerate `reports/sample-report.json` and commit it. Update [`CHANGELOG.md`](CHANGELOG.md) for any user-visible change. Use conventional commit-style subjects where practical, such as `fix: reject reversed gradients in matched-load maximum`. Pull requests should state what changed, why, how it was tested, and what risks remain.
