import { SignJWT, importPKCS8 } from "jose";

export const config = { runtime: "nodejs" };

const SCOPES = "https://www.googleapis.com/auth/wallet_object.issuer";
const WALLET_API = "https://walletobjects.googleapis.com/walletobjects/v1";

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
  return resp.json();
}

export default async function handler(req, res) {
  const SA_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const PK_RAW   = process.env.GOOGLE_PRIVATE_KEY;

  if (!SA_EMAIL || !PK_RAW) {
    return res.status(500).json({ error: "Env vars missing" });
  }

  const privateKeyPem = PK_RAW.replace(/\\n/g, "\n");

  try {
    const tokenData = await getAccessToken(SA_EMAIL, privateKeyPem);

    if (!tokenData.access_token) {
      return res.status(500).json({ oauth_error: tokenData });
    }

    // List issuers
    const issuersRes = await fetch(`${WALLET_API}/issuer`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const issuers = await issuersRes.json();

    // Also try listing generic classes with current issuer ID
    const ISSUER_ID = process.env.GOOGLE_WALLET_ISSUER_ID;
    let classesResult = null;
    if (ISSUER_ID) {
      const classesRes = await fetch(
        `${WALLET_API}/genericClass?issuerId=${ISSUER_ID}`,
        { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
      );
      classesResult = await classesRes.json();
    }

    return res.status(200).json({
      service_account: SA_EMAIL,
      current_issuer_id_env: ISSUER_ID,
      issuers_response: issuers,
      classes_response: classesResult,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
