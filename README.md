# MovieHub Local

MovieHub is a static, installable browser app for browsing and playing videos
from a folder the user selects. It does not require a MovieHub backend or send
video files to a server.

## How it works

- Choose a movie folder in a supported desktop browser. MovieHub uses the
  browser's File System Access API to list and play supported video files
  (`.mkv`, `.mp4`, `.avi`, `.mov`). Chrome and Edge desktop are recommended.
- The browser may ask you to grant folder access again later. Choose the folder
  again in Settings if access expires or is revoked.
- Rescan from Settings after adding, removing, or renaming files in that folder.
- If a TV browser cannot pick a folder, use **Choose video files** instead.
  Individually selected files remain available only for the current app session;
  select them again after reopening MovieHub. Whether the system file picker can
  browse USB storage or select multiple files depends on the TV browser and
  firmware.
- The catalog, language, playback progress, and optional TMDB credential are
  kept in this browser profile using IndexedDB. Clearing site data removes them.
- MovieHub searches TMDB directly from the browser when you provide your own
  TMDB API key or v4 Read Access Token. The credential is stored in browser
  storage and is visible to anyone with access to that browser profile.
- The PWA shell can be installed and cached for offline opening. TMDB features
  need internet access, and video playback needs access to the selected folder.
- Each device has its own browser storage and folder permissions. There is no
  shared library, network streaming, device pairing, or centralized account.

## Local development

1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Run `npm run dev` and open the local URL printed by Vite.
4. Select a movie folder in the app. Add your TMDB credential in Settings if
   you want movie descriptions, artwork, actors, and directors.

Run `npm run build` to create the static production site in `dist/`, or
`npm run preview` to preview that build locally.

## GitHub Pages deployment

The GitHub Actions workflow builds the static PWA with a repository-specific
base path and publishes `dist/` to GitHub Pages. Push to the `main` branch or
run the **Deploy to GitHub Pages** workflow manually. In the repository's
**Settings → Pages**, select **GitHub Actions** as the build and deployment
source.

GitHub Pages serves the frontend only. The browser accesses the local video
files directly after the user chooses a folder; no API server is deployed.

## Android TV APK

The Android TV wrapper uses the same MovieHub interface and Android's system
folder picker to grant persistent access to a movie folder on a USB drive.
Video files remain on the TV and are not uploaded. The TV's Android/WebView
media codecs determine which video formats can play.

Each push to `main` also builds a debug APK. Download
`moviehub-android-tv-apk` from that build's **Actions → Artifacts**, copy the APK
to the TV, and install it with a file manager. The TV may require enabling
installation from that file manager in its security settings. The APK is
debug-signed for testing; publishing on Google Play requires a separately
signed release build.

For a local APK build, use Node.js 20+, JDK 17, Android SDK Platform 36, and
Gradle 9.1.0:

```sh
npm ci
VITE_BASE_PATH=./ npm run build
mkdir -p android/app/src/main/assets/www
cp -R dist/. android/app/src/main/assets/www/
gradle --no-daemon -p android assembleDebug
```

In Windows PowerShell, replace the web build and asset-copy commands above
with:

```powershell
$env:VITE_BASE_PATH = "./"
npm ci
npm run build
New-Item -ItemType Directory -Path android\app\src\main\assets\www -Force
Copy-Item -Path dist\* -Destination android\app\src\main\assets\www -Recurse -Force
gradle --no-daemon -p android assembleDebug
```
