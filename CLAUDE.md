# HealthDashboard — Project Context & Handoff

> **Purpose of this file:** context carry-over for a fresh Claude (Cowork / Claude Code)
> session on a new machine. The code is already in the repo backup; this file captures the
> *decisions, constraints, history, and workflow* that are not obvious from the code alone.
> It contains **no medical values** and is safe to keep in the repo. Last updated: 2026-11-12.

---

## 1. What this is

**HealthDashboard** is a mobile, installable **PWA** (Progressive Web App) that:

- Reads medical lab-report **PDFs** for two people — **Rajkumar (43/M)** and **Baskari (39/F)**.
- Extracts values, **standardises** parameter names/units across different labs (Iswaryam, PharmEasy, Lucid, Aarthi).
- Stores readings per person, keyed by test date.
- Displays: a person toggle, a section-wise dashboard, trend graphs with age/sex threshold bands and plain-language inferences, recommended actions for out-of-range values, an individual-report picker, in-browser PDF upload (parsed on-device), and Google Drive backup.

Architecture deliberately **mirrors the user's `mealfast` app** (https://github.com/rajkumarpattabi/mealfast): a static GitHub Pages PWA, **localStorage-primary**, **no backend**.

**Hosting:** GitHub Pages, repo https://github.com/rajkumarpattabi/healthdashboard (PUBLIC).
**Local repo (old laptop):** `C:\Users\rajkumar_p\dev\healthdashboard`
**Source report PDFs:** `C:\Users\rajkumar_p\OneDrive - Expleo France\02.Personal\Health\Med Reports`

---

## 2. ⚠️ Privacy & security constraints (MOST IMPORTANT — never violate)

The repo is **PUBLIC and must stay DATA-FREE**. Medical values must **NEVER** be committed:

- **Never commit:** `data/rajkumar.csv`, `data/baskari.csv`, `data/health-data.json`, `data/VALIDATION.md`, any `*-backup.json`. These are in `.gitignore`.
- `data/seed.js` **is** committed, but **only as a data-free stub** — `profiles[].params` must be empty `{}`. The build pipeline can overwrite `seed.js` with real values locally; **if you run the build, restore the data-free stub before committing.**
- Real medical data lives **only** in three places: the device's **localStorage**, the **`healthdashboard-backup.json`** file (kept in the Med Reports folder), and the user's **Google Drive** ("HealthDashboard" folder).
- The **Google OAuth Client ID** in `config.js` is a public value — safe to commit.
- `.gitignore` has a critical rule: `/*.png` + `!icons/*.png` (so app icons publish but screenshots/mockups don't). `build/` and `mockup.html` are also ignored.

**Migration implication:** a fresh install on the new laptop / phone starts with **empty data** (data-free seed). To get data back, the user **restores from Google Drive** (Sync tab → Restore) or **imports the backup file** (Sync tab → Import backup file).

---

## 3. Tech stack & repository map

Static PWA, vanilla JS (no framework, no build step for the app itself).

```
healthdashboard/
├── index.html         # App shell: header (brand, sync chip, + upload btn), person toggle
│                       #  + always-on "Last tested" counter, meta bar, 4 views, bottom nav
├── app.js             # ALL app logic (~560 lines). See §5.
├── style.css          # Dark theme, tokens as CSS vars. See §6.
├── config.js          # window.HD_CONFIG = { GOOGLE_CLIENT_ID: "...", GOOGLE_API_KEY:"", DRIVE_FOLDER_ID:"" }
├── sw.js              # Service worker, offline cache. VERSION string bumped every deploy (see §7).
├── manifest.json      # PWA manifest
├── data/
│   └── seed.js        # window.SEED = {...}  — DATA-FREE stub in repo (params:{})
├── icons/             # apple-touch-icon.png (180), icon-192/512/1024.png  (published)
├── icon.svg           # heart + ECG pulse on blue→teal gradient
├── push.bat           # self-initialising git push helper (see §7)
├── README.md
├── .gitignore
└── build/             # ⚠️ GITIGNORED — Python pipeline, NOT in a git clone. See §4.
```

**Google Client ID** (public, baked into `config.js`):
`903091492554-39i0rrd5800pqkfk6r7q5n0hcb42rg3q.apps.googleusercontent.com`

---

## 4. The build pipeline (offline, Python — `build/`, gitignored)

Used **only** to (re)generate the seed data from the source PDFs. The app itself never runs this.
**If the new laptop only has a git clone, `build/` and the extracted JSON will be missing** — they're
gitignored. They can be recreated; the source PDFs are in the Med Reports folder.

- `build/extract.py` — parses the standard lab PDFs (Iswaryam / PharmEasy / Lucid) → `extracted.json`.
- `build/enrich.py` — parses the two Aarthi "SMART REPORT" glance tables (`P_RAJKUMAR_*`, `S_BASKARI_*`) and the Nov-2025 vitamin report, merges into `extracted_full.json`.
- `build/build.py` — applies the MASTER taxonomy + thresholds, writes `data/rajkumar.csv`, `data/baskari.csv`, `data/seed.js` (REAL data — do not commit), `data/health-data.json`, `data/VALIDATION.md`.
- `build/validate.py` — validation checks.

Requires `pdfplumber` (`pip install pdfplumber --break-system-packages`).

---

## 5. `app.js` — key structures

- **State:** `HD` (the whole data object), `person`, `view` ('dash'|'trends'|'actions'|'sync'), `reportMode` ('latest' or a date index), `trendRange`.
- **Data load:** `load()` reads localStorage (`LS_KEY='hd_data_v1'`), falling back to `window.SEED` then `DEFAULT_EMPTY`. `persist()` writes back.
- **Boot (bottom of file):** `HD=computeDerived(fixTh(load())); person=HD.profiles[0].id; renderToggle(); populateReports(); renderAll();`
- **Taxonomy:** `SEC`/`SECTIONS` (9 sections), `ORDER` (canonical param order), `KEY` (key params incl. derived `FIB-4`), `DESC` (one-line plain-language descriptor per param), `DICT` (upload-parser synonyms), `classifyAarthi()` (Aarthi glance-label → canonical).
- **Thresholds:** `TH(name,sex)` sex-specific cores; `fixTh(d)` self-heals unit-converted CBC/Vitamin-D thresholds on imported data; `thFromRef()` derives from printed ranges. FIXED overrides: WBC {4–11}, Platelet {150–410}, Vitamin D {30–100}.
- **Derived:** `computeDerived(d)` computes **FIB-4** liver-fibrosis index `= (age×AST)/(platelets×√ALT)` per date; th `{type:'max', t:1.3, warn:1.3, crit:2.67}`.
- **Renderers:** `renderToggle` (also calls `renderLastTest`), `renderLatest` (combined latest dashboard), `renderReport(idx)` (one historical report), `renderTrends`, `renderActions`, `renderSync`, `healthCard` (Health Score).
- **Charts:** `sparkline()`, `lineChart()` (threshold band + target lines + real date axis + dashed bridges over gaps), `inference()` (path-aware: monotonic "rose/fell"; non-monotonic "up/down overall … (ranging MN–MX)").
- **Upload:** `fileInput` → `pdfText()` (pdf.js) → `parseReport()`/`parseAarthi()` → `showConfirm()` → `saveReport()`. Existing dates not overwritten; no duplicate rows; new params auto-added.
- **Drive:** `Drive` object — GIS OAuth token client, `drive.file` scope; app **auto-creates its own "HealthDashboard" folder** (Google Picker was removed); `syncNow`/`restore`/`disconnect`; auto-sync on open when ≥24 h since last.
- **Backup file:** `exportBackup()` / `jsonInput` import handler.

---

## 6. `style.css` notes

Dark theme via CSS custom properties (`--plane`, `--surface`, `--ink`, `--series` blue, `--warning` amber, etc.).
Notable: header `padding-top: calc(14px + env(safe-area-inset-top))` (iPhone notch fix); `.icon-btn` is a 40px solid-blue "＋"; bottom `nav` always visible; `.row .name` is a flex row holding `.txt` (name + threshold + descriptor) and an optional right-aligned `.since` counter.

---

## 7. Deployment workflow (how changes ship)

**Claude cannot `git push`** (no credentials). The flow is:

1. Claude edits files in the repo folder (on the old laptop, via the device bridge: `device_commit_files`).
2. Claude **bumps the service-worker `VERSION`** in `sw.js` (e.g. `hd-v16` → `hd-v17`) so the PWA re-caches. **Comment-only / docs-only changes don't need a bump.**
3. **The user runs `push.bat`** — it self-initialises git on first run (`git init`, branch `main`, remote add) and pushes to the GitHub repo.
4. GitHub Pages redeploys; the user **hard-refreshes** the phone (or removes + re-adds the home-screen icon) to pick up the new SW version.

**Current service-worker version: `hd-v16`.**

GitHub Pages gotcha: a **private** repo on the free plan **can't** serve Pages (→ 404). That's why the chosen path is **public repo + data-free**.

---

## 8. Google Drive backup — setup recap

- Uses **Google Identity Services (GIS)** OAuth, scope `https://www.googleapis.com/auth/drive.file` (app sees only files it creates).
- Needs **only the Client ID** (no API key; Picker removed). The app auto-creates/uses a **"HealthDashboard"** Drive folder and a `healthdashboard-data.json` inside it.
- Client ID must list the app's address as an **Authorised JavaScript origin** (e.g. `http://localhost:8000` for local dev and the GitHub Pages URL).
- OAuth consent screen is in **Testing** mode with the user added as a **test user** (Google Auth Platform → Audience).
- Past errors solved: `origin_mismatch` (missing authorised origin), verification-blocked (needed test-user), data wiped on iOS re-add (Client ID now baked into `config.js` so it survives reinstalls).

---

## 9. Feature catalog (what's built)

- Person toggle (Rajkumar / Baskari) with age/sex sub-label.
- **Health Score** card (Aarthi-inspired) + per-section status chips (tap → scroll to section).
- Section-wise dashboard; collapsible sections; sticky bottom nav.
- Each row: name, inline threshold, one-line descriptor, sparkline, value + status pill (Normal / Borderline / High / Low).
- Tap a row with a trend → jumps to its trend chart; **double-tap a trend card → back to its dashboard section**.
- Trends view with range chips (All / 3y / 2y / 1y), threshold bands, target lines, real date axis, dashed bridges over missing reports, and path-aware plain-language inferences.
- Actions view: recommendations for out-of-range key params, severity label, suggested recheck interval, medical disclaimer.
- Upload: browse a PDF on the phone, parse on-device (pdf.js), confirm, save to the right person.
- Backup: Google Drive (auto-folder, 24 h auto-sync, manual sync/restore) **and** local export/import JSON file.
- **FIB-4** liver-fibrosis-risk derived indicator.
- **"Time since last test" counter** — see §10 (most recent feature).

---

## 10. Most recent feature — "time since last test" counter

Two counters, both driven by the same formatter in `app.js`:

- **Always-on header counter** (`#lastTest`, labelled **"Last tested"**): top-right beside the person toggle, shown for the person's **most recent test date across all params**. Always visible. On narrow phones (≤~375px) it wraps to its own right-aligned line (via `flex-wrap` + `margin-left:auto` on `.toprow`/`.lasttest`) so it never clips off-screen. (This clipping was the "counter not displayed" bug — the element rendered but sat past the viewport edge.)
- **Per-parameter counter** (`.since`, labelled **"Tested"**, amber): appears on a dashboard row **only when that parameter's last test is ≥ 6 months old** (`STALE_MONTHS=6`) — a gentle "overdue / due for retest" nudge. Recently-tested rows show nothing.

**Format tiers** (`sinceStr`):
- `< 1 month` → `"23 d"`
- `1 month to < 1 year` → `"1 m 18 d"`
- `≥ 1 year` → `"2 y 5 m"` (years + months, days dropped at that scale)

**Implementation:** `addMonthUTC()` (adds a calendar month, clamping month-ends — 31 Jan → 28/29 Feb), `sinceParts()` (whole calendar months + leftover days, never negative), `sinceStr()` (tiered format above). A borrow bug that produced "1 m -2 d" on month-end boundaries was fixed by switching to the month-advance algorithm. `STALE_MONTHS=6` governs both the per-param counter's appearance **and** the amber tint on both counters.

---

## 11. History of notable fixes / gotchas

- `push.bat` "fatal: not a git repository" → rewrote to self-init on first run.
- App icon showed only "H" → `.gitignore` `*.png` was excluding `icons/*.png`; fixed to `/*.png` + `!icons/*.png`; added `<link rel="apple-touch-icon">`. User must delete+re-add the home-screen icon.
- Health Score 79 vs Aarthi 89 → methodology differs (unweighted % vs Aarthi's weighted); also found a real bug (WBC/Platelet values unit-converted but thresholds left in raw units → false flags). Fixed via FIXED thresholds + `fixTh()`; score → 83.
- Vitamin D inference "rose from 17.25 to 18" was wrong (it dipped to 14.2) → made `inference()` path-aware.
- Vitamin D range widened 30–50 → 30–100.
- Various extraction false-matches (HbA1c grabbing "1", LDL matching ref-range text, Urea vs Urea-ratio) → `findValue()` + skip patterns.

---

## 12. Medical domain notes

- **Section order:** Diabetes Profile (blood glucose/insulin first), Heart Health, Kidney Function, Liver Health, Complete Blood Picture, Thyroid Function, Vitamins & Minerals, Bone Health, Cancer Screening (Aarthi 10-system model).
- Thresholds validated by **age + sex** (single bucket, not multiple age bands) per the user's preference.
- **FIB-4** (fatty-liver fibrosis risk): latest values — Rajkumar ≈ 0.67, Baskari ≈ 0.52 (both low risk). FibroScan in Chennai ≈ ₹2,000–7,000 if confirmation wanted.

---

## 13. How to pick up work on the new machine

1. Open the repo folder in Cowork / Claude Code; this `CLAUDE.md` loads automatically for context.
2. For a local dev preview: serve the folder (`python -m http.server 8000`) and open `http://localhost:8000` (that origin is already an authorised JS origin for Drive).
3. To test with real-looking data without touching the data-free seed, inject a mock `window.SEED` via a throwaway `_test.html` (and delete it after — never commit it).
4. Make edits → **bump `sw.js` VERSION** (unless docs-only) → user runs `push.bat` → hard-refresh phone.
5. To restore the user's actual data into a fresh app install: **Sync tab → Restore from Drive**, or **Import backup file** (`healthdashboard-backup.json`).
6. **Guard the privacy rule in §2 on every commit** — no medical values in the public repo.

## 14. Possible next steps / open ideas

- (Idea) Roll very old per-param counters past a year into "y / m" is already done; no open items on the counter.
- Keep validating thresholds as new reports arrive; re-run the build pipeline when adding historical PDFs in bulk (uploads via the app handle one-off new reports without the pipeline).
