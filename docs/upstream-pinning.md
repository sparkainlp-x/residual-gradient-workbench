# Residual contract pin

The residual lane follows the normative definition in [`sparkainlp-x/oes32-residual`](https://github.com/sparkainlp-x/oes32-residual) at commit [`b77b61254f15778c6ae221843dceac7a8571158e`](https://github.com/sparkainlp-x/oes32-residual/tree/b77b61254f15778c6ae221843dceac7a8571158e):

- `x` and `y` each contain exactly 32 finite real values.
- `r_i = abs(y_i - x_i)`.
- `R = max_i(r_i)`.
- The upstream tolerance comparison fails exactly when `R > tau`.

The repository's reference implementation at that pin is Python. This prototype uses an independently written JavaScript implementation of the pinned mathematical and validation contract so it can run entirely in a local browser without importing Python, loading remote code, or requiring dependencies. It is **not byte-identical to the upstream Python implementation**, and this prototype does not reproduce unrelated upstream behavior beyond that contract.

The capped replay step is a demonstrator-specific operation layered on top of the residual calculation: select the first maximum component, move only that observed component toward its reference by no more than the configured cap, preserve all other observed components, and recompute the residual. This step does not appear in or modify the upstream OES contract. `work_from_residual` is always `0`; a falling `R` is labeled a simulation, not energy production.
