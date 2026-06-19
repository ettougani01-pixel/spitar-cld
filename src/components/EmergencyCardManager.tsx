import { useState, useEffect } from "react";
import { doc, getDoc, setDoc, addDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { ShieldAlert, Link2, QrCode, Copy, Check, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";

export function EmergencyCardManager() {
  const { user } = useAuth();
  const [permanentId, setPermanentId] = useState<string | null>(null);
  const [tempLink, setTempLink] = useState<string | null>(null);
  const [tempExpiry, setTempExpiry] = useState<number | null>(null);
  const [copied, setCopied] = useState<"perm" | "temp" | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, "emergency_cards", user.uid)).then(d => {
      if (d.exists()) setPermanentId(user.uid);
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

  if (loading) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Permanent emergency card */}
      <div style={{ background: "#fff", border: "1.5px solid #fca5a5", borderRadius: 16, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg, #dc2626, #b91c1c)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ShieldAlert size={18} style={{ color: "#fff" }} />
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", margin: 0 }}>Permanent Emergency Card</p>
            <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>Always accessible — no expiry. Shows allergies, medications, blood type.</p>
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
              <p style={{ fontSize: 11, color: "#94a3b8", margin: 0 }}>
                Print this QR code and keep it in your wallet or on your phone's lock screen.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Temporary 24h link */}
      <div style={{ background: "#fff", border: "1.5px solid #fde68a", borderRadius: 16, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg, #d97706, #f59e0b)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Clock size={18} style={{ color: "#fff" }} />
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", margin: 0 }}>Emergency Share Link (24h)</p>
            <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>Generate a temporary link to share with ER doctors.</p>
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
