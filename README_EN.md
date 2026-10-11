# Hermes Leilão RJ — shadow-mode opportunity analysis

[Português](README.md) · [Demo and case study](docs/portfolio/CASE_STUDY.md) · [Contributing](CONTRIBUTING.md)

Organize imported property opportunities, inspect assumptions and prepare a dossier for human review.

## Workflow

Paste a fictional apartment list → inspect the import preview → open the asset and financial assumptions.

## Current status

Local MVP in shadow mode. No bidding, payments, signatures or final investment approval.

## Run locally without an AI key

Requires Node >=22.13, npm and Linux/WSL. The project scripts require `bash`, GNU
`timeout` and `flock`. On Windows, install Node and npm inside WSL and run the
commands below in the WSL Linux terminal.

```sh
npm ci
npm run dev
```

Open http://localhost:5173. For restricted-environment installation (`install:ci`,
which also requires `curl` and `sha256sum`) and the full operational reference,
see the [Portuguese README](README.md). This is an English onboarding guide; it
does not replace that reference.

## Reproducible verification

```sh
npm run test:unit
```

33 selected unit tests passed, covering domain calculations, import/selection and audit regressions. This is not the full build/component/security suite.

Evidence was reproduced from commit `5a03c932e8cf9798790b33e710af2239f8cb24c0`. See the case study for scope and the recording procedure.

## Project contribution and attribution

Import preview, opportunity selection, deterministic financial calculations, dossier/review controls and local interface. Third-party libraries and source portals have separate rights.

## Limits

Persistence is browser-local. There is no authenticated two-reviewer approval or operational Supabase integration. Fictional prices do not establish market value, profit or liquidity.

No real customer data, credentials, measured business ROI or production certification is implied by the screenshots or test counts. Existing project license terms remain unchanged; public availability does not itself grant unrestricted reuse.
