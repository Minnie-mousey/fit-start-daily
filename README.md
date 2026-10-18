# Fit Start Daily

Project: Little by Little - Fitness Companion

## Deploying to GitHub Pages

The `Deploy to GitHub Pages` workflow builds and publishes the app to
`https://<owner>.github.io/little-by-little/` whenever changes are pushed to
`main` (or when run manually from the Actions tab). In the repository settings,
the workflow configures Pages to use **GitHub Actions**. The build also includes
a fallback page so app routes work when opened directly or refreshed.

You are a senior React Native engineer and mobile product designer. Help me build a polished, beginner-friendly fitness companion app using Expo, React Native and TypeScript.

Product vision

Create a web app (to be turned mobile) exercise companion that makes consistent exercise enjoyable through guided workouts, habit tracking, daily challenges, progression, achievements and customizable rewards.

The app must prioritize usability, safe beginner progression, accessibility and reliable data persistence.

Core requirements

The complete product will eventually include:

1. An equipment-free exercise library with categories, step-by-step instructions, demonstrations, difficulty levels and modifications.

2. A guided workout player with timers, repetitions, rest periods and session completion.

3. Daily challenges, XP, levels, streaks, coins, achievements and unlockable cosmetic themes.

4. Weight tracking, fitness progress charts and workout history.

5. Personal audio imports, playlists and music playback during workouts.

6. Custom workout plans with goals, target dates, session durations and training schedules.

7. A customizable calendar with scheduled workouts, completed sessions, rest days and reminders.

8. Configurable notifications and quiet hours.

9. A profile, settings and accessibility section.

Technical requirements

- Use Expo, React Native and TypeScript.

- Use Expo Router for navigation.

- Use local SQLite storage for structured, persistent application data.

- Organize the code into reusable components, screens, hooks, services, types and repositories.

- Keep business logic separate from UI components.

- Use a centralized workout completion and reward service.

- Include clear loading, empty, success and error states.

- Avoid unnecessary dependencies.

- Keep the architecture suitable for future authentication and optional cloud synchronization.

- Do not use mock buttons that appear functional but do nothing.

Design direction

Create a warm, polished, playful fitness-game aesthetic. Use soft colors, clear typography, rounded cards, tasteful illustrations, subtle animations and satisfying progress feedback.

The interface should feel motivating without becoming childish, cluttered or visually overwhelming. Support responsive layouts and accessible text contrast.

Use a persistent bottom navigation bar with Home, Workout, Calendar, Progress and Profile.

## Implemented planning and progress features

- The equipped Sprout is rendered consistently in the home artwork, persistent navigation, workout player and rewards profile. The badge collection awards persistent badges for workout and streak milestones, completing challenges, and finishing the weekly five-active-days task.
- Avatar frames can be earned from achievement milestones or purchased with coins, equipped independently of the avatar, and paired with one selected unlocked achievement badge displayed at the lower-right of the frame.
- Higher-tier achievement rewards include an animated aurora frame for a 14-day streak, a shimmering STARDUST banner frame at 50 sessions, and a LEGEND crest at 100 sessions. Rare and epic badges use distinct medallions; animations respect reduced-motion preferences.
- Build deterministic workout plans with a goal, experience level, session duration, preferred activities, weekly frequency, start/target dates, recovery preference and movement limitations. Preview plans, edit individual session exercises, regenerate, then activate.
- Generated sessions include warm-up, main and cooldown moves, recovery days, and gradual target progression. Plan changes replace future scheduled/rest entries but retain completed workout sessions and calendar history.
- Calendar entries distinguish scheduled, completed, skipped and rest days. Scheduled workouts can be started or rescheduled; entries support notes and reminders. Recurring local browser reminders support notification permission, quiet hours, snooze and cancellation. Browser reminders require the app to be open or resumed; the browser cannot schedule reliably while it is suspended or closed.
- Import personal audio files (MP3, M4A, AAC, WAV, OGG, OPUS, FLAC or WEBM, subject to browser codec support), organize them into ordered playlists and play them from the workout player. Audio copies are stored in this browser's local IndexedDB storage; playlist and track metadata are stored in SQLite. Browser storage may be cleared or unavailable, and audio files are not included in application data exports.
- Profile data tools support manual, offline JSON export and restore. Version 3 backups contain player/reminder settings, weight records and preferences, plans, calendar entries, workout sessions and exercise performance, challenges, reward ledger, achievements, cosmetic inventory/equipment, avatar frame and badge selections, and playlist/track metadata. Version 1 and 2 backups are migrated on import. Backups do not contain imported audio bytes, secrets, or browser permission grants. Importing a backup from another device restores music metadata only; audio must be imported again.
- Backup restore previews the validated data before confirmation, keeps a local IndexedDB safety copy and downloads it before replacing data. Records that fail schema, type, uniqueness or foreign-key checks are skipped and shown in the preview. For duplicates, the first valid record in file order wins; later primary-key or unique-key duplicates are skipped. Version 1 backups migrate reminder defaults, and version 1 and 2 backups migrate to version 3 with default avatar frame and badge selections.
- Track weight entries with add/edit/delete, kg/lb display conversion, an optional goal and a trend chart. Workout progress includes a rolling 30-day consistency rate and session history.
- Fitness data is stored locally in SQLite on this device. The app does not provide medical advice; movement limitations are simple exercise filters and are not a substitute for professional guidance.
- This repository is a web app, not an Expo/Android project. It uses the browser's file picker, HTML audio and Notification API; it does not provide Android background/locked-screen playback or guaranteed closed-app local notifications. Codec support and audio focus/interruption behavior depend on the browser and device. No Spotify or Apple Music import is provided.
- Backups are manual and device-local until downloaded by the user. A storage-provider interface is kept separate from the local SQLite implementation for possible future cloud providers; cloud synchronization is not implemented.
- The production web app precaches its app shell and bundled assets with a service worker. Open the app once while online to install the offline cache; after that, the app shell, bundled exercise data and saved local data remain available offline. Any external exercise demonstration links and imported streaming/online content still require internet access. Offline service workers require HTTPS (except on localhost), and browser storage can still be cleared by the user or operating system.

## Validation

Use `npm test` to run the test suite and `npx tsc --noEmit` to check types. Existing app functionality and local workout history should be preserved when changing or activating plans.

At the end, provide:

- The files created or modified.

- The features implemented.

- The commands needed to run the project.

- Any remaining limitations.

- A short manual testing checklist.

Do not claim that a feature works unless it has been implemented and tested. Preserve existing working functionality when making subsequent changes.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a3a2f3ad-1960-45c8-ba2b-b9a2d21a8a80).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
