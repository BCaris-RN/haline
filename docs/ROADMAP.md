<!--
.-~-.  HALINE  ·  lib/warnerWeiss.ts
Warner-Weiss K_H(T,S) solubility. See Caris (2026) § 2.3.
-->

# Haline Roadmap

Haline shows how ocean warming changes the sea's capacity to dissolve gases, computed from current NOAA monthly data using published solubility science.

This roadmap describes direction, not commitments. Order and content may change, and nothing here has a ship date.

The governing rule: **one new calculation or data source per release.** Every number in this app is a scientific claim. Bundling several at once means a single wrong coefficient discredits all of them. One at a time keeps each claim independently testable.

---

## v1.0 — Current

- Current NOAA global ocean sea surface temperature anomaly
- CFC-11 and CFC-12 solubility shift, computed with Warner-Weiss K_H(T,S)
- 2016–2025 monthly history chart
- Weekly notification when NOAA publishes new data
- Method, sources, and citation documented in-app

The headline figure is a **modeled thermal solubility proxy**. It is not a measurement of ocean gas uptake, and it is not a flux estimate. See [`docs/science-and-data.md`](./science-and-data.md) for the full method and its limits.

---

## The Accuracy Gate

Every release below passes all six steps before it ships. No exceptions, including for a coefficient swap that looks trivial.

1. **Published coefficients.** Taken from a table in a paper with a DOI, verified against the source document.
2. **Independent test values.** At least two expected values from the published table, never computed using this implementation. Self-derived reference values only prove the arithmetic repeats itself.
3. **Domain validation.** Inputs are checked against the fit's stated valid range. Out-of-range values are rejected loudly, never silently clamped.
4. **Cross-implementation check.** Agreement with an independent implementation to a documented tolerance.
5. **Documentation in the same commit.** Method docs and in-app method text update alongside the code, never afterward.
6. **Claim language review.** A proxy stays a proxy. No modeled quantity is described as a measurement in the interface, notifications, or store listing.

---

## v1.1 — Dissolved Oxygen Saturation

**New science:** Garcia & Gordon oxygen solubility

Oxygen uses the same Henry's law machinery already in the codebase, so this is new coefficients rather than new architecture. It is also the change that makes the app matter to more people, because reef tanks, dive sites, and fisheries all depend on it.

- O₂ saturation concentration as a function of temperature and salinity
- Percent shift reported on the same footing as the CFC metric
- Plain-language framing: warmer water holds less oxygen

**Known risks:** oxygen work is notorious for unit confusion between µmol/kg, mL/L, and mg/L. One convention will be chosen, encoded in types and names, and stated in the method docs.

---

## v1.2 — Custom Baseline and Date-Range Export

**New science:** none. This is a product release.

Today every figure is computed against a fixed 15°C, salinity 35 reference. Letting people choose their own baseline and export a slice of the series turns a number you read into a tool you use.

- User-selectable baseline temperature
- Date-range selection on CSV export
- Chosen baseline displayed alongside every figure, so results stay interpretable

**Known risks:** a user-chosen baseline outside the solubility fit's valid range must be refused rather than quietly corrected.

---

## v1.3 — CO₂ Solubility and Acidification Context

**New science:** Weiss (1974) CO₂ solubility in seawater

The most direct link between this app and the research behind it.

- CO₂ solubility shift alongside the existing gases
- Short explainer connecting solubility to ocean acidification
- Possible atmospheric CO₂ series for context

**Known risks:** CO₂ is not an inert tracer. Solubility alone does not describe carbonate chemistry, and the interface has to say so plainly rather than implying it does.

---

## v1.4 — Local Conditions

**New data source:** NDBC buoy observations

Moves the app from a global average to a specific place: your reef, your dive site, your stretch of coast.

- Station selection and nearest-station lookup
- Local water temperature feeding the existing calculations
- Station metadata, last-report time, and outage handling

**Known risks:** a new feed is more work than a new equation. Buoys go offline, drift out of calibration, and report bad values far more often than a curated monthly product does. Quality control comes before display.

---

## v1.5 — Nitrogen Saturation

**New science:** N₂ solubility

- N₂ saturation on the same footing as O₂
- Presets oriented toward aquarium and dive-site use

**Known risks:** anything adjacent to diving invites safety-critical misreading. Haline is not a dive planner and is not a substitute for dive tables, dive computers, or training. That limitation is part of the feature, not a footnote.

---

## Not Scheduled

Two features appeared in early planning for this project and are **not implemented**: a methane lifetime proxy, and a full climate accounting error matrix. Both depend on a coupled model that is not part of this codebase.

They are named here rather than quietly dropped, because a science app that advertises what it has not built is worse than one that ships less. They will not appear in the app, its listing, or its subscription until they exist and pass the accuracy gate above.

Also considered, not scheduled: coral bleaching alerts, tide and water level data, and regional rather than global mean temperature.

---

## Contributing

Corrections to the science are the most valuable contribution this project can receive. If a coefficient, a unit, a valid range, or a claim in the interface is wrong, please open an issue. Include the source you are checking against.
