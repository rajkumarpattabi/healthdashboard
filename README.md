# HealthDashboard

A private, installable web app (PWA) that turns your family's lab-report PDFs into a
dashboard: section-wise results, trend charts against age/sex targets with plain-language
inferences, recommended actions, an individual-report viewer, PDF upload, and optional
Google Drive backup. Static files only — **no server**, same model as *mealfast*.

Built for **Rajkumar** (43 M) and **Baskari** (39 F) from 10 lab reports (Iswaryam,
PharmEasy, Lucid). Parameters are standardised across labs; see `data/VALIDATION.md`.

## ⚠️ Privacy — read first
`data/seed.js`, `data/rajkumar.csv`, `data/baskari.csv` and `data/health-data.json`
contain **real personal medical values**. Two safe ways to publish:

- **Recommended: keep the GitHub repo PRIVATE.** (GitHub Pages on a private repo needs a
  paid GitHub plan. Or run it locally / on Netlify Drop privately.)
- **If the repo must be PUBLIC:** delete `data/seed.js` (and the CSVs) before pushing. The
  app then starts empty; add your reports on-device with the **＋ Upload** button — the data
  lives only in your phone's browser and (optionally) your own Google Drive. It never touches
  the repo.

## Files
```
index.html        app shell            manifest.json   installable-app metadata
app.js            all logic            sw.js           offline cache
style.css         styling              config.js       your Google keys (optional)
icons/            home-screen icons    data/seed.js    bundled data (localStorage seed)
data/*.csv        the unified per-person sheets (also the Drive backup format)
data/VALIDATION.md  extraction validation report
```

## Publish to GitHub Pages (≈5 min, no Mac)
1. Create the repo (private recommended — see Privacy above). If it already exists:
   `github.com/rajkumarpattabi/healthdashboard`.
2. From this folder, first time only:
   ```
   git init
   git add -A
   git commit -m "HealthDashboard"
   git branch -M main
   git remote add origin https://github.com/rajkumarpattabi/healthdashboard.git
   git push -u origin main
   ```
   After that, just double-click **push.bat** to publish changes.
3. Repo → **Settings → Pages** → Source: `main` / `/ (root)` → Save.
4. Your URL: `https://rajkumarpattabi.github.io/healthdashboard/`

## Install on iPhone
Open the URL in **Safari** → Share → **Add to Home Screen** → Add. It opens full-screen with
the heart icon and works offline.

## Add a new report (on the phone)
Tap **＋** → browse the report PDF → the app reads it on-device, shows a **confirm screen**
(fix anything mis-read) → **Save**. The correct person's data updates, new parameters are added
automatically, trends and the report picker refresh, and nothing is duplicated if you re-upload
the same report.

## Enable Google Drive backup (optional)
The app is fully usable without this. To back up to your **HealthDashboard** Drive folder
(`1622qdkY3HlwzHSeX7Z3TUI5bjjvUlcKr`):
1. In [Google Cloud Console](https://console.cloud.google.com/) create a project.
2. **APIs & Services → Enable APIs**: enable **Google Drive API** and **Google Picker API**.
3. **Credentials → Create OAuth client ID** → type *Web application*. Under *Authorised
   JavaScript origins* add your Pages origin `https://rajkumarpattabi.github.io`
   (and `http://localhost:8000` for local testing). Copy the **Client ID**.
4. **Credentials → Create API key**. Copy it.
5. Paste both into `config.js`:
   ```js
   GOOGLE_CLIENT_ID: "…apps.googleusercontent.com",
   GOOGLE_API_KEY:   "…",
   ```
6. Open the app → **Sync** tab → **Connect Google Drive** → pick the HealthDashboard folder once.
   Uses the narrow `drive.file` scope (the app only sees files it creates). Auto-syncs on open
   when it's been ≥24h; a web app can't sync while fully closed.

## Regenerate the data (from new/updated PDFs, on a computer)
The Python pipeline that built the data lives in `build/` (kept out of the published site):
```
python3 build/extract.py    # PDFs → build/extracted.json (review the printout)
python3 build/build.py      # → data/*.csv, data/seed.js, data/health-data.json
python3 build/validate.py   # → data/VALIDATION.md
```

## Medical disclaimer
This app organises your own lab data and shows general, non-diagnostic guidance. It is **not**
a medical device and does not replace a doctor. Always review results with a clinician.
