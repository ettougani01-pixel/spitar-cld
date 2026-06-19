import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Star, MapPin, Stethoscope, Calendar, ArrowLeft, User } from "lucide-react";

interface DoctorProfile {
  uid: string;
  firstName: string;
  lastName: string;
  spitarId: string;
  specialty?: string;
  city?: string;
  phone?: string;
  ratingAvg?: number;
  ratingCount?: number;
  bio?: string;
  yearsExperience?: number;
  languages?: string[];
  consultationFee?: number;
  isVerified?: boolean;
}

export default function DoctorPublicProfile() {
  const { spitarId } = useParams<{ spitarId: string }>();
  const navigate = useNavigate();
  const [doctor, setDoctor] = useState<DoctorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!spitarId) return;
    (async () => {
      try {
        const snap = await getDocs(query(
          collection(db, "users"),
          where("spitarId", "==", spitarId.toUpperCase()),
          where("role", "==", "doctor"),
        ));
        if (snap.empty) { setError("Doctor not found"); setLoading(false); return; }
        const d = snap.docs[0];
        setDoctor({ uid: d.id, ...d.data() } as DoctorProfile);
      } catch {
        setError("Failed to load profile");
      } finally {
        setLoading(false);
      }
    })();
  }, [spitarId]);

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc" }}>
      <div style={{ width: 40, height: 40, border: "4px solid #7c3aed", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (error || !doctor) return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#f8fafc", gap: 16 }}>
      <User size={56} style={{ color: "#94a3b8" }} />
      <p style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>{error || "Doctor not found"}</p>
      <button onClick={() => navigate(-1)} style={{ padding: "8px 20px", borderRadius: 10, background: "#7c3aed", color: "#fff", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
        Go Back
      </button>
    </div>
  );

  const stars = Math.round(doctor.ratingAvg ?? 0);

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", padding: "24px 16px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        {/* Back */}
        <button onClick={() => navigate(-1)} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "#64748b", fontSize: 14, marginBottom: 16 }}>
          <ArrowLeft size={16} /> Back
        </button>

        {/* Hero card */}
        <div style={{ background: "linear-gradient(135deg, #5b21b6, #7c3aed, #2563eb)", borderRadius: 20, padding: "28px 24px", marginBottom: 16, color: "#fff" }}>
          <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
            <div style={{ width: 72, height: 72, borderRadius: 20, background: "rgba(255,255,255,0.2)", border: "2px solid rgba(255,255,255,0.35)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontSize: 28, fontWeight: 800 }}>
                {doctor.firstName[0]}{doctor.lastName[0]}
              </span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Dr. {doctor.firstName} {doctor.lastName}</h2>
                {doctor.isVerified && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "rgba(255,255,255,0.25)" }}>✓ Verified</span>}
              </div>
              {doctor.specialty && <p style={{ fontSize: 14, color: "rgba(255,255,255,0.8)", margin: "0 0 6px" }}>{doctor.specialty}</p>}
              <span style={{ fontSize: 12, padding: "2px 10px", borderRadius: 20, background: "rgba(255,255,255,0.18)", color: "rgba(255,255,255,0.9)" }}>
                {doctor.spitarId}
              </span>
            </div>
          </div>
        </div>

        {/* Rating */}
        {doctor.ratingAvg !== undefined && (
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: "14px 18px", marginBottom: 12, display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ display: "flex", gap: 2 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} size={20} style={{ color: i < stars ? "#f59e0b" : "#e2e8f0", fill: i < stars ? "#f59e0b" : "none" }} />
              ))}
            </div>
            <div>
              <span style={{ fontSize: 20, fontWeight: 800, color: "#0f172a" }}>{(doctor.ratingAvg).toFixed(1)}</span>
              <span style={{ fontSize: 13, color: "#94a3b8", marginLeft: 6 }}>({doctor.ratingCount ?? 0} review{(doctor.ratingCount ?? 0) !== 1 ? "s" : ""})</span>
            </div>
          </div>
        )}

        {/* Info grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          {doctor.city && (
            <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
              <MapPin size={16} style={{ color: "#0d9488", flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: 11, color: "#94a3b8", margin: 0, fontWeight: 600 }}>LOCATION</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", margin: 0 }}>{doctor.city}</p>
              </div>
            </div>
          )}
          {doctor.yearsExperience !== undefined && (
            <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
              <Stethoscope size={16} style={{ color: "#7c3aed", flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: 11, color: "#94a3b8", margin: 0, fontWeight: 600 }}>EXPERIENCE</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", margin: 0 }}>{doctor.yearsExperience} years</p>
              </div>
            </div>
          )}
          {doctor.consultationFee !== undefined && (
            <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 18, color: "#16a34a" }}>💰</span>
              <div>
                <p style={{ fontSize: 11, color: "#94a3b8", margin: 0, fontWeight: 600 }}>CONSULTATION FEE</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", margin: 0 }}>{doctor.consultationFee} DZD</p>
              </div>
            </div>
          )}
          {doctor.languages && doctor.languages.length > 0 && (
            <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 18 }}>🌐</span>
              <div>
                <p style={{ fontSize: 11, color: "#94a3b8", margin: 0, fontWeight: 600 }}>LANGUAGES</p>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", margin: 0 }}>{doctor.languages.join(", ")}</p>
              </div>
            </div>
          )}
        </div>

        {/* Bio */}
        {doctor.bio && (
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: "14px 18px", marginBottom: 12 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>About</p>
            <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.7, margin: 0 }}>{doctor.bio}</p>
          </div>
        )}

        {/* CTA */}
        <div style={{ background: "linear-gradient(135deg, #ede9fe, #dbeafe)", borderRadius: 14, border: "1.5px solid #c4b5fd", padding: "16px 18px", textAlign: "center" }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: "#5b21b6", margin: "0 0 10px" }}>Want to book an appointment?</p>
          <p style={{ fontSize: 13, color: "#6d28d9", margin: "0 0 14px" }}>
            Search for <strong>Dr. {doctor.firstName} {doctor.lastName}</strong> by SPITAR ID <strong>{doctor.spitarId}</strong> in your patient dashboard to authorize access and request an appointment.
          </p>
          <button onClick={() => navigate("/dashboard")}
            style={{ padding: "10px 24px", borderRadius: 12, background: "linear-gradient(135deg, #7c3aed, #2563eb)", color: "#fff", border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            <Calendar size={15} style={{ marginRight: 6, verticalAlign: "middle" }} />
            Go to My Dashboard
          </button>
        </div>

        <div style={{ textAlign: "center", padding: "16px 0" }}>
          <p style={{ fontSize: 11, color: "#94a3b8", margin: 0 }}>Powered by <strong>SPITAR</strong> · Medical Platform</p>
        </div>
      </div>
    </div>
  );
}
