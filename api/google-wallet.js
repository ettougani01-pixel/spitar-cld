import { SignJWT, importPKCS8 } from "jose";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const ISSUER_ID = process.env.GOOGLE_WALLET_ISSUER_ID;
  const SA_EMAIL  = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const PK_RAW    = process.env.GOOGLE_PRIVATE_KEY;

  if (!ISSUER_ID || !SA_EMAIL || !PK_RAW) {
    return res.status(500).json({ error: "Google Wallet not configured" });
  }

  const { name, spitarId, bloodType, dateOfBirth, allergies = [], medications = [], emergencyContacts = [], cardUrl } = req.body ?? {};
  if (!name || !spitarId) return res.status(400).json({ error: "name and spitarId required" });

  const privateKeyPem = PK_RAW.replace(/\\n/g, "\n");
  const classSuffix   = "spitar-emergency-card";
  const classId       = `${ISSUER_ID}.${classSuffix}`;
  const objectSuffix  = `spitar-${spitarId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
  const objectId      = `${ISSUER_ID}.${objectSuffix}-v2`;

  // Build text modules
  const textModulesData = [
    bloodType   && { id: "blood",   header: "Blood Type",    body: bloodType },
    dateOfBirth && { id: "dob",     header: "Date of Birth", body: dateOfBirth },
    allergies?.length > 0 && {
      id: "allergies",
      header: `Allergies (${allergies.length})`,
      body: allergies.map(a => `${a.allergenName} - ${(a.severity || "").replace("_", " ")}`).join("\n"),
    },
    medications?.length > 0 && {
      id: "meds",
      header: `Medications (${medications.length})`,
      body: medications.map(m => `${m.name} ${m.dosage || ""}`).join("\n"),
    },
    emergencyContacts?.filter(c => c.name || c.phone).length > 0 && {
      id: "contacts",
      header: "Emergency Contacts",
      body: emergencyContacts.filter(c => c.name || c.phone)
        .map(c => `${c.name} (${c.relation}): ${c.phone}`).join("\n"),
    },
  ].filter(Boolean);

  // Generic Pass Class (inline in JWT)
  const genericClass = {
    id: classId,
    issuerName: "SPITAR Medical",
  };

  // Generic Pass Object
  const genericObject = {
    id: objectId,
    classId,
    genericType: "GENERIC_TYPE_UNSPECIFIED",
    state: "ACTIVE",
    hexBackgroundColor: "#dc2626",
    logo: {
      sourceUri: {
        uri: "https://storage.googleapis.com/wallet-lab-tools-codelab-artifacts-public/pass_google_logo.jpg",
      },
      contentDescription: {
        defaultValue: { language: "en-US", value: "SPITAR Medical Logo" },
      },
    },
    cardTitle: {
      defaultValue: { language: "en-US", value: "SPITAR Emergency Card" },
    },
    subheader: {
      defaultValue: { language: "en-US", value: "Medical Record System" },
    },
    header: {
      defaultValue: { language: "en-US", value: name },
    },
    barcode: {
      type: "QR_CODE",
      value: cardUrl || `https://spitar-cld.vercel.app/emergency/${spitarId}`,
      alternateText: spitarId,
    },
    textModulesData: textModulesData.length > 0 ? textModulesData : undefined,
  };

  try {
    const privateKey = await importPKCS8(privateKeyPem, "RS256");

    const jwt = await new SignJWT({
      iss: SA_EMAIL,
      aud: "google",
      origins: [],
      typ: "savetowallet",
      payload: {
        genericClasses: [genericClass],
        genericObjects: [genericObject],
      },
    })
      .setProtectedHeader({ alg: "RS256", typ: "JWT" })
      .setIssuedAt()
      .sign(privateKey);

    return res.status(200).json({ saveUrl: `https://pay.google.com/gp/v/save/${jwt}` });
  } catch (err) {
    console.error("Google Wallet error:", err);
    return res.status(500).json({ error: err.message });
  }
}
