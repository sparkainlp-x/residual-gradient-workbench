# Validation and measurement boundary

The prototype is a deterministic software model only. The Node test suite checks the residual equations and input geometry, that one replay step changes no component outside the selected worst index, that the cap bounds the correction, that `workFromResidual` stays zero, and that the default 0.55 spike remains above the 0.25 tolerance after one 0.25 step. It also checks Celsius-to-Kelvin conversion, no positive output for zero/reversed gradients, nonnegative loaded power and energy, the Thevenin equations, the matched-load maximum, Carnot bounds for `T_hot > T_cold > 0 K`, and conditional available-work accounting.

All default thermoelectric values are synthetic parameters. Nothing in the software verifies a physical module, reservoir, temperature, current, voltage, heat input, or energy balance. A future bench protocol is described in the README; no hardware experiment has been performed.

The two lanes are not coupled. There is no residual-derived energy term, free-energy gate, quantum/biological path, or claim that any energy is generated without an external source. The Carnot result is a ceiling on heat-to-work conversion, not actual TEG efficiency; the load-power maximum is only the maximum for the idealized electrical source model at `R_load = R_int`.
