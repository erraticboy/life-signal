# Firebase Authentication Setup Guide (Google OAuth + Email/Password)

LIFE SIGNAL uses **real Firebase Authentication** on the client and **Firebase Admin SDK ID token verification** on the FastAPI backend. No simulated login or dummy accounts are used.

---

## Step 1: Create the Firebase Project

1. Open [Firebase Console](https://console.firebase.google.com/).
2. Click **Add project** and name it **LIFE SIGNAL**.
3. Complete project creation (Google Analytics is optional).

## Step 2: Register a Web App

1. In Project Overview, click the **Web (`</>`)** icon to register a web app (e.g., `life-signal-web`).
2. Copy the `firebaseConfig` fields into `frontend/.env`:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`

## Step 3: Enable Sign-in Providers

1. Open **Build → Authentication → Sign-in method**.
2. Enable **Email/Password**.
3. Enable **Google**, set a support email, and click **Save**.

## Step 4: Configure Authorized Domains

1. Open **Authentication → Settings → Authorized domains**.
2. Confirm `localhost` and `127.0.0.1` are present for local development.
3. Add your production frontend domain (e.g., `life-signal.vercel.app`) before deploying.

## Step 5: Generate Firebase Admin SDK Credentials (Backend)

1. Open **Project Settings → Service accounts**.
2. Click **Generate new private key** and download the JSON file.
3. Save it securely outside git (for example `backend/credentials/firebase-adminsdk.json` — gitignored).
4. In `backend/.env`, set:
   ```env
   FIREBASE_PROJECT_ID=your-firebase-project-id
   FIREBASE_SERVICE_ACCOUNT_PATH=./credentials/firebase-adminsdk.json
   ```
   *(For cloud deployments like Render or Railway, you can paste the minified JSON directly into `FIREBASE_SERVICE_ACCOUNT_JSON` instead of mounting a file.)*

## Step 6: Configure Initial Administrator Accounts

Never assign admin roles from the browser. Specify verified administrator email addresses in `backend/.env`:

```env
ADMIN_BOOTSTRAP_EMAILS=admin@city.gov.in,lead@lifesignal.org
```

> Only accounts whose Firebase ID token reports `email_verified: true` are eligible for automatic bootstrap promotion. You can also promote an existing user from the backend CLI:
> ```powershell
> python -m app.scripts.manage_roles --email admin@example.com --role admin
> ```

