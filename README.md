# 🏗️ Construction Daily Report Tracker (PWA)

A field-ready, offline-first Progressive Web App (PWA) for construction superintendents and project managers. Log daily site activity, dictate field notes hands-free with voice recognition, document job site photos with captions, and export clean PDF daily reports.

![Daily Report Tracker dashboard](docs/dashboard.png)

## 🌟 Key Features

- **📱 Installable PWA** – Installs on iOS, Android, macOS, and Windows with its own app icon and home-screen name ("Daily Reports"). Critical assets and icons are cached locally, so the app opens and runs in job site dead zones with no cell service.
- **💾 Offline Storage with IndexedDB** – Profiles, reports, and photos are stored in the browser's IndexedDB (via Dexie.js), which holds far more data than `localStorage`. The app only confirms a save after the data is actually stored, and existing `localStorage` data is migrated automatically.
- **🛟 Backup & Restore (temporary)** – **Download Backup** saves the profile, all projects, and all reports (including photos) to a single `.json` file. **Restore Backup** checks that the file is a valid backup, asks for confirmation, and replaces the app's data in one all-or-nothing step. This is a stopgap for testing until cloud sync is added, and will be removed then.
- **🗂️ Project Management** – Add, edit, and delete projects (name, code, location). The newest project appears as the first tab and opens by default. Deleting a project also deletes its reports, after a confirmation warning.
- **📅 Smart Report Defaults** – New reports open with today's date (with a calendar picker to change it) and the current local weather, fetched automatically from your location. Both can be edited manually.
- **🎙️ Hands-Free Voice Dictation** – Uses the Web Speech API to transcribe spoken notes directly into the daily log while walking the site. Each spoken phrase becomes a bullet point.
- **📸 Photo Documentation & Labeling** – Add photos from the camera or device storage, store them offline, and attach trade or location captions. Photos are automatically resized (max 1600px) and compressed to JPEG before saving, typically about 15–20× smaller (e.g., 2.7 MB → 159 KB). iPhone HEIC photos are converted automatically, so they also work in Windows browsers. In the report, photos are shown in full without cropping.
- **📄 PDF Export** – Uses the browser's built-in print engine with custom print CSS to produce formatted daily report PDFs, with no external server required. After saving, the report opens straight to the preview, ready to export.
- **👓 Readable on Phones** – Larger, darker text on phones for report previews, field notes, and form fields, tested with users of different ages. Form text is 16px, which also stops iPhones from auto-zooming when a field is tapped.
- **⚡ Responsive, High-Contrast UI** – Built with React 19, Vite, and Tailwind CSS v4, with high contrast for outdoor visibility.

## 🛠️ Tech Stack

| Area | Technology |
| --- | --- |
| Frontend | React 19 + Vite |
| Styling | Tailwind CSS v4 |
| Icons | Lucide React |
| Offline Storage | IndexedDB via Dexie.js |
| PWA / Offline | vite-plugin-pwa (service worker) |
| Weather | Open-Meteo API (free, no API key) + browser Geolocation |
| Photo Processing | Browser Canvas API (resize & compress) + heic2any (HEIC → JPEG) |
| Speech-to-Text | Web Speech API (`SpeechRecognition`) |
| PDF Export | Browser print engine (`window.print()` + `@media print`) |

## 📁 Project Structure

```
daily-report-tracker/
├── docs/                  # README screenshots
├── public/
│   ├── favicon.svg            # K logo (browser tab & app header)
│   ├── apple-touch-icon.png   # iPhone/iPad home-screen icon (180×180)
│   ├── pwa-192x192.png        # Android home-screen icon
│   ├── pwa-512x512.png        # Android splash screen / large icon
│   ├── maskable-512x512.png   # Android icon for circle/rounded crops
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

Press **F12 → Application → IndexedDB → DailyReportTrackerDB** to see the `reports`, `profile`, and `projects` tables.

## 📱 Testing on Your Phone

**Phone view in the browser:** Press **F12**, then **Ctrl + Shift + M**, and choose a phone from the **Dimensions** dropdown.

**On a real phone:** With the phone and laptop on the same Wi-Fi, start the server with:

```bash
npm run dev -- --host
```

Then open the **Network** address shown in the terminal (e.g., `http://192.168.1.25:5173/`) in the phone's browser.

> ⚠️ **Note:** The microphone and automatic weather usually won't work this way, because phones only allow them on secure (https) sites. Layout and text sizes are accurate.

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
2. **Projects** – Click **Add Project** to create a project. Use the **pencil** next to the project code to edit or delete it.
3. **Create a Daily Report** – Select a project and click **Add New Report**. Today's date and local weather fill in automatically (allow location access when prompted); change either if needed.
4. **Voice Dictation** – Tap **Record** and speak your field observations. Each phrase is added as a bullet point.
5. **Photos** – Click **+ Add Site Photo**, then add a caption (e.g., "Foundation Pour – Grid C4").
6. **Backup (testing only)** – Click **Download Backup** before making risky changes; use **Restore Backup** to put everything back.
7. **Save & Export** – Click **Save Report**. The finished report opens immediately; click **Export PDF Report** to save or print it.

![Daily report view](docs/reportpage.png)

## ⚠️ Known Limitations

- **Single device:** Data is stored only in the browser and device where it was entered. There is no cloud sync yet; use **Download Backup** to keep a copy.
- **Voice dictation:** The browser's speech recognition does not know construction terminology (e.g., "FF&E" may be written as "FFNE"). In Chrome and Edge it usually requires an internet connection; it is not supported in Firefox, and support in Safari is limited.
- **Weather:** Automatic weather requires location permission and an internet connection. Offline, the field stays blank for manual entry.

## 🗺️ Roadmap

- [x] Move storage to IndexedDB (Dexie.js) for larger, more reliable offline storage
- [x] Default to today's date with a calendar picker, and auto-fill local weather
- [x] Open the saved report directly after saving
- [x] Add, edit, and delete projects (newest project first)
- [x] Larger, higher-contrast text for phone readability
- [x] Compress photos before saving to reduce storage use (with HEIC support)
- [x] Data export/import backup (temporary, for testing)
- [ ] Cloud sync with Supabase (accounts, multi-device access, photo storage) – replaces the temporary backup buttons
- [ ] AI transcription trained on construction terminology, with offline recording that transcribes once back online
- [x] Hosted deployment on Netlify (accessible from any network)
- [x] Custom app icons and PWA manifest (installable with its own icon)
