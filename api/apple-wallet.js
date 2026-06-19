// Vercel Serverless Function — Apple Wallet (.pkpass)
// Required env vars in Vercel dashboard:
//   APPLE_TEAM_IDENTIFIER      — 10-char Team ID from developer.apple.com (e.g. "ABCD123456")
//   APPLE_PASS_TYPE_IDENTIFIER — Pass Type ID (e.g. "pass.com.yourcompany.emergency")
//   APPLE_CERT_PEM             — Signing certificate in PEM format
//   APPLE_PRIVATE_KEY_PEM      — Private key in PEM format
//   APPLE_WWDR_PEM             — Apple WWDR G4 certificate (download from developer.apple.com)
//
// Setup steps:
//   1. Enroll in Apple Developer Program ($99/year)
//   2. developer.apple.com → Certificates → Pass Type IDs → create one
//   3. Create & download the certificate, export with private key
//   4. Convert to PEM: openssl pkcs12 -in Certificates.p12 -out cert.pem -clcerts -nokeys
//   5. Add all env vars to Vercel

import JSZip from "jszip";
import crypto from "crypto";

export const config = { runtime: "nodejs" };

function signManifest(manifestJson, certPem, keyPem, wwdrPem) {
  const p7 = crypto.createSign("SHA1");
  p7.update(manifestJson);
  // In production, use node-forge or @peculiar/webcrypto for proper PKCS7 signing
  // This is a simplified placeholder — replace with proper PKCS#7 signing in production
  throw new Error("PKCS7 signing requires additional setup — see api/apple-wallet.js comments");
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const TEAM_ID    = process.env.APPLE_TEAM_IDENTIFIER;
  const PASS_TYPE  = process.env.APPLE_PASS_TYPE_IDENTIFIER;
  const CERT_PEM   = process.env.APPLE_CERT_PEM;
  const KEY_PEM    = process.env.APPLE_PRIVATE_KEY_PEM;
  const WWDR_PEM   = process.env.APPLE_WWDR_PEM;

  if (!TEAM_ID || !PASS_TYPE || !CERT_PEM || !KEY_PEM || !WWDR_PEM) {
    return res.status(500).json({
      error: "Apple Wallet not configured",
      setup: "Add APPLE_TEAM_IDENTIFIER, APPLE_PASS_TYPE_IDENTIFIER, APPLE_CERT_PEM, APPLE_PRIVATE_KEY_PEM, APPLE_WWDR_PEM to Vercel env vars",
      instructions: [
        "1. Enroll in Apple Developer Program at developer.apple.com ($99/year)",
        "2. Create a Pass Type ID under Identifiers",
        "3. Create & download the signing certificate",
        "4. Export with private key as .p12, convert to PEM",
        "5. Download WWDR G4 certificate from developer.apple.com/certificationauthority",
        "6. Add all 5 env vars to Vercel dashboard",
      ],
    });
  }

  const { name, spitarId, bloodType, dateOfBirth, allergies = [], medications = [], emergencyContacts = [], cardUrl } = req.body ?? {};

  if (!name || !spitarId) return res.status(400).json({ error: "name and spitarId required" });

  // Build pass.json
  const pass = {
    formatVersion: 1,
    passTypeIdentifier: PASS_TYPE,
    serialNumber: `spitar-${spitarId}-${Date.now()}`,
    teamIdentifier: TEAM_ID,
    organizationName: "SPITAR Medical",
    description: "Emergency Medical Card",
    foregroundColor: "rgb(255, 255, 255)",
    backgroundColor: "rgb(220, 38, 38)",
    labelColor: "rgb(255, 200, 200)",
    logoText: "SPITAR",
    generic: {
      primaryFields: [
        { key: "name", label: "PATIENT", value: name },
      ],
      secondaryFields: [
        { key: "blood", label: "BLOOD TYPE", value: bloodType ?? "Unknown" },
        { key: "dob",   label: "DATE OF BIRTH", value: dateOfBirth ?? "—" },
      ],
      auxiliaryFields: [
        {
          key: "allergies",
          label: "ALLERGIES",
          value: allergies.length > 0
            ? allergies.map(a => a.allergenName).join(", ")
            : "None on record",
        },
        {
          key: "medications",
          label: "MEDICATIONS",
          value: medications.length > 0
            ? medications.map(m => m.name).join(", ")
            : "None on record",
        },
      ],
      backFields: [
        { key: "spitar_id", label: "SPITAR ID", value: spitarId },
        {
          key: "emergency_contacts",
          label: "EMERGENCY CONTACTS",
          value: emergencyContacts.filter(c => c.name || c.phone).map(c => `${c.name} (${c.relation}): ${c.phone}`).join("\n") || "Not provided",
        },
        {
          key: "full_card",
          label: "VIEW FULL CARD",
          value: cardUrl || `https://spitar-cld.vercel.app/emergency/${spitarId}`,
          attributedValue: `<a href='${cardUrl || `https://spitar-cld.vercel.app/emergency/${spitarId}`}'>Open Full Card</a>`,
        },
        { key: "powered_by", label: "POWERED BY", value: "SPITAR Medical Record System" },
      ],
    },
    barcode: {
      message: cardUrl || `https://spitar-cld.vercel.app/emergency/${spitarId}`,
      format: "PKBarcodeFormatQR",
      messageEncoding: "iso-8859-1",
      altText: spitarId,
    },
    barcodes: [{
      message: cardUrl || `https://spitar-cld.vercel.app/emergency/${spitarId}`,
      format: "PKBarcodeFormatQR",
      messageEncoding: "iso-8859-1",
      altText: spitarId,
    }],
  };

  const passJson = JSON.stringify(pass);

  // Create zip and compute manifest
  const zip = new JSZip();
  zip.file("pass.json", passJson);

  // Compute SHA1 hashes for manifest
  const manifest = {
    "pass.json": crypto.createHash("sha1").update(passJson).digest("hex"),
  };
  const manifestJson = JSON.stringify(manifest);
  zip.file("manifest.json", manifestJson);

  try {
    // Sign manifest — requires proper PKCS#7 signing with node-forge
    // For production, install: npm install node-forge
    // Then use forge to create a detached PKCS#7 signature
    const forge = await import("node-forge").catch(() => null);
    if (!forge) {
      return res.status(500).json({
        error: "node-forge not installed",
        fix: "Run: npm install node-forge in the project, then redeploy",
      });
    }

    const cert = forge.pki.certificateFromPem(CERT_PEM);
    const key  = forge.pki.privateKeyFromPem(KEY_PEM);
    const wwdr = forge.pki.certificateFromPem(WWDR_PEM);

    const p7 = forge.pkcs7.createSignedData();
    p7.content = forge.util.createBuffer(manifestJson, "utf8");
    p7.addCertificate(cert);
    p7.addCertificate(wwdr);
    p7.addSigner({
      key,
      certificate: cert,
      digestAlgorithm: forge.pki.oids.sha1,
      authenticatedAttributes: [
        { type: forge.pki.oids.contentType,   value: forge.pki.oids.data },
        { type: forge.pki.oids.messageDigest              },
        { type: forge.pki.oids.signingTime,   value: new Date() },
      ],
    });
    p7.sign({ detached: true });

    const der    = forge.asn1.toDer(p7.toAsn1()).getBytes();
    const sigBuf = Buffer.from(der, "binary");
    zip.file("signature", sigBuf);

    const pkpass = await zip.generateAsync({ type: "nodebuffer" });

    res.setHeader("Content-Type", "application/vnd.apple.pkpass");
    res.setHeader("Content-Disposition", `attachment; filename="${spitarId}-emergency.pkpass"`);
    return res.status(200).send(pkpass);
  } catch (err) {
    console.error("Apple Wallet signing error:", err);
    return res.status(500).json({ error: "Failed to generate .pkpass", detail: err.message });
  }
}
