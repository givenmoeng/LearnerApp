# Learner Support System

A Firebase Realtime Database + Firebase Authentication learner support system built with HTML, CSS and vanilla JavaScript ES modules.

## Features

- Learner registration, email/password login and password reset
- Role-aware navigation (learners never see the Assessor console)
- Task CRUD, search, filtering and overdue badges
- Dashboard next actions: overdue tasks, next booking, latest quiz score
- Support-session booking with future dates only and learner cancel
- Assessor inbox with request details, session notes and meeting links
- Assessor learner roster, progress view and task assignment
- Learning resources with assessor add/edit/delete
- JavaScript mini-game with immediate feedback and visible score history
- Nested Realtime Database paths and emulator-tested security rules

## Project structure

```text
learner-support-system/
├── index.html
├── README.md
├── firebase.json
├── package.json
├── frontend/
│   ├── index.html
│   ├── dashboard.html
│   ├── tasks.html
│   ├── booking.html
│   ├── resources.html
│   ├── assessor.html
│   ├── css/style.css
│   └── js/
└── backend/
    ├── firebase.json
    ├── database.rules.json
    └── tests/rules.test.mjs
```

The **frontend** folder is the learner/assessor UI. The **backend** folder holds Firebase Realtime Database rules, emulator tests and Firebase CLI config.

Data is stored under paths a user is allowed to list:

- `tasks/{uid}/{taskId}`
- `bookings/{uid}/{bookingId}`
- `gameScores/{uid}/{scoreId}`
- `resources/{resourceId}` (any signed-in user may list)
- `learnerIndex/{uid}` (assessors list the roster)
- `assessorInbox/bookings/{bookingId}` (assessors list incoming requests)

## Firebase setup

1. Create a Firebase project.
2. Enable Authentication > Sign-in method > Email/Password.
3. Create a Realtime Database.
4. Copy the Web App configuration into `frontend/js/firebase.js`.
5. Publish the rules in `backend/database.rules.json`.
6. Serve the **frontend** folder through a local server such as VS Code Live Server.

Do not place Firebase Admin SDK service-account credentials in the frontend.

## Assessor accounts

Normal registration always creates a `learner` account. Do not add an assessor role selector to the public registration form.

For production, create/promote assessor users through a trusted administrator process using the Firebase Admin SDK or Firebase Console. Do not allow a browser user to promote their own role.

## Deploy

Install the Firebase CLI and authenticate:

```bash
firebase login
```

From the project root, link/select your Firebase project and deploy rules and hosting:

```bash
firebase deploy
```

Rules only:

```bash
firebase deploy --only database
```

You can also deploy from `backend` (`firebase deploy --only database`), which uses `backend/firebase.json`.

## Test rules in the emulator

The Realtime Database emulator needs a JDK on your PATH (Android Studio's JBR is enough). Then:

```bash
npm run test:rules
```

That starts Auth + Database emulators and runs `backend/tests/rules.test.mjs`. All nested-path list/write checks should pass before you deploy `backend/database.rules.json`.

To point the UI at emulators while they are running, open `frontend/index.html?emulator=1` or set `localStorage.useEmulator = "true"` in the browser console.

After this data-model change, old records stored directly under `/tasks`, `/bookings` or `/gameScores` will not appear. New work is written under `/{collection}/{uid}/{id}`.

## Important security note

The UI role checks improve user experience, but Firebase Realtime Database rules are the real security boundary. Test rules with Firebase Emulator Suite before production deployment.

## Local development

Because this project uses ES modules, use a local HTTP server rather than opening the HTML files directly with `file://`.

VS Code:
- Install Live Server.
- Right-click `frontend/index.html`.
- Select "Open with Live Server".

Or use any static server from the project root:

```bash
npx serve frontend
```


#For app to run
#Backend
- Download docker app
- Add containers n docker
- start the containers
-  run docker

#Frontend
- Download flutter 
- run flutter on frontend to open the app


