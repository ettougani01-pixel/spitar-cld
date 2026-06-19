import { useState, useEffect, useRef } from "react";
import { doc, getDoc, setDoc, addDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import {
  ShieldAlert, Link2, QrCode, Copy, Check, Clock,
  Download, Wallet, AlertTriangle, Pill, Phone, Heart, User,
  Printer, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";

interface Allergy { allergenName: string; severity: string; reaction: string; }
interface Medication { name: string; dosage: string; frequency: string; }
interface EmergencyContact { name: string; phone: string; relation: string; }

interface CardData {
  name: string;
  spitarId: string;
  bloodType?: string;
  dateOfBirth?: string;
  phone?: string;
  emergencyContacts: EmergencyContact[];
  allergies: Allergy[];
  medications: Medication[];
}

const SEVERITY_COLOR: Record<string, string> = {
  life_threatening: "#dc2626",
  severe: "#ea580c",
  moderate: "#d97706",
  mild: "#16a34a",
};

export function EmergencyCardManager() {
  const { user } = useAuth();
  const [permanentId, setPermanentId] = useState<string | null>(null);
  const [tempLink, setTempLink] = useState<string | null>(null);
  const [tempExpiry, setTempExpiry] = useState<number | null>(null);
  const [copied, setCopied] = useState<"perm" | "temp" | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [cardData, setCardData] = useState<CardData | null>(null);
  const [downloading, setDownloading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getDoc(doc(db, "emergency_cards", user.uid)),
      getDocs(query(collection(db, "patient_allergies"), where("patientId", "==", user.uid))),
      getDocs(query(collection(db, "patient_medications"), where("patientId", "==", user.uid))),
    ]).then(([cardDoc, allergySnap, medSnap]) => {
      if (cardDoc.exists()) setPermanentId(user.uid);

      const u = user as any;
      let emergencyContacts: EmergencyContact[] = [];
      if (u.emergencyContacts && u.emergencyContacts.length > 0) {
        emergencyContacts = u.emergencyContacts;
      } else if (u.emergencyContactName || u.emergencyContactPhone) {
        emergencyContacts = [{ name: u.emergencyContactName ?? "", phone: u.emergencyContactPhone ?? "", relation: "Other" }];
      }

      setCardData({
        name: `${u.firstName} ${u.lastName}`,
        spitarId: u.spitarId,
        bloodType: u.bloodType,
        dateOfBirth: u.dateOfBirth,
        phone: u.phone,
        emergencyContacts,
        allergies: allergySnap.docs.map(d => d.data() as Allergy),
        medications: medSnap.docs.map(d => d.data() as Medication),
      });
      setLoading(false);
    });
  }, [user]);

  const createPermanentCard = async () => {
    if (!user) return;
    setGenerating(true);
    try {
      await setDoc(doc(db, "emergency_cards", user.uid), {
        patientId: user.uid,
        permanent: true,
        createdAt: new Date().toISOString(),
      });
      setPermanentId(user.uid);
    } finally { setGenerating(false); }
  };

  const createTempLink = async () => {
    if (!user) return;
    setGenerating(true);
    try {
      const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
      const ref = await addDoc(collection(db, "emergency_cards"), {
        patientId: user.uid,
        permanent: false,
        expiresAt,
        createdAt: new Date().toISOString(),
      });
      setTempLink(`${window.location.origin}/emergency/${ref.id}`);
      setTempExpiry(expiresAt);
    } finally { setGenerating(false); }
  };

  const copyLink = async (link: string, type: "perm" | "temp") => {
    await navigator.clipboard.writeText(link);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const permanentUrl = permanentId ? `${window.location.origin}/emergency/${permanentId}` : null;

  // Download card as PNG using Canvas API
  const downloadCardAsImage = async () => {
    if (!cardData) return;
    setDownloading(true);
    try {
      const canvas = document.createElement("canvas");
      const W = 800, H = 520;
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d")!;

      const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
      };

      // White background
      ctx.fillStyle = "#f1f5f9";
      ctx.fillRect(0, 0, W, H);

      // Header gradient
      const grad = ctx.createLinearGradient(0, 0, W, 160);
      grad.addColorStop(0, "#dc2626");
      grad.addColorStop(1, "#b91c1c");
      ctx.fillStyle = grad;
      roundRect(16, 16, W - 32, 130, 18);
      ctx.fill();

      // Decorative circle
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.beginPath();
      ctx.arc(W - 60, 30, 100, 0, Math.PI * 2);
      ctx.fill();

      // Header text
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = "bold 11px Arial";
      ctx.letterSpacing = "2px";
      ctx.fillText("EMERGENCY MEDICAL CARD — SPITAR", 32, 48);

      ctx.fillStyle = "#fff";
      ctx.font = "bold 24px Arial";
      ctx.fillText(cardData.name, 32, 80);

      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = "13px Arial";
      ctx.fillText(`ID: ${cardData.spitarId}`, 32, 102);
      if (cardData.bloodType) {
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.font = "bold 20px Arial";
        ctx.fillText(`Blood: ${cardData.bloodType}`, 32, 128);
      }
      if (cardData.dateOfBirth) {
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.font = "13px Arial";
        ctx.fillText(`DOB: ${cardData.dateOfBirth}`, 220, 128);
      }

      // Sections
      let y = 165;

      // Emergency Contacts
      if (cardData.emergencyContacts.filter(c => c.name || c.phone).length > 0) {
        ctx.fillStyle = "#fff";
        roundRect(16, y, W - 32, 14 + cardData.emergencyContacts.length * 26 + 16, 12);
        ctx.fill();

        ctx.fillStyle = "#0d9488";
        ctx.font = "bold 13px Arial";
        ctx.fillText("📞 Emergency Contacts", 30, y + 18);
        let cy = y + 36;
        for (const c of cardData.emergencyContacts.filter(c => c.name || c.phone)) {
          ctx.fillStyle = "#0f172a";
          ctx.font = "bold 13px Arial";
          ctx.fillText(c.name, 30, cy);
          ctx.fillStyle = "#64748b";
          ctx.font = "12px Arial";
          ctx.fillText(`${c.relation} · ${c.phone}`, 200, cy);
          cy += 26;
        }
        y += 14 + cardData.emergencyContacts.length * 26 + 20;
      }

      // Allergies
      const allergies = cardData.allergies;
      if (allergies.length > 0) {
        ctx.fillStyle = "#fff";
        roundRect(16, y, W / 2 - 24, 14 + allergies.length * 24 + 16, 12);
        ctx.fill();
        ctx.strokeStyle = "#fca5a5";
        ctx.lineWidth = 1.5;
        roundRect(16, y, W / 2 - 24, 14 + allergies.length * 24 + 16, 12);
        ctx.stroke();

        ctx.fillStyle = "#dc2626";
        ctx.font = "bold 13px Arial";
        ctx.fillText(`⚠️ Allergies (${allergies.length})`, 30, y + 18);
        let ay = y + 36;
        for (const a of allergies) {
          ctx.fillStyle = "#0f172a";
          ctx.font = "bold 12px Arial";
          ctx.fillText(a.allergenName, 30, ay);
          ctx.fillStyle = SEVERITY_COLOR[a.severity] ?? "#64748b";
          ctx.font = "11px Arial";
          ctx.fillText(a.severity?.replace("_", " ") ?? "", 200, ay);
          ay += 24;
        }
      }

      // Medications
      const meds = cardData.medications;
      if (meds.length > 0) {
        const mx = W / 2 + 8;
        const mw = W / 2 - 24;
        ctx.fillStyle = "#fff";
        roundRect(mx, y, mw, 14 + meds.length * 24 + 16, 12);
        ctx.fill();

        ctx.fillStyle = "#2563eb";
        ctx.font = "bold 13px Arial";
        ctx.fillText(`💊 Medications (${meds.length})`, mx + 14, y + 18);
        let my = y + 36;
        for (const m of meds) {
          ctx.fillStyle = "#0f172a";
          ctx.font = "bold 12px Arial";
          ctx.fillText(m.name, mx + 14, my);
          ctx.fillStyle = "#64748b";
          ctx.font = "11px Arial";
          ctx.fillText(m.dosage ?? "", mx + 180, my);
          my += 24;
        }
      }

      // Footer
      ctx.fillStyle = "#94a3b8";
      ctx.font = "11px Arial";
      ctx.fillText("Powered by SPITAR · Emergency Medical Record System · spitar-cld.vercel.app", 16, H - 16);

      // Download
      canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob!);
        const a = document.createElement("a");
        a.href = url;
        a.download = `emergency-card-${cardData.spitarId}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }, "image/png");
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── CARD PREVIEW ── */}
      {cardData && (
        <div ref={cardRef} style={{ borderRadius: 18, overflow: "hidden", border: "1px solid #e2e8f0", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
          {/* Header */}
          <div style={{ background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)", padding: "20px 22px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,0.07)" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 14, position: "relative" }}>
              <div style={{ width: 50, height: 50, borderRadius: 14, background: "rgba(255,255,255,0.2)", border: "2px solid rgba(255,255,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <ShieldAlert size={22} style={{ color: "#fff" }} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 10, fontWeight: 700, margin: "0 0 2px", letterSpacing: "0.1em" }}>EMERGENCY MEDICAL CARD · SPITAR</p>
                <p style={{ color: "#fff", fontSize: 20, fontWeight: 800, margin: 0 }}>{cardData.name}</p>
                <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, margin: "2px 0 0" }}>{cardData.spitarId}</p>
              </div>
              <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
                <div style={{ textAlign: "center", background: "rgba(255,255,255,0.15)", borderRadius: 10, padding: "8px 14px" }}>
                  <p style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", margin: "0 0 2px", fontWeight: 600 }}>BLOOD TYPE</p>
                  <p style={{ fontSize: 22, fontWeight: 900, color: "#fff", margin: 0 }}>{cardData.bloodType ?? "?"}</p>
                </div>
                {cardData.dateOfBirth && (
                  <div style={{ textAlign: "center", background: "rgba(255,255,255,0.15)", borderRadius: 10, padding: "8px 14px" }}>
                    <p style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", margin: "0 0 2px", fontWeight: 600 }}>DATE OF BIRTH</p>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: 0 }}>{cardData.dateOfBirth}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Body */}
          <div style={{ background: "#fff", padding: "0 0 4px" }}>
            <div style={{ display: "grid", gridTemplateColumns: cardData.allergies.length > 0 && cardData.medications.length > 0 ? "1fr 1fr" : "1fr", gap: 0 }}>

              {/* Emergency Contacts */}
              {(cardData.phone || cardData.emergencyContacts.filter(c => c.name || c.phone).length > 0) && (
                <div style={{ gridColumn: "1 / -1", padding: "14px 18px", borderBottom: "1px solid #f1f5f9" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <Phone size={13} style={{ color: "#0d9488" }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#0d9488", textTransform: "uppercase", letterSpacing: "0.06em" }}>Emergency Contacts</span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {cardData.phone && (
                      <div style={{ padding: "6px 12px", background: "#f0fdf4", borderRadius: 8, border: "1px solid #bbf7d0" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>Patient: </span>
                        <a href={`tel:${cardData.phone}`} style={{ fontSize: 12, fontWeight: 700, color: "#0d9488", textDecoration: "none" }}>{cardData.phone}</a>
                      </div>
                    )}
                    {cardData.emergencyContacts.filter(c => c.name || c.phone).map((c, i) => (
                      <div key={i} style={{ padding: "6px 12px", background: "#f0fdf4", borderRadius: 8, border: "1px solid #bbf7d0" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{c.name} <span style={{ fontWeight: 400, color: "#64748b" }}>({c.relation})</span>: </span>
                        {c.phone && <a href={`tel:${c.phone}`} style={{ fontSize: 12, fontWeight: 700, color: "#0d9488", textDecoration: "none" }}>{c.phone}</a>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Allergies */}
              {cardData.allergies.length > 0 && (
                <div style={{ padding: "14px 18px", borderRight: cardData.medications.length > 0 ? "1px solid #f1f5f9" : "none", borderBottom: "1px solid #f1f5f9" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <AlertTriangle size={13} style={{ color: "#dc2626" }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#dc2626", textTransform: "uppercase", letterSpacing: "0.06em" }}>Allergies</span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 20, background: "#fee2e2", color: "#dc2626" }}>{cardData.allergies.length}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {cardData.allergies.map((a, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", borderRadius: 8, background: "#fef2f2", border: "1px solid #fecaca" }}>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", margin: 0 }}>{a.allergenName}</p>
                          <p style={{ fontSize: 10, color: "#64748b", margin: 0 }}>{a.reaction}</p>
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: (SEVERITY_COLOR[a.severity] ?? "#64748b") + "22", color: SEVERITY_COLOR[a.severity] ?? "#64748b", flexShrink: 0 }}>
                          {a.severity?.replace("_", " ")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Medications */}
              {cardData.medications.length > 0 && (
                <div style={{ padding: "14px 18px", borderBottom: "1px solid #f1f5f9" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <Pill size={13} style={{ color: "#2563eb" }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#2563eb", textTransform: "uppercase", letterSpacing: "0.06em" }}>Current Medications</span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 20, background: "#dbeafe", color: "#2563eb" }}>{cardData.medications.length}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {cardData.medications.map((m, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", borderRadius: 8, background: "#f0f9ff", border: "1px solid #bae6fd" }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", margin: 0 }}>{m.name}</p>
                        <div style={{ textAlign: "right" }}>
                          <p style={{ fontSize: 12, fontWeight: 700, color: "#2563eb", margin: 0 }}>{m.dosage}</p>
                          <p style={{ fontSize: 10, color: "#64748b", margin: 0 }}>{m.frequency}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty states */}
              {cardData.allergies.length === 0 && cardData.medications.length === 0 && (
                <div style={{ gridColumn: "1 / -1", padding: "16px 18px", color: "#94a3b8", fontSize: 13, textAlign: "center", borderBottom: "1px solid #f1f5f9" }}>
                  No allergies or medications on record. Update your Health Profile to add them.
                </div>
              )}
            </div>

            {/* Action bar */}
            <div style={{ padding: "14px 18px", display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", background: "#fafafa", borderTop: "1px solid #f1f5f9" }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#64748b", margin: 0, flexGrow: 1 }}>Save or share this card:</p>

              {/* Download as PNG */}
              <button
                onClick={downloadCardAsImage}
                disabled={downloading}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 10, background: "linear-gradient(135deg, #2563eb, #0891b2)", color: "#fff", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              >
                <Download size={14} /> {downloading ? "Saving..." : "Download as Image"}
              </button>

              {/* Print */}
              {permanentUrl && (
                <button
                  onClick={() => window.open(permanentUrl, "_blank")}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 10, background: "#fff", color: "#0f172a", border: "1.5px solid #e2e8f0", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                >
                  <Printer size={14} /> Print Card
                </button>
              )}

              {/* Google Wallet */}
              <button
                onClick={downloadCardAsImage}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 10, background: "#fff", color: "#1a73e8", border: "1.5px solid #1a73e8", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                title="Download card image and set as lock screen wallpaper for quick access"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" fill="#1a73e8"/>
                </svg>
                Google Wallet *
              </button>

              {/* Apple Wallet */}
              <button
                onClick={downloadCardAsImage}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 10, background: "#000", color: "#fff", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                title="Download card image and add to Apple Wallet via Shortcuts app"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" fill="white"/>
                </svg>
                Apple Wallet *
              </button>
            </div>

            {/* Wallet note */}
            <div style={{ padding: "10px 18px", background: "#fffbeb", borderTop: "1px solid #fef3c7" }}>
              <p style={{ fontSize: 11, color: "#92400e", margin: 0 }}>
                <strong>* Wallet integration:</strong> Download the card image → Android: add to Google Photos widget or use "Passes" app. iPhone: use the Shortcuts app "Add to Wallet" or save as lock screen. For best results, print the QR code and keep it in your physical wallet.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── PERMANENT EMERGENCY CARD (QR) ── */}
      <div style={{ background: "#fff", border: "1.5px solid #fca5a5", borderRadius: 16, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg, #dc2626, #b91c1c)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ShieldAlert size={18} style={{ color: "#fff" }} />
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", margin: 0 }}>Permanent Emergency Card</p>
            <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>Always accessible — no expiry. Scan to view full medical card.</p>
          </div>
        </div>

        {!permanentId ? (
          <div>
            <p style={{ fontSize: 12, color: "#94a3b8", marginBottom: 12 }}>
              Create a permanent QR code that emergency responders can scan anytime — even when you're unconscious.
            </p>
            <Button onClick={createPermanentCard} disabled={generating} style={{ background: "linear-gradient(135deg, #dc2626, #b91c1c)", color: "#fff", border: "none" }}>
              <ShieldAlert size={14} style={{ marginRight: 6 }} />
              {generating ? "Creating..." : "Create Emergency Card"}
            </Button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 10 }}>
              <QRCodeSVG value={permanentUrl!} size={130} level="H" includeMargin />
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#16a34a", marginBottom: 8 }}>✓ Emergency card active</p>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <input
                  readOnly value={permanentUrl!}
                  style={{ flex: 1, fontSize: 11, padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: 8, color: "#64748b", background: "#f8fafc", minWidth: 0 }}
                />
                <button
                  onClick={() => copyLink(permanentUrl!, "perm")}
                  style={{ padding: "6px 12px", borderRadius: 8, background: copied === "perm" ? "#dcfce7" : "#f1f5f9", border: "none", cursor: "pointer", color: copied === "perm" ? "#16a34a" : "#64748b", display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}
                >
                  {copied === "perm" ? <Check size={13} /> : <Copy size={13} />}
                </button>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  onClick={downloadCardAsImage}
                  style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 9, background: "#1e3a8a", color: "#fff", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                >
                  <Download size={13} /> Save Image
                </button>
                <button
                  onClick={() => window.open(permanentUrl!, "_blank")}
                  style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 9, background: "#f1f5f9", color: "#0f172a", border: "1px solid #e2e8f0", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                >
                  <ExternalLink size={13} /> Open Card
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── TEMPORARY 24h LINK ── */}
      <div style={{ background: "#fff", border: "1.5px solid #fde68a", borderRadius: 16, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg, #d97706, #f59e0b)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Clock size={18} style={{ color: "#fff" }} />
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", margin: 0 }}>Emergency Share Link (24h)</p>
            <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>Generate a temporary link to share with ER doctors — expires in 24 hours.</p>
          </div>
        </div>

        {!tempLink ? (
          <Button variant="outline" onClick={createTempLink} disabled={generating}>
            <Link2 size={14} style={{ marginRight: 6 }} />
            {generating ? "Generating..." : "Generate 24-hour Link"}
          </Button>
        ) : (
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input
                readOnly value={tempLink}
                style={{ flex: 1, fontSize: 11, padding: "8px 12px", border: "1px solid #fde68a", borderRadius: 8, color: "#64748b", background: "#fffbeb", minWidth: 0 }}
              />
              <button
                onClick={() => copyLink(tempLink, "temp")}
                style={{ padding: "8px 14px", borderRadius: 8, background: copied === "temp" ? "#dcfce7" : "#fef3c7", border: "1px solid #fde68a", cursor: "pointer", color: copied === "temp" ? "#16a34a" : "#d97706", display: "flex", alignItems: "center", gap: 4, flexShrink: 0, fontWeight: 700, fontSize: 12 }}
              >
                {copied === "temp" ? <><Check size={13} /> Copied!</> : <><Copy size={13} /> Copy</>}
              </button>
            </div>
            {tempExpiry && (
              <p style={{ fontSize: 12, color: "#d97706", margin: 0 }}>
                ⏱ Expires: {new Date(tempExpiry).toLocaleString()}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
