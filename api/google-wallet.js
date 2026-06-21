import { SignJWT, importPKCS8 } from "jose";

export const config = { runtime: "nodejs" };

async function getAccessToken(saEmail, privateKeyPem) {
  const now = Math.floor(Date.now() / 1000);
  const privateKey = await importPKCS8(privateKeyPem, "RS256");

  const serviceJwt = await new SignJWT({
    iss: saEmail,
    sub: saEmail,
    scope: "https://www.googleapis.com/auth/wallet_object.issuer",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .sign(privateKey);

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: serviceJwt,
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error(`OAuth failed: ${JSON.stringify(tokenData)}`);
  }
  return tokenData.access_token;
}

async function walletRequest(method, path, accessToken, body) {
  const res = await fetch(`https://walletobjects.googleapis.com/walletobjects/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
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

  const { name, spitarId, bloodType, dateOfBirth, allergies = [], medications = [], emergencyContacts = [], cardUrl, hexBackgroundColor = "#dc2626" } = req.body ?? {};
  if (!name || !spitarId) return res.status(400).json({ error: "name and spitarId required" });

  const privateKeyPem = PK_RAW.replace(/\\n/g, "\n");
  const classSuffix   = "spitar-emergency-card";
  const classId       = `${ISSUER_ID}.${classSuffix}`;
  const objectSuffix  = `spitar-${spitarId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
  const objectId      = `${ISSUER_ID}.${objectSuffix}`;

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

  const genericClass = {
    id: classId,
    issuerName: "SPITAR Medical",
  };

  const genericObject = {
    id: objectId,
    classId,
    genericType: "GENERIC_TYPE_UNSPECIFIED",
    state: "ACTIVE",
    hexBackgroundColor: hexBackgroundColor,
    logo: {
      sourceUri: {
        uri: "https://spitar-cld.vercel.app/logo.png",
      },
      contentDescription: {
        defaultValue: { language: "en-US", value: "SPITAR Medical Logo" },
      },
    },
    cardTitle:  { defaultValue: { language: "en-US", value: "SPITAR Emergency Card" } },
    subheader:  { defaultValue: { language: "en-US", value: "Medical Record System" } },
    header:     { defaultValue: { language: "en-US", value: name } },
    barcode: {
      type: "QR_CODE",
      value: cardUrl || `https://spitar-cld.vercel.app/emergency/${spitarId}`,
      alternateText: spitarId,
    },
    textModulesData: textModulesData.length > 0 ? textModulesData : undefined,
  };

  try {
    const accessToken = await getAccessToken(SA_EMAIL, privateKeyPem);

    // Upsert class
    const classCheck = await walletRequest("GET", `genericClass/${encodeURIComponent(classId)}`, accessToken);
    if (classCheck.status === 404) {
      const classCreate = await walletRequest("POST", "genericClass", accessToken, genericClass);
      if (classCreate.status >= 400) {
        return res.status(500).json({ error: `Class create failed: ${JSON.stringify(classCreate.data)}` });
      }
    } else if (classCheck.status >= 400) {
      return res.status(500).json({ error: `Class check failed: ${JSON.stringify(classCheck.data)}` });
    }

    // Upsert object
    const objCheck = await walletRequest("GET", `genericObject/${encodeURIComponent(objectId)}`, accessToken);
    if (objCheck.status === 404) {
      const objCreate = await walletRequest("POST", "genericObject", accessToken, genericObject);
      if (objCreate.status >= 400) {
        return res.status(500).json({ error: `Object create failed: ${JSON.stringify(objCreate.data)}` });
      }
    } else {
      // Update existing object
      const objPatch = await walletRequest("PATCH", `genericObject/${encodeURIComponent(objectId)}`, accessToken, genericObject);
      if (objPatch.status >= 400) {
        return res.status(500).json({ error: `Object patch failed: ${JSON.stringify(objPatch.data)}` });
      }
    }

    // Generate save JWT (just referencing the existing object)
    const privateKey = await importPKCS8(privateKeyPem, "RS256");
    const saveJwt = await new SignJWT({
      iss: SA_EMAIL,
      aud: "google",
      origins: [],
      typ: "savetowallet",
      payload: {
        genericObjects: [{ id: objectId }],
      },
    })
      .setProtectedHeader({ alg: "RS256", typ: "JWT" })
      .setIssuedAt()
      .sign(privateKey);

    return res.status(200).json({ saveUrl: `https://pay.google.com/gp/v/save/${saveJwt}` });
  } catch (err) {
    console.error("Google Wallet error:", err);
    return res.status(500).json({ error: err.message });
  }
}
