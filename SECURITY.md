# Security Policy

Please report potential vulnerabilities privately to the repository owner rather than opening a public issue. Include a minimal reproduction, the affected commit, and the impact.

residual-gradient-workbench is a static browser prototype. It has no runtime dependencies, makes no network requests, uses no storage beyond the page's memory, and controls no hardware. The optional local server (`python3 -m http.server 8000 --bind 127.0.0.1`) is bound to loopback. The "Download JSON report" button creates a file locally; nothing is uploaded.

In scope: any change that introduces a network request, remote code, telemetry or storage of user input; lets the residual lane feed the thermoelectric lane (or the reverse); lets a residual change be counted as work or energy; lets the capped step modify any component other than the first worst one or exceed its cap; or produces a positive predicted output for a zero or reversed temperature gradient.
