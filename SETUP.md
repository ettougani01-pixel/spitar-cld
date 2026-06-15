# SPITAR CLD — Firebase Setup Guide

## 1. Create Firebase Project

1. Go to https://console.firebase.google.com
2. Click "Add project" → name it "spitar-cld"
3. Enable Google Analytics (optional)

## 2. Enable Firebase Services

### Authentication
- Console → Authentication → Get started
- Enable **Email/Password** provider

### Firestore Database
- Console → Firestore Database → Create database
- Start in **production mode**
- Choose region: `europe-west1` (for Morocco)

### Storage (for future file uploads)
- Console → Storage → Get started

## 3. Get Your Config

- Console → Project Settings → Your apps → Add app → Web
- Copy the `firebaseConfig` object values

## 4. Create `.env` File

```
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=spitar-cld.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=spitar-cld
VITE_FIREBASE_STORAGE_BUCKET=spitar-cld.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

## 5. Deploy Firestore Security Rules

```bash
npm install -g firebase-tools
firebase login
firebase init firestore
# Select your project
firebase deploy --only firestore:rules
```

## 6. Create Admin User

After registering as a patient/doctor, change your role to "admin" in Firestore:
- Console → Firestore → users → [your-uid] → Edit → role: "admin"

## 7. Run the App

```bash
npm run dev
```

Visit http://localhost:5173

## Firestore Collections

| Collection | Description |
|---|---|
| `users` | All user profiles (patient, doctor, hospital, lab, admin) |
| `medical_records` | Medical records created by doctors |
| `lab_results` | Lab test results |
| `appointments` | Doctor-patient appointments |
| `access_permissions` | Patient-granted access to doctors/hospitals |
| `hospital_admissions` | Hospital admission records |

## Roles

- **patient** — Can view their own records, manage access permissions
- **doctor** — Can search patients, add medical records, manage appointments
- **lab** — Can upload lab results for patients
- **hospital** — Can admit/discharge patients
- **admin** — Full platform management (set manually in Firestore)
