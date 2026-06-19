// Vercel Serverless Function — Google Wallet Generic Pass
// Required env vars in Vercel dashboard:
//   GOOGLE_WALLET_ISSUER_ID   — from pay.google.com/business/console (Issuers section)
//   GOOGLE_SERVICE_ACCOUNT_EMAIL — service account email from Google Cloud
//   GOOGLE_PRIVATE_KEY        — private key (PEM) from service account JSON, replace \n with actual newlines
//
// Setup steps:
//   1. Go to https://pay.google.com/business/console → enable Wallet API
//   2. Create a Generic Pass class, note the Issuer ID
//   3. In Google Cloud Console → IAM → Service Accounts → create key (JSON)
//   4. Add these 3 values to Vercel Environment Variables

import { SignJWT, importPKCS8 } from "jose";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const ISSUER_ID = process.env.GOOGLE_WALLET_ISSUER_ID;
  const SA_EMAIL  = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const PK_RAW    = process.env.GOOGLE_PRIVATE_KEY;

  if (!ISSUER_ID || !SA_EMAIL || !PK_RAW) {
    return res.status(500).json({
      error: "Google Wallet not configured",
      setup: "Add GOOGLE_WALLET_ISSUER_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY to Vercel env vars",
    });
  }

  const { name, spitarId, bloodType, dateOfBirth, allergies = [], medications = [], emergencyContacts = [], cardUrl } = req.body ?? {};

  if (!name || !spitarId) return res.status(400).json({ error: "name and spitarId are required" });

  const objectId = `${ISSUER_ID}.spitar-${spitarId}-${Date.now()}`;

  // Build text modules
  const textModules = [
    bloodType   && { id: "blood",   header: "Blood Type",    body: bloodType },
    dateOfBirth && { id: "dob",     header: "Date of Birth", body: dateOfBirth },
    allergies.length > 0 && {
      id: "allergies",
      header: `⚠️ Allergies (${allergies.length})`,
      body: allergies.map(a => `${a.allergenName} — ${a.severity?.replace("_", " ")}`).join("\n"),
    },
    medications.length > 0 && {
      id: "medications",
      header: `💊 Medications (${medications.length})`,
      body: medications.map(m => `${m.name} ${m.dosage ?? ""}`).join("\n"),
    },
    emergencyContacts.filter(c => c.name || c.phone).length > 0 && {
      id: "contacts",
      header: "📞 Emergency Contacts",
      body: emergencyContacts.filter(c => c.name || c.phone).map(c => `${c.name} (${c.relation}): ${c.phone}`).join("\n"),
    },
  ].filter(Boolean);

  const genericObject = {
    id: objectId,
    classId: `${ISSUER_ID}.spitar-emergency-card`,
    genericType: "GENERIC_TYPE_UNSPECIFIED",
    hexBackgroundColor: "#dc2626",
    logo: {
      sourceUri: {
        uri: "https://storage.googleapis.com/wallet-lab-tools-codelab-artifacts-public/pass_google_logo.jpg",
      },
    },
    cardTitle: {
      defaultValue: { language: "en", value: "SPITAR Emergency Card" },
    },
    subheader: {
      defaultValue: { language: "en", value: "Medical Record System" },
    },
    header: {
      defaultValue: { language: "en", value: name },
    },
    textModulesData: textModules,
    barcode: {
      type: "QR_CODE",
      value: cardUrl || `https://spitar-cld.vercel.app/emergency/${spitarId}`,
      alternateText: spitarId,
    },
    validTimeInterval: {
      start: { date: new Date().toISOString() },
    },
  };

  const payload = {
    iss: SA_EMAIL,
    aud: "google",
    origins: ["https://spitar-cld.vercel.app", "http://localhost:5173"],
    typ: "savetowallet",
    payload: { genericObjects: [genericObject] },
  };

  try {
    const privateKey = await importPKCS8(PK_RAW.replace(/\\n/g, "\n"), "RS256");
    const jwt = await new SignJWT(payload)
      .setProtectedHeader({ alg: "RS256" })
      .setIssuedAt()
      .sign(privateKey);

    const saveUrl = `https://pay.google.com/gp/v/save/${jwt}`;
    return res.status(200).json({ saveUrl });
  } catch (err) {
    console.error("Google Wallet JWT signing error:", err);
    return res.status(500).json({ error: "Failed to sign JWT", detail: err.message });
  }
}
