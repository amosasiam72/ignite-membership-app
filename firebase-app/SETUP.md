# Ignite Membership App - Firebase Setup

## Your config is already set! Now enable services in Firebase Console:

Go to [console.firebase.google.com](https://console.firebase.google.com/) and select your project: **ignite-chapel-membership-app**

### Step 1: Enable Authentication
1. Click **Authentication** in left sidebar
2. Click **Get started**
3. Click **Email/Password** provider
4. Toggle **Enable** and click **Save**

### Step 2: Create Admin User
1. Go to **Authentication** > **Users** tab
2. Click **Add user**
3. Email: `admin@ignitechapel.com` (or whatever you want)
4. Password: Choose a strong password
5. Click **Add user**

### Step 3: Create Firestore Database (Production Mode)
1. Click **Firestore Database** in left sidebar
2. Click **Create database**
3. Select **Start in production mode** (locks data by default)
4. Choose a location close to you
5. Click **Enable**

### Step 4: Apply Firestore Rules
The rules are already deployed via CLI. To verify:
1. Go to **Firestore** > **Rules** tab
2. Confirm the rules match the contents of `firestore.rules`

If not, copy and paste the contents of `firestore.rules` and click **Publish**.

### Step 5: Run the App

**Just double-click `index.html`** — it works directly in your browser!

Or with a local server:
```bash
cd firebase-app
python -m http.server 8000
```
Then open `http://localhost:8000`

### Step 6: Deploy to Firebase Hosting (Optional)
```bash
cd firebase-app
npm install -g firebase-tools
firebase login
firebase init hosting
# Select your project, public directory: ., SPA: yes, overwrite index.html: no
firebase deploy --only hosting
```

Your app will be live at: `https://ignite-chapel-membership-app.web.app`

## Security Summary

| Service | Rule |
|---|---|
| Firestore | Authenticated users only — full CRUD |

## Done! 🎉

Sign in with the admin account you created and start adding members.
