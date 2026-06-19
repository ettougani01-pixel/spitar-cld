import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AlertTriangle, Heart, Pill, Phone, User, ShieldAlert } from "lucide-react";

interface EmergencyContact { name: string; phone: string; relation: string; }
interface EmergencyData {
  name: string;
  spitarId: string;
  bloodType?: string;
  dateOfBirth?: string;
  phone?: string;
  emergencyContacts: EmergencyContact[];
  allergies: { allergenName: string; severity: string; reaction: string }[];
  medications: { name: string; dosage: string; frequency: string }[];
}

const SEVERITY_COLOR: Record<string, string> = {
  life_threatening: "#dc2626",
  severe: "#ea580c",
  moderate: "#d97706",
  mild: "#16a34a",
};

export default function EmergencyCard() {
  const { tokenId } = useParams<{ tokenId: string }>();
  const [data, setData] = useState<EmergencyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!tokenId) { setError("Invalid link"); setLoading(false); return; }
    (async () => {
      try {
        const tokenDoc = await getDoc(doc(db, "emergency_cards", tokenId));
        if (!tokenDoc.exists()) { setError("Emergency card not found"); setLoading(false); return; }
        const td = tokenDoc.data();

        // Check expiry if set
        if (td.expiresAt && Date.now() > td.expiresAt) {
          setError("This emergency card link has expired");
          setLoading(false);
          return;
        }

        const patientId = td.patientId;
        const userDoc = await getDoc(doc(db, "users", patientId));
        if (!userDoc.exists()) { setError("Patient not found"); setLoading(false); return; }
        const u = userDoc.data();

        const [allergySnap, medSnap] = await Promise.allSettled([
          getDocs(query(collection(db, "patient_allergies"), where("patientId", "==", patientId))),
          getDocs(query(collection(db, "patient_medications"), where("patientId", "==", patientId))),
        ]);

        // Build emergency contacts list (new multi-contact or legacy single)
        let emergencyContacts: EmergencyContact[] = [];
        if (u.emergencyContacts && u.emergencyContacts.length > 0) {
          emergencyContacts = u.emergencyContacts;
        } else if (u.emergencyContactName || u.emergencyContactPhone) {
          emergencyContacts = [{ name: u.emergencyContactName ?? "", phone: u.emergencyContactPhone ?? "", relation: "Other" }];
        }

        setData({
          name: `${u.firstName} ${u.lastName}`,
          spitarId: u.spitarId,
          bloodType: u.bloodType,
          dateOfBirth: u.dateOfBirth,
          phone: u.phone,
          emergencyContacts,
          allergies: allergySnap.status === "fulfilled"
            ? allergySnap.value.docs.map(d => d.data() as any)
            : [],
          medications: medSnap.status === "fulfilled"
            ? medSnap.value.docs.map(d => d.data() as any)
            : [],
        });
      } catch (e) {
        setError("Failed to load emergency card");
      } finally {
        setLoading(false);
      }
    })();
  }, [tokenId]);

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc" }}>
      <div style={{ width: 40, height: 40, border: "4px solid #dc2626", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (error) return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#f8fafc", gap: 16, padding: 24 }}>
      <ShieldAlert size={56} style={{ color: "#94a3b8" }} />
      <p style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>{error}</p>
      <p style={{ fontSize: 14, color: "#64748b" }}>This link may be invalid or expired.</p>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", padding: "24px 16px" }}>
      {/* Header */}
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div style={{ background: "linear-gradient(135deg, #dc2626, #b91c1c)", borderRadius: 18, padding: "20px 24px", marginBottom: 16, display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <ShieldAlert size={26} style={{ color: "#fff" }} />
          </div>
          <div>
            <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: 700, margin: 0, letterSpacing: "0.08em" }}>EMERGENCY MEDICAL CARD</p>
            <p style={{ color: "#fff", fontSize: 20, fontWeight: 800, margin: "2px 0 0" }}>{data!.name}</p>
            <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, margin: "2px 0 0" }}>SPITAR ID: {data!.spitarId}</p>
          </div>
        </div>

        {/* Vital Info */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          <InfoCard icon={Heart} label="Blood Type" value={data!.bloodType || "Not recorded"} color="#dc2626" bg="#fee2e2" />
          <InfoCard icon={User} label="Date of Birth" value={data!.dateOfBirth || "Not recorded"} color="#7c3aed" bg="#ede9fe" />
        </div>

        {/* Emergency Contacts */}
        {(data!.phone || data!.emergencyContacts.length > 0) && (
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", padding: "16px 18px", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Phone size={15} style={{ color: "#0d9488" }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>Emergency Contacts</span>
            </div>
            {data!.phone && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #f3f4f6" }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", margin: 0 }}>Patient (self)</p>
                </div>
                <a href={`tel:${data!.phone}`} style={{ fontSize: 13, fontWeight: 700, color: "#0d9488", textDecoration: "none" }}>{data!.phone}</a>
              </div>
            )}
            {data!.emergencyContacts.filter(c => c.name || c.phone).map((c, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: i < data!.emergencyContacts.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", margin: 0 }}>{c.name || "—"}</p>
                  <p style={{ fontSize: 11, color: "#94a3b8", margin: 0 }}>{c.relation}</p>
                </div>
                {c.phone && <a href={`tel:${c.phone}`} style={{ fontSize: 13, fontWeight: 700, color: "#0d9488", textDecoration: "none" }}>{c.phone}</a>}
              </div>
            ))}
          </div>
        )}

        {/* Allergies */}
        <div style={{ background: "#fff", borderRadius: 14, border: data!.allergies.length > 0 ? "2px solid #fca5a5" : "1px solid #e5e7eb", padding: "16px 18px", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <AlertTriangle size={15} style={{ color: "#dc2626" }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>Allergies</span>
            {data!.allergies.length > 0 && (
              <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#fee2e2", color: "#dc2626" }}>
                {data!.allergies.length} known
              </span>
            )}
          </div>
          {data!.allergies.length === 0 ? (
            <p style={{ fontSize: 13, color: "#94a3b8" }}>No known allergies on record</p>
          ) : data!.allergies.map((a, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", borderRadius: 8, background: "#fef2f2", marginBottom: 6 }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", margin: 0 }}>{a.allergenName}</p>
                <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>{a.reaction}</p>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: SEVERITY_COLOR[a.severity] + "22", color: SEVERITY_COLOR[a.severity] }}>
                {a.severity?.replace("_", " ")}
              </span>
            </div>
          ))}
        </div>

        {/* Current Medications */}
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", padding: "16px 18px", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Pill size={15} style={{ color: "#2563eb" }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>Current Medications</span>
          </div>
          {data!.medications.length === 0 ? (
            <p style={{ fontSize: 13, color: "#94a3b8" }}>No medications on record</p>
          ) : data!.medications.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: i < data!.medications.length - 1 ? "1px solid #f3f4f6" : "none" }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", margin: 0 }}>{m.name}</p>
                <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>{m.frequency}</p>
              </div>
              <span style={{ fontSize: 12, color: "#2563eb", fontWeight: 600 }}>{m.dosage}</span>
            </div>
          ))}
        </div>

        <div style={{ textAlign: "center", padding: "12px 0" }}>
          <p style={{ fontSize: 11, color: "#94a3b8", margin: 0 }}>
            Powered by <strong>SPITAR</strong> · Emergency Medical Record System
          </p>
          <p style={{ fontSize: 10, color: "#cbd5e1", margin: "4px 0 0" }}>
            This card contains sensitive medical information. Handle with care.
          </p>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ icon: Icon, label, value, color, bg }: { icon: any; label: string; value: string; color: string; bg: string }) {
  return (
    <div style={{ background: bg, borderRadius: 12, padding: "14px 16px", border: `1px solid ${color}33` }}>
      <Icon size={18} style={{ color, marginBottom: 6 }} />
      <p style={{ fontSize: 11, color: "#64748b", margin: 0, fontWeight: 600 }}>{label}</p>
      <p style={{ fontSize: 16, fontWeight: 800, color, margin: "3px 0 0" }}>{value}</p>
    </div>
  );
}
