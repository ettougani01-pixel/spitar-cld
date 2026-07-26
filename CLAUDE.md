# SPITAR CLD — Claude Project Context

## Project Overview
A React + Vite + TypeScript patient health management SPA deployed on Vercel via GitHub auto-deploy.

- **Live URL:** https://spitar-cld.vercel.app
- **GitHub:** https://github.com/ettougani01-pixel/spitar-cld
- **Firebase Project ID:** `spitar-cld`

## Tech Stack
- **Frontend:** React 18 + Vite + TypeScript
- **Auth & DB:** Firebase Auth + Firestore
- **i18n:** `react-i18next` — translation files in `src/i18n/en.json`, `ar.json`, `fr.json`
- **UI:** Custom inline styles (no Tailwind), Lucide icons, shadcn/ui dialogs
- **QR Code:** `qrcode.react` (`QRCodeSVG`)
- **Deployment:** Vercel (auto-deploys on push to `main`)

## Key Patterns

### i18n
```tsx
const { t, i18n } = useTranslation();
const isAr = i18n.language === "ar";
// Use t("section.key") for all user-facing text
```

### Firestore Rules
File: `firestore.rules`
Deploy with: `firebase deploy --only firestore:rules --project spitar-cld`
**Important:** Every collection the app writes to must have explicit rules or writes fail silently.

### Auth
```tsx
const { user } = useAuth(); // from src/contexts/AuthContext
```

## Project Structure
```
src/
  pages/
    Landing.tsx              # Landing page with permanent QR for logged-in patients
    Profile.tsx              # Patient/doctor profile page
    dashboards/
      PatientDashboard.tsx   # Main patient dashboard (activeSection state machine)
      DoctorDashboard.tsx    # Doctor dashboard
  components/
    HealthProfileContent.tsx # Health profile with vaccinations, allergies, etc.
    TreatmentPlan.tsx        # PatientTreatmentPlan + DoctorTreatmentPlan
    EmergencyCardManager.tsx # Emergency card (permanent ID = user.uid)
  i18n/
    en.json / ar.json / fr.json
firestore.rules
```

## PatientDashboard Navigation
Uses two state variables:
- `activeSection` — which major page is shown (overview, medical_records, emergency, health_profile, my_team, appointments, labs, share_qr, report, teleconsult, chat)
- `activeTab` — which tab within overview (summaries, referrals, treatment)

**Default:** `activeSection = "overview"`, `activeTab = "treatment"`

Sidebar nav items use `setActiveSection(...)` onClick.
Stat cards on overview also navigate via `setActiveSection(...)`.

## Firestore Collections
- `users` — user profiles (patientId, role, firstName, lastName, etc.)
- `medical_records` — patient medical records (patientId, type, title, doctorName, date)
- `patient_vaccinations` — vaccination records (patientId)
- `patient_visits` — visit records (patientId)
- `appointments` — appointments (patientId, doctorId, date)
- `lab_results` — lab results (patientId)
- `access_permissions` — doctor access to patient data (patientId, isActive)
- `treatment_plans` — weekly treatment plans (patientId, day, time, activity)
- `medications` — patient medications
- `health_profiles` — extended health data (allergies, chronicConditions, etc.)

## Moroccan Vaccination Schedule
Defined as `MOROCCO_VACCINES` constant in `src/components/HealthProfileContent.tsx`.
10 age groups from "First 24 hours" to "Pregnant/Women" with English + Arabic names.

## Profile Completeness
Both `Profile.tsx` and `HealthProfileContent.tsx` calculate completeness.
They use the same 16+ fields with `t("profile.field_*")` keys.
"Answered" flags: `allergiesAnswered`, `familyHistoryAnswered`, `sideEffectsAnswered`, `chronicConditionsAnswered` stored in Firestore `health_profiles`.

## Emergency Card
- Permanent card URL: `${window.location.origin}/emergency/${user.uid}`
- Accessible without login at `/emergency/:id`
- Google Wallet integration in Emergency Card tab

## Deploy Workflow
```bash
git add .
git commit -m "description"
git push origin main
# Vercel auto-deploys in ~1-2 minutes
```
