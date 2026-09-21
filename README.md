# Haline

Ocean climate companion built for Shipaton 2026. The Day 1 foundation combines
NOAA monthly global ocean temperature anomalies with an educational calculation
of temperature-dependent CFC-11 and CFC-12 equilibrium solubility.

Related published research by Brandon W. Caris:
[The Coupled Marine Engine Framework, Papers 1–3](https://doi.org/10.5281/zenodo.20804280).
This Zenodo collection is a **preprint**.

## Where this is going

Haline adds one tested calculation or data source per release; see [docs/ROADMAP.md](docs/ROADMAP.md).

## Local checks

Use Node.js 22.13 or later (validated locally with Node.js 22.17.1):

```powershell
cd G:\haline
npm ci
npm test
npm run type-check
npm run build:backend
```

The repository currently contains the science/data core and a buildable Lambda.
The mobile UI and native project are the next phase. AsyncStorage is the mobile
cache dependency; device installation and native integration are still required
when creating that project. Unit tests mock storage and HTTP and send no pushes.

## Modules

| Module | Purpose |
| --- | --- |
| `lib/warnerWeiss.ts` | CFC Henry's-law coefficients, solubility and numerical derivative |
| `lib/cfcBias.ts` | Solubility-change proxy using a 15°C, salinity-35 reference |
| `lib/noaaData.ts` | Shared NOAA endpoint, metadata validation, parsing and date helpers |
| `lib/noaa.ts` | Mobile AsyncStorage cache, timeout, offline fallback and data status |
| `backend/lambda/weekly-notification.js` | Weekly notification using the same science and parser |

See [science and data provenance](docs/science-and-data.md) and
[Lambda build, configuration and scheduling](backend/README.md).

## Data for the UI

Use `fetchNOAASSTData()` to receive records, `source`, `isStale`, `fetchedAt`,
source metadata, and any `error` or `cacheWarning`. Show the latest record's month
and NOAA's **1901–2000** anomaly reference period. A fresh download can still
contain an older observation: the product updates monthly. Display stale cached
data as cached, and an empty result as unavailable. The compatibility method
`fetchNOAASSTAnomaly()` returns only the record array.

Successful data is cached for 24 hours; concurrent requests share one fetch.
Expired valid data remains available offline. Failed requests do not renew the
cache and can retry on a later call after connectivity returns. Storage failures
do not discard a successful response; an in-memory copy prevents repeated
downloads during that app session. The cache validates source identity, dates,
numbers and timestamps before use.

## What's next

| Track | Next step | Boundary |
| --- | --- | --- |
| App UI | Wire the dashboard, history chart and about screen to the tested NOAA/CFC modules. | Keep the output framed as a modeled thermal-solubility proxy. |
| iOS release | Keep iOS as the primary submission target and prepare tester/device validation. | Store submission and tester enrollment are not done in this repo state. |
| Notifications | Provision OneSignal/AWS and verify device delivery end to end. | Unit tests mock pushes; no live notification has been sent. |
| Science scope | Keep the 17-state chemistry engine and OH-enhancement proxy out of this calculation. | Do not fabricate methane-lifetime results. |
