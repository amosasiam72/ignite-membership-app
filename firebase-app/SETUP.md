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

**Serve it over localhost or https — PIN hashing needs the Web Crypto API:**

```bash
cd firebase-app
python -m http.server 8000
```

Then open `http://localhost:8000`

Opening `index.html` by double-clicking it will load the app, but PIN features will
report that a secure connection is required.

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

## Forgot PIN (admin-assisted reset)

Members who forget their 4-digit PIN submit a request from the app, and an admin
sets the new PIN for them. No email service or third-party account is involved,
and it works identically on any static host.

**Member side** — **Update Your Details → search a member → Forgot your PIN? →
Send Request**. The form pre-fills the email and phone from the membership record
and asks for at least one way to reach them. On submit, a document is written to
`pinResetRequests` with `status: 'pending'`.

Guardrails on the member side:
- One open request per member — a second submit is refused until the first is handled.
- Three requests per member, total, after which they must contact an admin directly.
- Reason text is capped at 500 characters, and Firestore rules cap it again server-side.

**Admin side** — a **🔑 PIN Requests** item appears in the nav with a badge showing
how many are open (grant the **PIN Reset Requests** permission to an admin to give
them access). Each request shows the member's name, the contact details they gave,
their reason, and two actions:

- **Set New PIN** — opens a form for a 4-digit PIN, writes the new hash to
  `memberPin/{memberId}`, clears any lockout and stale reset state, then marks the
  request `resolved`. The PIN is shown once, large, so you can read it out or send
  it to the member yourself. It is never stored in plain text, so it cannot be
  looked up again later.
- **Decline** — marks the request `declined`; nothing about the PIN changes.

Handled requests stay visible under **Recently handled** (most recent 20).

### Verifying who you are speaking to

The request form deliberately does **not** try to prove the requester's identity —
the person asking has already forgotten their PIN, so there is nothing to check
against. Anyone can file a request for any member; the control that matters is that
**an admin must verify the member's identity out of band before approving** (call
the phone number on file, confirm details face to face). The admin panel repeats
this warning above the PIN form. Approving a request you have not verified hands a
valid PIN to whoever asked.

Admins can also reset a PIN without a request: **Members → edit a member → Reset PIN**.

## How PINs are stored

PINs are never stored in plain text. Each member gets a `memberPin` document
(doc ID = member ID) holding a random per-member `pinSalt`, the
`pinHash = SHA-256(salt + ':' + pin)`, and lockout bookkeeping. Verification hashes
the entered PIN with the same salt and compares in constant time.

- Wrong PINs are counted in `pinFailedAttempts`; 5 wrong guesses trigger a
  10-minute lockout (`pinLockedUntil`).
- Setting a PIN from the admin panel resets `pinFailedAttempts` and clears
  `pinLockedUntil`, so a locked-out member is never stuck after an approved reset.

### Migrating existing members

Members registered before this change still have their PIN in plain text at
`members/{id}.pin`. Nothing to run — the first successful PIN entry transparently
re-hashes it into `memberPin` and deletes the plain field. To migrate without
waiting, add a temporary admin-only script, or simply ask members to sign in once.

> `members.pin` remains writable in `firestore.rules` purely so that migration can
> delete it. Verification ignores it as soon as a `memberPin` document exists, so
> changing it grants nothing. It can be removed from the rules allowlist once every
> member has been migrated.

## Security Summary

| Service | Rule |
|---|---|
| Firestore `users`, `events`, `attendance`, `settings` | Authenticated admins only |
| Firestore `members` | Public read; public create (registration); updates limited to profile fields |
| Firestore `memberPin` | Public read/create; updates limited to PIN and lockout fields |
| Firestore `pinResetRequests` | Public create (pending only, size-capped); admins read/update/delete |

`pinResetRequests` creates are constrained in `firestore.rules` so a member cannot
file a request that looks already-approved (`status` must be `pending`), cannot
carry unexpected fields, and cannot submit an empty request with no way to reach
them.

### Known limitation

PIN verification runs in the browser, because this app has no server-side code. A
member who knows how to open browser developer tools can read the `members` and
`memberPin` collections and query 10,000 PIN candidates against the hash. The
field-level rules stop a member from *overwriting* someone else's record, but they
cannot verify a hash — Firestore rules have no hashing function.

The per-member request limits above are also client-side, so a determined person can
bypass them by writing directly to Firestore. The cost of that is spam in the admin
queue, not access — nothing becomes resolvable without an admin approving it.

Closing the hashing gap requires a trusted backend: move PIN verification into a
Firebase Cloud Function or a Netlify Function, then make `memberPin` readable only
by admins.

## Done! 🎉

Sign in with the admin account you created and start adding members.
