# Science and data provenance

Verified September 15, 2026. This document records corrections to the supplied
Day 1 sample before implementation; it does not claim the sample tests passed
unchanged.

## Warner–Weiss solubility

Warner, M. J., and Weiss, R. F. (1985). *Solubilities of chlorofluorocarbons 11
and 12 in water and seawater*. Deep Sea Research Part A, 32(12), 1485–1497.
[DOI: 10.1016/0198-0149(85)90099-8](https://doi.org/10.1016/0198-0149(85)90099-8).
The CO2/JGOFS citation in the supplied prompt was incorrect.

The twelve coefficients match the **mol kg^-1 atm^-1** table published by the
[USGS Groundwater Dating Laboratory](https://water.usgs.gov/lab/chlorofluorocarbons/background/).
The Henry's-law convention is `K_H = C/p`; the separate mol/L coefficients must
not be substituted. Temperature is Kelvin and salinity is parts per thousand.
The [IAEA CFC guidebook](https://www-pub.iaea.org/MTCD/Publications/PDF/Pub1238_web.pdf),
pp.18–19, Eq.3.3/Table3.1, states the fit range: 0–40°C and salinity 0–40.
The implementation rejects values outside that range. Central derivatives also
require both offset temperatures to remain inside the fitted range.

At an assumed temperature of 288.15 K (15°C), salinity 35:

| Quantity | CFC-11 | CFC-12 |
| --- | ---: | ---: |
| Baseline K_H (mol kg^-1 atm^-1) | 0.011398160743979424 | 0.0030764838009911958 |
| K_H after +1.0228°C | 0.010844837144068125 | 0.002944551621978831 |
| Relative solubility reduction (%) | 4.854499005057178 | 4.2884080510958045 |

These are independent numerical regression references, not observed gas-exchange values.
The original 4.3% CFC-11 test expectation does not follow from its supplied
15°C baseline and +1.0228°C perturbation. The implementation retains the requested
coefficients and baseline and corrects the expected values.

## Relationship to the Caris preprint

[Zenodo DOI 10.5281/zenodo.20804280](https://doi.org/10.5281/zenodo.20804280)
identifies *The Coupled Marine Engine Framework: Dissecting Dynamic Ocean
Feedbacks in Top-Down Atmospheric Inversions (Trilogy Collection: Papers 1–3)*,
published June 22, 2026. It is a preprint collection; describe it as published
research by Brandon W. Caris without asserting peer review.

Paper 1, Section 2.3, pp.5–6, includes the same coefficients. Its illustrative
20→21°C calculation at salinity 35 yields about 4.33% and 3.82% solubility
reductions; tests independently reproduce that example. Section 3, p.7, reports
different August 2023 **dynamic gas-exchange-efficiency** reductions: 16.51% and 13.88%.
Those use paired modeled exchange terms, `100 * (1 - |F_forced| / |F_control|)`. They cannot be
validated by a ratio of equilibrium solubilities alone. Section 4.1 concerns
integrated atmospheric mass shifts; the supplied section title was incorrect.

The legacy public API name is retained for compatibility,
but documentation and notifications call its output a **modeled thermal
solubility proxy**. Fixed salinity does not simulate haline capping, gas transfer,
circulation, inventories or source-attribution terms. The arithmetic mean of the two species
is an unweighted display summary, not a combined gas-exchange term. Cooling gives negative
reduction (higher solubility); it is not clamped to zero.

The brief's future `([OH]_dynamic / [OH]_baseline - 1) * 100` reports percent OH
enhancement. The 17-state engine is not supplied or implemented in Day 1; this
number must not be presented as a computed methane lifetime here.

## NOAA contract

Verified source:
[NOAA Climate at a Glance monthly global ocean JSON](https://www.ncei.noaa.gov/access/monitoring/climate-at-a-glance/global/time-series/globe/ocean/1/0/1850-2026.json).
The endpoint uses `globe/ocean/1/0/1850-{current UTC year}.json`:
global ocean, individual monthly observations, all months. The supplied
`globe/land_ocean/p12m/data.json` URL returned HTTP 404.

The response has metadata plus an object keyed by `YYYYMM`:

```json
{
  "description": {
    "title": "Global Ocean Average Temperature Departures",
    "units": "Degrees Celsius",
    "base_period": "1901-2000"
  },
  "data": {
    "202308": { "departure": 1.02 },
    "202608": { "departure": 1.08 }
  }
}
```

The verified response contained 2,120 observations from January 1850 through August
2026. Unpublished months were omitted. Its August 2023 value was **1.02°C**, not
the preprint's higher-precision 1.0228°C input. Keep those separate in tests.
The parser validates the product title, degrees-Celsius units and **1901–2000**
reference period. NOAA's general product documentation may describe a different
reference period for its raw products; this specific feed's metadata governs.
No baseline conversion is inferred. Adding this global anomaly to an assumed
15°C reference is an educational sensitivity scenario, not reconstructed local SST.

The parser rejects malformed, empty and duplicate records. It rejects nonfinite,
nonnumeric and sentinel-like values; an absolute anomaly above 10°C is treated as
feed corruption and triggers fallback rather than extrapolation. This guard is
not a claimed climate projection bound. Records are ordered by observation month.
Changed product metadata fails visibly and cannot overwrite a valid cache.

## Setup corrections retained

- [Google Play](https://support.google.com/googleplay/android-developer/answer/14151465)
  requires at least 12 continuously opted-in closed testers for 14 days for the
  affected new personal developer accounts. Completing that period allows an
  application for production access, not automatic approval. Actual account
  eligibility and testing start dates have not been verified here.
- [OneSignal Automated Messages](https://documentation.onesignal.com/docs/en/automated-messages)
  is unavailable for apps created after December 11, 2024 and free apps. The
  backend uses the REST API and a documented AWS weekly schedule instead.
- The backend uses the shared exact solubility calculation, current API-key
  authentication and subscribed push audience. The sample's `3.8 * anomaly`,
  Base64 authentication and `all_users` external-user ID were replaced.
