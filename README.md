# Learner Support System

A Firebase Realtime Database + Firebase Authentication learner support system built with HTML, CSS and vanilla JavaScript ES modules.

## Features

- Learner registration and email/password login
- Role-aware learner and assessor dashboards
- Task CRUD
- Task deletion confirmation
- Task search and filtering using JavaScript array methods
- Dynamic completed/outstanding/overdue progress
- Printable progress summary
- Support-session booking
- Assessor booking-status management
- Learning resources
- Assessor resource management
- JavaScript mini-game with Firebase score storage
- Firebase Realtime Database security rules

## Project structure

```text
learner-support-system/
├── index.html
├── dashboard.html
├── tasks.html
├── booking.html
├── resources.html
├── assessor.html
├── README.md
├── css/
│   └── style.css
├── js/
│   ├── app.js
│   ├── auth.js
│   ├── booking.js
│   ├── dashboard.js
│   ├── firebase.js
│   ├── resources.js
│   ├── assessor.js
│   └── tasks.js
└── firebase/
    ├── firebase.json
    └── database.rules.json
```

## Firebase setup

1. Create a Firebase project.
2. Enable Authentication > Sign-in method > Email/Password.
3. Create a Realtime Database.
4. Copy the Web App configuration into `js/firebase.js`.
5. Publish the rules in `firebase/database.rules.json`.
6. Serve the project through a local server such as VS Code Live Server.

Do not place Firebase Admin SDK service-account credentials in the frontend.

## Assessor accounts

Normal registration always creates a `learner` account. Do not add an assessor role selector to the public registration form.

For production, create/promote assessor users through a trusted administrator process using the Firebase Admin SDK or Firebase Console. Do not allow a browser user to promote their own role.

## Deploy rules

Install the Firebase CLI and authenticate:

```bash
firebase login
```

From the `firebase` directory, link/select your Firebase project as appropriate and deploy:

```bash
firebase deploy --only database
```

## Important security note

The UI role checks improve user experience, but Firebase Realtime Database rules are the real security boundary. Test rules with Firebase Emulator Suite before production deployment.

## Local development

Because this project uses ES modules, use a local HTTP server rather than opening the HTML files directly with `file://`.

VS Code:
- Install Live Server.
- Right-click `index.html`.
- Select "Open with Live Server".

Or use any static server, for example:

```bash
npx serve .
```
