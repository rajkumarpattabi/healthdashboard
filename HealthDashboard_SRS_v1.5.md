# Health Report Dashboard — Software Requirements Specification (SRS)

**Project:** HealthDashboard (mobile web app / installable PWA)
**Version:** 1.5 — BUILD-READY (adds individual-report view via a dashboard report picker)
**Date:** 09-Aug-2026
**Prepared for:** Rajkumar Pattabi
**Architecture model:** same as `github.com/rajkumarpattabi/mealfast` — static PWA on GitHub Pages, localStorage-primary, **+ client-side Google Drive sync (no backend)**
**Status:** Ready to build on your go. Mockup v4 (matching this spec, incl. report picker, sparse series, and single-report Vitamins) delivered alongside.
**Drive backup folder (registered):** `HealthDashboard` — folder ID `1622qdkY3HlwzHSeX7Z3TUI5bjjvUlcKr` (https://drive.google.com/drive/folders/1622qdkY3HlwzHSeX7Z3TUI5bjjvUlcKr). Targeted via one-time folder-picker grant under `drive.file` (see FR-I / P1).

---

## 0. How to read and validate this document

Every functional requirement (FR) has a unique **ID**, a **priority** (Must/Should/Could), a **requirement statement**, and **acceptance criteria (AC)** written as objective, testable checks. A requirement is "met" only when *all* its ACs pass. §11 is the sign-off checklist.

**What changed across versions (your answers):**
- **Q1 →** Key parameters = the proposed default 10 (locked, §7).
- **Q2/Q3 →** Architecture = mealfast model: static GitHub Pages PWA, `localStorage`-primary, **no backend server** — **plus** a real Google Drive backup done entirely client-side via Google OAuth (§4A, FR-I).
- **Q4 →** Single **age/sex-appropriate** thresholds (no multi-bucket), sourced from ADA / ACC-AHA / clinical references, given as two concrete tables in §7.
- **Q5 →** App flags against the agreed threshold table **and** still displays each report's own printed range.
- **v1.2 — Drive sync (your request):** localStorage stays the primary store; Google Drive is a backup that **auto-syncs on app open if ≥24h since last sync**, with a manual **Sync now** button. No backend (§4A, FR-I). Honest limit: no reliable sync while the app is fully closed.
- **v1.2 — Upload flow (D1 resolved):** "upload a report" = **browse a PDF from the phone and upload**; the app parses it client-side (pdf.js) and stores the values. A quick confirm screen guards against a mis-read (FR-H).
- **v1.3 — after mockup review (3 changes):**
  1. **Deep-link from dashboard to trend** — tapping a dashboard parameter that has a trend jumps straight to that parameter's trend chart (FR-E/AC-E5, FR-F).
  2. **Persistent navigation** — the bottom tab bar is always visible during scroll, never pushed to the end of the page (FR-J, NFR-Mobile).
  3. **Dedicated Sync tab** — Google Drive connect / backup / restore / sync-status move into their own bottom-nav tab, so navigation is Dashboard · Trends · Actions · Sync (FR-J, FR-I).
- **v1.4 — missing / intermittent parameters (your question):** reports come from different labs and different panels, so a parameter may be absent from some reports. The system handles this honestly rather than inventing data — real date axis, no interpolation, dashed "bridge" across gaps, "last measured" badge, and inferences computed only from actual readings (FR-F/FR-E, §6A).
- **v1.5 — individual-report view (your request):** the dashboard gets a **report picker** where the lab name used to sit. It defaults to "Combined (latest)"; choosing a specific report switches the dashboard to that report's snapshot, showing **every parameter recorded in that report** — including ones with no trend — with that report's own values and reference ranges (FR-E/AC-E8–E9).

---

## 1. The one-line product requirement (north star)

> **PR-1.** The system shall let a household member, from a phone browser, turn a folder of PDF lab reports from *different* labs into one clean per-person history, viewable as (a) a section-wise dashboard, (b) trend charts for the 10 key parameters against age/sex target thresholds with plain-language inferences, and (c) recommended actions for out-of-threshold parameters — with the ability to upload a new report and have all three update, all running as a static installable web app with no server.

**Definition of Done (measurable):** on a phone, within **≤ 5 s** of open the user can (1) switch between Rajkumar and Baskari, (2) see every parameter grouped into clinical sections, (3) see a dated trend with threshold band for each of the 10 key parameters, and (4) upload one new PDF and see that person's data, dashboard and trends reflect the new date with **no manual data entry** and **≥ 95%** numeric fidelity on spot-check.

---

## 2. Scope

**In scope:** two auto-discovered profiles (Rajkumar, Baskari); ingestion of tabular pathology PDFs; parameter standardization; one unified dataset per person; a mobile-first installable PWA with person toggle, a persistent four-tab layout (**Dashboard · Trends · Actions · Sync**), section dashboard with tap-through to trends, trend charts + inferences, recommended actions, new-report upload, and Google Drive backup/restore.

**Out of scope (v1):** see §10. Notably the **ECHO CARDIOGRAM** (non-tabular), imaging, diagnosis/treatment, multi-account login, and live server/DB.

---

## 3. Definitions

| Term | Meaning |
|---|---|
| Report | One PDF lab report, one person, one collection date. |
| Parameter | One measured test (e.g. HbA1c). |
| Canonical name/unit | The single standardized name/unit the app uses regardless of lab wording. |
| Synonym | A lab-specific label mapped to a canonical name. |
| Reference interval | The lab's printed normal range (varies by lab/age/sex). |
| Threshold / target | The single agreed value(s) the app uses to flag + draw the trend band (§7). |
| Key parameter | One of the 10 parameters that get trend + inference + recommendation. |
| Data source | The per-person data files bundled in the repo/app (§4A). |

---

## 4. Assumptions & constraints

- **A1.** Reports are text-based PDFs (selectable text). Scanned/image-only → OCR needed (risk R1).
- **A2.** Each report states the person's name and a collection/report date.
- **A3.** The app reads from the prepared per-person dataset, not from PDFs at view time.
- **A4.** Family/self-tracking tool, **not** a regulated medical device; every screen carries a non-diagnostic disclaimer.
- **A5.** Thresholds come from the agreed tables in §7 (reproducible), not invented per run.
- **C1.** Mobile-first, installable via "Add to Home Screen"; works offline after first load (service worker), like mealfast.
- **C2.** Personal health data → privacy handled by keeping data on-device / in a private repo (§4A, NFR-Sec).

## 4A. Architecture — mealfast model + client-side Drive sync (Q2/Q3 locked)

mealfast is a **static PWA**: `index.html + app.js + style.css + manifest.json + sw.js`, hosted on GitHub Pages, all data in the browser's `localStorage`, no backend. HealthDashboard keeps that model and adds a **backend-free Google Drive backup**:

- **Primary store = `localStorage` (on-device), exactly like mealfast.** The app is fully usable offline with no Google login.
- **Seed data (read):** each person's history ships as a data file bundled in the repo (`data/rajkumar.json` + `data/baskari.json`, generated from the CSVs, §5.3). On first open these seed `localStorage`; thereafter `localStorage` is authoritative and uploads overlay it.
- **Upload (write):** a new report is **browsed and uploaded from the phone**, parsed **in the browser** (pdf.js) against the mapping dictionary, shown on a quick confirm screen, then merged into `localStorage`. No server (FR-H).
- **Google Drive backup — done client-side, no backend (this resolves the earlier Q3 tension):** a static app *can* read/write Drive using **Google Identity Services (GIS) OAuth** + the Drive REST API with the narrow **`drive.file`** scope, meaning the app can only see/touch the files **it** creates — never the rest of your Drive. Backups are stored in **your existing folder** `HealthDashboard` (ID `1622qdkY3HlwzHSeX7Z3TUI5bjjvUlcKr`), holding each person's CSV/JSON. Because that folder was created by you (not the app), the app gains write access to it via a **one-time Google folder-picker selection** on first connect — this grants `drive.file` access to just that folder, nothing else. Sync = push `localStorage` → Drive; restore = pull Drive → `localStorage` on a new device. The OAuth login must use the Google account that owns/has access to that folder. Details + ACs in **FR-I**.
- **Sync cadence:** **auto-sync on app open if ≥ 24 h since last successful sync**, plus a manual **Sync now** button. *Honest limitation:* a web app cannot reliably sync while fully closed (same class of limit mealfast documents for background notifications); "every 24h" therefore means "on the next open after 24h." True closed-app background sync would need a backend or native app — out of scope for the mealfast model.
- **Profiles are data-driven:** add a `data/<name>.json` (or a new CSV in the Drive folder that gets pulled) and a new toggle appears with no code change (FR-D).

**Build prerequisite (P1):** a free Google Cloud project with **Drive API + Picker API enabled**, an OAuth **Client ID** and a browser **API key** (created once, ~5–10 min), with the GitHub Pages URL added as an authorized JavaScript origin. The Client ID + API key go into the app config; the registered folder ID above is preset. I'll provide step-by-step instructions. Until configured, the app works fully with localStorage — only Drive sync is inert.

**Upload parsing (D1 — resolved):** in-app, client-side pdf.js parsing with a quick confirm-before-save screen. No offline script.

---

## 5. Data model

### 5.1 Canonical parameter dictionary (representative extract; full list built in CSV phase)

| Canonical name | Section | Canonical unit | Synonyms seen across your labs |
|---|---|---|---|
| Hemoglobin | Haematology | g/dL | "Haemoglobin (HB)", "Haemoglobin", "Hemoglobin" |
| RBC Count | Haematology | 10^6/µL | "RBC (Red Blood Cell Count)", "RBC Count" (Million/cmm ↔ 10^12/L) |
| WBC Count (Total) | Haematology | 10^3/µL | "Total WBC Count", "WBC count, Total" |
| Platelet Count | Haematology | 10^3/µL | "Platelet Count" (Lakhs/cumm ↔ 10^9/L) |
| HbA1c | Diabetic | % | "HbA1c", "Glycosylated Hb (HbA1C)", "Glycosylated Hemoglobin(GHb/HbA1c)" |
| Fasting Glucose | Diabetic | mg/dL | "GLUCOSE FASTING (FBS)", "Glucose-Blood-Fasting" |
| Creatinine | Renal | mg/dL | "CREATININE", "*Creatinine" |
| Urea | Renal | mg/dL | "UREA", "*Urea" |
| Uric Acid | Renal | mg/dL | "URIC ACID", "Uric Acid" |
| Total Cholesterol | Lipid | mg/dL | "Total Cholesterol" |
| HDL Cholesterol | Lipid | mg/dL | "HDL Cholesterol" |
| LDL Cholesterol | Lipid | mg/dL | "LDL Cholesterol" |
| Triglycerides | Lipid | mg/dL | "Triglycerides" |
| TSH | Thyroid | µIU/mL | "Thyroid Stimulating Hormone (TSH)" |

### 5.2 Profiles (fixed at build time; extendable by data)
| Person | Age | Sex | Applies threshold column |
|---|---|---|---|
| Rajkumar | 43 | Male | Male-adult (§7) |
| Baskari | 39 | Female | Female-adult (§7) |

### 5.3 Unified per-person CSV schema (long format — one row per parameter per date)
```
person, test_date, section, parameter_canonical, value, unit_canonical,
value_raw, unit_raw, ref_low, ref_high, ref_text, status, lab_name,
source_file, parameter_raw
```
`status` ∈ {Normal, Low, High, Borderline, Unknown}, computed from the §7 threshold. `*_raw` fields preserve the original for audit/traceability.

---

## 6. Functional requirements — data pipeline (points 1–3)

### FR-A — Report identification & person assignment *(Must)*
- **AC-A1.** All **5 Rajkumar** + **6 Baskari** files listed with person + parsed `test_date`.
- **AC-A2.** The **ECHO CARDIOGRAM** is detected and excluded from parameter extraction, with a logged reason.
- **AC-A3.** Any report whose person/date can't be determined goes to a "needs review" list, never silently dropped.

### FR-B — Parameter standardization *(Must)*
- **AC-B1.** The three spellings of Haemoglobin, the three HbA1c synonyms, and the two Fasting-Glucose synonyms each resolve to one canonical name.
- **AC-B2.** Unit conversions applied + documented (platelet Lakhs/cumm ↔ 10^9/L, RBC Million/cmm ↔ 10^12/L) with a correct spot-checked numeric conversion.
- **AC-B3.** A human-reviewable raw→canonical mapping table is emitted; **zero** parameters silently discarded; unmapped labels appear in an "unmapped" list.

### FR-C — Unified per-person dataset *(Must)*
- **AC-C1.** `rajkumar.csv` + `baskari.csv` produced (schema §5.3), opening cleanly in Excel/Sheets; matching `data/*.json` generated for the app.
- **AC-C2.** For a random (parameter, date), CSV `value`/`unit_raw` exactly match the PDF; ≥ 95% on a 20-cell spot-check per person.
- **AC-C3.** Same canonical parameter across dates = multiple rows with distinct `test_date` (enables trends).
- **AC-C4.** Every row carries `source_file` for traceability.

---

## 7. Threshold tables (Q4 locked — single age/sex value, with sources)

The app flags each key parameter and draws each trend band against **one** agreed threshold chosen for the person's age/sex (no multi-bucket). Where a target is not sex-specific (glucose, HbA1c, cholesterol, LDL, triglycerides) both people use the same value; where it is sex-specific (HDL, hemoglobin, creatinine, uric acid) the values differ. These match the printed ranges on your own reports as a cross-check.

### 7.1 Rajkumar — Male, 43
| Key parameter | Target / normal | Flag when | Source |
|---|---|---|---|
| HbA1c | < 5.7 % | ≥ 5.7 (pre-diabetic), ≥ 6.5 (diabetic) | ADA |
| Fasting Glucose | 70–99 mg/dL | ≥ 100 | ADA |
| Total Cholesterol | < 200 mg/dL | ≥ 200 | ACC/AHA, Cleveland Clinic |
| LDL Cholesterol | < 100 mg/dL | ≥ 100 | ACC/AHA |
| HDL Cholesterol | ≥ 40 mg/dL (↑ better) | < 40 | ACC/AHA (male) |
| Triglycerides | < 150 mg/dL | ≥ 150 | ACC/AHA |
| Creatinine | 0.7–1.3 mg/dL | outside range | Clinical lab ref (male) |
| Uric Acid | 3.5–7.2 mg/dL | outside range | Clinical lab ref (male) |
| Hemoglobin | 13–17 g/dL | < 13 (anemia) / > 17 | WHO / clinical (male) |
| TSH | 0.4–4.2 mIU/L | outside range | Clinical lab ref |

### 7.2 Baskari — Female, 39
| Key parameter | Target / normal | Flag when | Source |
|---|---|---|---|
| HbA1c | < 5.7 % | ≥ 5.7 / ≥ 6.5 | ADA |
| Fasting Glucose | 70–99 mg/dL | ≥ 100 | ADA |
| Total Cholesterol | < 200 mg/dL | ≥ 200 | ACC/AHA, Cleveland Clinic |
| LDL Cholesterol | < 100 mg/dL | ≥ 100 | ACC/AHA |
| HDL Cholesterol | ≥ 50 mg/dL (↑ better) | < 50 | ACC/AHA (female) |
| Triglycerides | < 150 mg/dL | ≥ 150 | ACC/AHA |
| Creatinine | 0.6–1.1 mg/dL | outside range | Clinical lab ref (female) |
| Uric Acid | 2.6–6.0 mg/dL | outside range | Clinical lab ref (female) |
| Hemoglobin | 12–15 g/dL | < 12 (anemia) / > 15 | WHO / clinical (female) |
| TSH | 0.4–4.2 mIU/L | outside range | Clinical lab ref |

*Note (2026 guideline):* the March-2026 ACC/AHA dyslipidemia guideline leans toward risk-based / non-HDL / ApoB emphasis rather than only fixed LDL targets; for a personal tracker these fixed desirable cut-points remain the clearest "target line," and the app also shows each report's own printed range (Q5). Sources listed in §12.

---

## 8. Functional requirements — the app (points 4–5)

### FR-D — Data source & person toggle *(Must)*
- **AC-D1.** With 2 bundled profiles, exactly 2 labelled toggles appear at the top.
- **AC-D2.** Adding a 3rd `data/<name>.json` adds a 3rd toggle with no code change.
- **AC-D3.** Switching re-renders dashboard + trends in ≤ 2 s and never mixes two people's data.

### FR-E — Section-wise dashboard *(Must)*
- **AC-E1.** Parameters grouped under `section` (Haematology, Diabetic, Renal, Lipid, Thyroid…), each a labelled block.
- **AC-E2.** Each shows latest value, unit, the §7 threshold **and** the report's own printed range (Q5), plus a status indicator matching computed `status`.
- **AC-E3.** Latest value shown = the **latest *measured* value for that parameter** (its most recent non-empty `test_date`), which may not be the newest report's date. Status is computed on this value.
- **AC-E4.** Date/section filter changes only the displayed set, correctly.
- **AC-E7 (stale badge).** If a parameter's latest measurement is older than the person's newest report (i.e. the newest report didn't include it), the row shows a "last measured &lt;date&gt;" badge so a stale value is never mistaken for current. A never-measured parameter is not shown for that person.
- **AC-E8 (report picker).** The dashboard has a report selector positioned where the lab name sits, listing "Combined (latest)" (default) plus each individual report as "&lt;date&gt; · &lt;lab&gt;", newest first. It is populated from the person's reports and updates when the person changes.
- **AC-E9 (individual-report snapshot).** Selecting a specific report switches the dashboard to that report's snapshot: it shows **every parameter recorded in that report**, grouped by section — *including parameters that have no trend* — each with the value **as recorded in that report**, its unit, that report's own reference range, and computed status. Parameters not present in the selected report are omitted; a parameter that has a trend remains tappable to its trend chart (AC-E5), while parameters without a trend are shown with a clear "no trend" affordance and are non-tappable. Returning to "Combined (latest)" restores the merged view.
- **AC-E5 (deep-link to trend).** Tapping a dashboard parameter that **has a trend** (any key parameter, or any parameter with ≥ 2 dates) switches to the Trends tab and scrolls that parameter's chart into view with a brief highlight. A tappable parameter shows an affordance (e.g. chevron/ripple). Tapping a parameter with **no** trend (single data point / non-key) either does nothing or shows a small "no trend yet" hint — it never navigates to an empty chart.
- **AC-E6.** Returning from a deep-linked trend (Dashboard tab) restores the previous dashboard scroll position.

### FR-F — Trend charts with thresholds & inferences *(Must)*
- **AC-F1.** Thresholds are exactly the §7 tables (per person's age/sex).
- **AC-F2.** Each key parameter with ≥ 2 dates → line chart of value vs `test_date` (chronological) with the §7 threshold as a reference line/band.
- **AC-F3.** Each chart shows an inference stating direction (rising/falling/stable) + position vs threshold; direction matches the actual first→last movement.
- **AC-F4.** Single-data-point parameters show a point + "need more data for trend," not a misleading line.

**Missing / intermittent measurements (a parameter absent from some reports) — FR-F continued:**
- **AC-F5 (real date axis).** Points are positioned by actual `test_date`; horizontal spacing reflects true elapsed time, not report sequence.
- **AC-F6 (no fabricated data).** Only actually-measured values are plotted. The system never interpolates or invents a value, and never treats "not measured" as zero; a missing measurement is simply an absent point (no CSV row).
- **AC-F7 (dashed bridge).** Consecutive measured points are connected; a connecting segment that spans one or more reports where the parameter was *not* measured is rendered **dashed/faded** to signal the gap, while adjacent-report segments are solid.
- **AC-F8 (measured-only inference).** The inference uses only measured readings: it reports the count of actual readings and the first/last measured values with their real dates (e.g. "across 3 readings; 2 reports didn't include it"), never a fixed report count.
- **AC-F9 (empty range).** If a date-range filter leaves a parameter with no readings in the window, the chart shows an explicit "no readings in this range" state rather than a blank or misleading plot.

### FR-G — Recommended actions *(Should)*
- **AC-G1.** Every latest-date parameter flagged (High/Low/Borderline per §7) shows ≥ 1 recommendation.
- **AC-G2.** Recommendations come from a documented, reviewable rules table (parameter + direction → non-diagnostic action), reproducible each load.
- **AC-G3.** Each recommendation carries a "consult your doctor" disclaimer; in-threshold parameters show no alarming recommendation.

### FR-J — Navigation & persistent tab bar *(Must)*
The app has a bottom tab bar with four tabs: **Dashboard · Trends · Actions · Sync**.
- **AC-J1 (always visible).** The bottom tab bar stays fixed and fully visible at all times while the content area scrolls beneath it; it is never pushed to the end of a long page. The person toggle / header likewise stays reachable (sticky header).
- **AC-J2 (four tabs).** Exactly four tabs are present and switch the main view; the active tab is visually indicated.
- **AC-J3 (Actions badge).** The Actions tab shows a count badge equal to the number of currently flagged key parameters for the selected person; it hides when zero.
- **AC-J4 (state on switch).** Switching person keeps the current tab; switching tab resets that view's scroll to top (except the deep-link case, AC-E5).
- **AC-J5 (safe-area).** On phones with a home indicator, the tab bar respects the safe-area inset (no clipped labels).

---

## 9. Functional requirements — upload new report (point 6)

### FR-H — Browse, upload & incremental update *(Must)*
- **AC-H0.** The app has an **Upload** action that opens the phone's file picker; the user browses and selects a PDF and it uploads — no other manual steps (D1).
- **AC-H1.** Uploading for a person updates only that person's data (person inferred from the PDF, confirmed on the confirm screen); the other person's data is unchanged.
- **AC-H2.** New rows carry the new `test_date`; existing dates not overwritten; re-uploading the same report creates no duplicate rows (idempotent).
- **AC-H3.** A parameter not seen before is added and appears in its section — no break for other rows.
- **AC-H4.** After upload, that person's date filters include the new date with no manual redeploy.
- **AC-H5.** After upload, each affected key-parameter trend shows the new point and its inference is recomputed.
- **AC-H6.** A quick **confirm-before-save** screen shows the parsed person/date/values; the user can correct a mis-read before it is stored. An unreadable/irrelevant PDF produces a clear error and changes nothing (no partial corruption).
- **AC-H7.** On save, data is written to `localStorage` immediately; the Drive backup reflects it on the next sync (manual or the ≥24h auto-sync) per FR-I.

## 9A. Functional requirements — Sync tab: Google Drive backup & restore (point 4 backup)

All Drive functions live in a dedicated **Sync** tab (FR-J), which shows: connection status + account, the backup folder, last-synced time, **Sync now**, **Restore from Drive**, and the auto-sync setting.

### FR-I — Client-side Drive sync *(Must)*
- **AC-I0 (tab).** A **Sync** tab exists in the bottom nav and surfaces every function below on one screen; a header sync shortcut (chip) opens this tab.
- **AC-I1 (connect).** A "Connect Google Drive" action runs the GIS OAuth popup requesting only `drive.file` scope; on success the app shows the connected account and enables sync.
- **AC-I1b (folder grant).** On first connect the app opens the Google folder picker; selecting the registered `HealthDashboard` folder (ID `1622qdkY3HlwzHSeX7Z3TUI5bjjvUlcKr`) grants `drive.file` access to it. The selected folder ID is remembered so the picker is not shown again unless access is lost.
- **AC-I2 (manual sync).** "Sync now" pushes the current per-person data (CSV + JSON) into the selected `HealthDashboard` Drive folder and shows a success state with a "last synced" timestamp.
- **AC-I3 (auto-sync).** On app open, if ≥ 24 h since the last successful sync and Drive is connected, the app auto-syncs; the "last synced" timestamp updates. If < 24h, it does not auto-sync.
- **AC-I4 (restore).** On a device with empty/older data, the app can pull the Drive copy and load it into `localStorage` (with a confirm), so a new phone recovers the history.
- **AC-I5 (conflict rule).** When local and Drive both changed, the documented merge rule applies (per parameter+date, the newer report/edit wins; no row silently lost) and the result is shown before commit.
- **AC-I6 (scope safety).** The app can access only files it created (`drive.file`); it never lists or reads the user's other Drive files. Verifiable via the granted scope.
- **AC-I7 (failure-safe).** A failed/again-cancelled sync leaves `localStorage` intact and surfaces a clear retry; the app remains fully usable offline with no Drive connection.
- **AC-I8 (config).** With no OAuth Client ID configured (P1), sync UI is clearly disabled/hidden and the rest of the app works normally.

---

## 10. Non-functional requirements

| ID | Requirement | Acceptance criterion |
|---|---|---|
| NFR-Mobile | Mobile-first installable PWA (mealfast model) | 390px viewport: no horizontal scroll; installs via Add to Home Screen; opens offline after first load; **bottom tab bar stays fixed/visible during scroll** (FR-J). |
| NFR-Perf | Responsive | Load ≤ 5 s; person switch ≤ 2 s; upload feedback ≤ 1 s. |
| NFR-Accuracy | Extraction fidelity | ≥ 95% numeric match on 20-cell spot-check per person. |
| NFR-Sec | Privacy | Data on-device (localStorage); Drive access limited to `drive.file` (app-created files only); no PII in logs/URLs. |
| NFR-Sync | Backup resilience | Sync is atomic per person; a failed sync never corrupts local or Drive data; "last synced" time always visible. |
| NFR-Trace | Auditability | Every displayed value traces to `source_file` + `parameter_raw`. |
| NFR-Compat | Browsers | Latest mobile Safari + Chrome. |
| NFR-Disclaimer | Non-diagnostic | Visible disclaimer on dashboard + recommendations. |

---

## 11. Master validation checklist (sign-off)

1. ☐ 11 reports attributed to person+date; ECHO excluded (FR-A).
2. ☐ Synonym sets merge to one canonical each; mapping reviewed; zero silent drops (FR-B).
3. ☐ `rajkumar.csv` + `baskari.csv` (+ JSON) produced; 20-cell spot-check ≥ 95% (FR-C).
4. ☐ Exactly 2 profiles; adding a data file adds a profile, no code change (FR-D).
5. ☐ Section-wise dashboard; latest values + status + both ranges shown; tapping a parameter with a trend deep-links to its chart (FR-E, incl. AC-E5).
5a. ☐ Report picker: "Combined (latest)" + each report; selecting one shows ALL parameters in that report (incl. no-trend ones) with that report's values/ranges; missing params omitted; no-trend rows non-tappable (AC-E8–E9).
6. ☐ Trend charts for all 10 key params with §7 threshold band + correct-direction inference (FR-F).
6a. ☐ Bottom tab bar (Dashboard · Trends · Actions · Sync) stays fixed/visible during scroll; Actions badge = flagged count; safe-area respected (FR-J).
6b. ☐ Sparse parameters handled: real date axis, no interpolation, dashed bridge over skipped reports, "last measured" badge, measured-only inference, empty-range state (AC-E3/E7, AC-F5–F9). Verify with a parameter absent from ≥1 report.
7. ☐ Recommendations for every flagged latest param, from rules table, with disclaimer (FR-G).
8. ☐ Upload: browse+upload from phone, right person only, latest date + new params, filters + trends refresh, idempotent, confirm-before-save, safe on bad input (FR-H).
9. ☐ Drive sync (Sync tab): connect via `drive.file` OAuth, manual Sync now, ≥24h auto-sync on open, restore on new device, conflict rule, scope-safe, failure-safe, disabled when unconfigured (FR-I, AC-I0).
10. ☐ All NFRs pass (§10), including installable-PWA + offline.

---

## 12. Decisions locked & sources

**All locked:** Q1 default 10 key params · Q2/Q3 mealfast static-PWA + `localStorage`-primary · Q4 single age/sex thresholds (§7) · Q5 show agreed threshold + report's own range · **D1** in-app browse-and-upload PDF parsing with confirm-before-save · **Drive sync** client-side `drive.file` OAuth, ≥24h-on-open auto-sync + manual Sync now, no backend.
**Build prerequisite:** **P1** — a free Google OAuth Client ID (I'll give setup steps); app works fully on localStorage until it's configured.

**Sources used for §7 thresholds:**
- ADA — HbA1c < 5.7% and fasting glucose < 100 mg/dL: https://diabetes.org/about-diabetes/diagnosis
- Cleveland Clinic — cholesterol targets (TC < 200, LDL < 100, HDL M 40+/F 50+): https://my.clevelandclinic.org/health/articles/11920-cholesterol-numbers-what-do-they-mean
- 2026 ACC/AHA dyslipidemia guideline (context): https://newsroom.heart.org/news/accaha-issue-updated-guideline-for-managing-lipids-cholesterol
- Serum creatinine by sex (M 0.7–1.2, F 0.5–1.0 mg/dL): https://www.medicalnewstoday.com/articles/322380
- Hemoglobin by sex / uric acid ranges (clinical lab reference): https://www.accp.com/docs/sap/Lab_Values_Table_PSAP.pdf
- Cross-checked against the printed reference intervals on your own Iswaryam / Lucid / PharmEasy reports.

---

*End of SRS v1.5 (build-ready; report picker, navigation, Sync tab, and sparse-parameter handling all incorporated). On your go I'll build: (1) the two CSVs from all 11 reports, validated against §11, then (2) the mealfast-style PWA with the four-tab layout, report picker, sparse-aware trends, and Drive sync.*
