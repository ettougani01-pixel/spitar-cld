import { SignJWT, importPKCS8 } from "jose";

export const config = { runtime: "nodejs" };

const WALLET_API = "https://walletobjects.googleapis.com/walletobjects/v1";
const SCOPES = "https://www.googleapis.com/auth/wallet_object.issuer";

// Get OAuth2 access token using service account JWT
async function getAccessToken(saEmail, privateKeyPem) {
  const now = Math.floor(Date.now() / 1000);
  const privateKey = await importPKCS8(privateKeyPem, "RS256");

  const assertion = await new SignJWT({
    scope: SCOPES,
    aud: "https://oauth2.googleapis.com/token",
    iss: saEmail,
    iat: now,
    exp: now + 3600,
  })
    .setProtectedHeader({ alg: "RS256" })
    .sign(privateKey);

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  const data = await resp.json();
  if (!data.access_token) throw new Error(`OAuth2 failed: ${JSON.stringify(data)}`);
  return data.access_token;
}

// Create or update the Generic Pass class
async function upsertClass(issuerId, accessToken) {
  const classId = `${issuerId}.spitar-emergency-card`;

  // Check if class exists
  const checkRes = await fetch(`${WALLET_API}/genericClass/${classId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (checkRes.status === 200) return classId; // Already exists

  // Create the class
  const body = {
    id: classId,
    issuerName: "SPITAR Medical",
    reviewStatus: "UNDER_REVIEW",
    enableSmartTap: false,
  };

  const createRes = await fetch(`${WALLET_API}/genericClass`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!createRes.ok) {
    const err = await createRes.json();
    throw new Error(`Class creation failed: ${JSON.stringify(err)}`);
  }

  return classId;
}

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

  try {
    // 1. Get OAuth2 access token
    const accessToken = await getAccessToken(SA_EMAIL, privateKeyPem);

    // 2. Ensure pass class exists
    const classId = await upsertClass(ISSUER_ID, accessToken);

    // 3. Build text modules
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

    // 4. Build the Generic Object
    const objectId = `${ISSUER_ID}.spitar-${spitarId.replace(/[^a-zA-Z0-9_-]/g, "_")}-${Date.now()}`;
    const genericObject = {
      id: objectId,
      classId,
      genericType: "GENERIC_TYPE_UNSPECIFIED",
      hexBackgroundColor: "#dc2626",
      logo: {
        sourceUri: { uri: "https://storage.googleapis.com/wallet-lab-tools-codelab-artifacts-public/pass_google_logo.jpg" },
      },
      cardTitle:  { defaultValue: { language: "en", value: "SPITAR Emergency Card" } },
      subheader:  { defaultValue: { language: "en", value: "Medical Record System" } },
      header:     { defaultValue: { language: "en", value: name } },
      textModulesData: textModules,
      barcode: {
        type: "QR_CODE",
        value: cardUrl || `https://spitar-cld.vercel.app/emergency/${spitarId}`,
        alternateText: spitarId,
      },
    };

    // 5. Sign JWT for "Save to Wallet"
    const privateKey = await importPKCS8(privateKeyPem, "RS256");
    const jwt = await new SignJWT({
      iss: SA_EMAIL,
      aud: "google",
      origins: ["https://spitar-cld.vercel.app", "http://localhost:5173"],
      typ: "savetowallet",
      payload: { genericObjects: [genericObject] },
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
