# 🏗️ Construction Daily Report Tracker (PWA)

A field-ready, offline-first Progressive Web App (PWA) for construction superintendents and project managers. Log daily site activity, dictate field notes hands-free with voice recognition, document job site photos with captions, and export clean PDF daily reports.

![Daily Report Tracker dashboard](docs/dashboard.png)

## 🌟 Key Features

- **📱 Installable PWA** – Installs on iOS, Android, macOS, and Windows. Critical assets are cached locally, so the app opens and runs in job site dead zones with no cell service.
- **💾 Offline Storage with IndexedDB** – Profiles, reports, and photos are stored in the browser's IndexedDB (via Dexie.js), which holds far more data than `localStorage`. The app only confirms a save after the data is actually stored, and existing `localStorage` data is migrated automatically.
- **📅 Smart Report Defaults** – New reports open with today's date (with a calendar picker to change it) and the current local weather, fetched automatically from your location. Both can be edited manually.
- **🎙️ Hands-Free Voice Dictation** – Uses the Web Speech API to transcribe spoken notes directly into the daily log while walking the site. Each spoken phrase becomes a bullet point.
- **📸 Photo Documentation & Labeling** – Add photos from the camera or device storage, store them offline, and attach trade or location captions.
- **📄 PDF Export** – Uses the browser's built-in print engine with custom print CSS to produce formatted daily report PDFs, with no external server required. After saving, the report opens straight to the preview, ready to export.
- **⚡ Responsive, High-Contrast UI** – Built with React 18, Vite, and Tailwind CSS v4, with high contrast for outdoor visibility.

## 🛠️ Tech Stack

| Area | Technology |
| --- | --- |
| Frontend | React 19 + Vite |
| Styling | Tailwind CSS v4 |
| Icons | Lucide React |
| Offline Storage | IndexedDB via Dexie.js |
| PWA / Offline | vite-plugin-pwa (service worker) |
| Weather | Open-Meteo API (free, no API key) + browser Geolocation |
| Speech-to-Text | Web Speech API (`SpeechRecognition`) |
| PDF Export | Browser print engine (`window.print()` + `@media print`) |

## 📁 Project Structure

```
daily-report-tracker/
├── docs/                  # README screenshots
├── public/
│   ├── favicon.svg
│   └── icons.svg
├── src/
│   ├── App.jsx            # Main component, views & state management
│   ├── db.js              # IndexedDB database setup (Dexie.js)
│   ├── main.jsx           # Application entry point
│   └── index.css          # Tailwind directives & @media print styles
├── vite.config.js         # Vite config with Tailwind CSS v4 & PWA plugin
├── package.json
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- Node.js v18 or later
- Google Chrome or Microsoft Edge (recommended for voice dictation)

### Installation

```bash
git clone https://github.com/Kiki-K82/daily-report-tracker.git
cd daily-report-tracker
npm install
npm run dev
```

Then open http://localhost:5173/ in your browser.

> ⚠️ **Note:** Test in a regular Chrome or Edge window, not an embedded IDE preview (such as VS Code's built-in browser), so microphone, location, and storage permissions work correctly.

### Inspecting Stored Data

Press **F12 → Application → IndexedDB → DailyReportTrackerDB** to see the `reports` and `profile` tables.

## 📲 Testing Offline Mode

Service workers only run in a production build:

```bash
npm run build
npm run preview
```

1. Open the preview URL (usually http://localhost:4173/).
2. Press **F12** to open Developer Tools.
3. In the **Network** tab, set throttling to **Offline** (or check **Offline** under **Application → Service Workers**), then refresh the page.

## 📝 Usage Guide

1. **Profile Setup** – Enter your company name and superintendent details.
2. **Create a Daily Report** – Select a project and click **Add New Report**. Today's date and local weather fill in automatically (allow location access when prompted); change either if needed.
3. **Voice Dictation** – Tap **Record** and speak your field observations. Each phrase is added as a bullet point.
4. **Photos** – Click **+ Add Site Photo**, then add a caption (e.g., "Foundation Pour – Grid C4").
5. **Save & Export** – Click **Save Report**. The finished report opens immediately; click **Export PDF Report** to save or print it.

![Daily report view](docs/reportpage.png)

## ⚠️ Known Limitations

- **Single device:** Data is stored only in the browser and device where it was entered. There is no cloud sync yet.
- **Voice dictation:** The browser's speech recognition does not know construction terminology (e.g., "FF&E" may be written as "FFNE"). In Chrome and Edge it usually requires an internet connection; it is not supported in Firefox, and support in Safari is limited.
- **Weather:** Automatic weather requires location permission and an internet connection. Offline, the field stays blank for manual entry.

## 🗺️ Roadmap

- [x] Move storage to IndexedDB (Dexie.js) for larger, more reliable offline storage
- [x] Default to today's date with a calendar picker, and auto-fill local weather
- [x] Open the saved report directly after saving
- [ ] Compress photos before saving to reduce storage use
- [ ] Data export/import backup
- [ ] Cloud sync with Supabase (accounts, multi-device access, photo storage)
- [ ] AI transcription trained on construction terminology, with offline recording that transcribes once back online
- [ ] Phone-optimized layout and hosted deployment
