# Ignite Chapel Membership App

A church membership management app for Ignite Chapel's media team. Built with Firebase Firestore + Auth and a dark-themed teen-friendly UI.

## Features

- **Public Registration** — Members register voluntarily (no login required) with name, DOB, phone, email, 4-digit PIN, Instagram, TikTok, and profile photo
- **Self-Service Updates** — Members update details via name search + secret 4-digit PIN verification
- **Admin Dashboard** — Email/password login with stats, birthday countdowns, and full member/event CRUD
- **Events & Attendance** — Create events, mark members present/absent
- **Birthday Flyer Generator** — Generates custom birthday flyers using a Canva-designed template with draggable text/photo positioning
- **Drag-and-Drop Flyer Editor** — Canva-like editor to position photo, name, and date on the flyer template before generating for members

## Tech Stack

- **Frontend** — Vanilla HTML/CSS/JS (no framework)
- **Backend** — Firebase Firestore + Firebase Auth
- **Storage** — Base64 in Firestore (free plan — no Firebase Storage)

## Setup

1. Clone the repo
2. Open `firebase-app/` folder
3. Serve locally:
   ```
   python -m http.server 3000
   ```
4. Open `http://localhost:3000` in a browser
5. To deploy hosting:
   ```
   firebase deploy --only hosting --project ignite-chapel-membership-app
   ```

## Admin Login

- Email: `admin@ignitechapel.com`
- Password: (ask the media team lead)

## Project Structure

```
firebase-app/
├── index.html              # Entry point
├── app.js                  # All application logic
├── style.css               # Dark theme styling
├── firebase-config.js      # Firebase credentials
├── firestore.rules         # Security rules
├── firebase.json           # Firebase CLI config
├── firestore.indexes.json  # Composite indexes
├── flyer-template.js       # Base64-encoded flyer template
├── flyer-template.jpg      # Canva-designed flyer background
├── Ignite chapel no bg.png # Logo
└── SETUP.md                # Detailed setup guide
```
