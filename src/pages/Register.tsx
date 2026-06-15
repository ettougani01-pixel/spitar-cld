import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { SpitarLogoMark } from "@/components/SpitarLogoMark";
import { Loader2, AlertTriangle, User, Stethoscope, FlaskConical, Mail, Lock, Phone, MapPin } from "lucide-react";

type Role = "patient" | "doctor" | "lab";

const CITIES = [
  "Agadir","Casablanca","El Jadida","Fès","Kénitra",
  "Marrakech","Meknès","Oujda","Rabat","Safi","Tanger","Tétouan",
];
const SPECIALTIES = [
  "General Practice","Cardiology","Dermatology","Endocrinology",
  "Gastroenterology","Gynecology","Hematology","Nephrology",
  "Neurology","Oncology","Ophthalmology","Orthopedics",
  "Otolaryngology (ENT)","Pediatrics","Psychiatry","Pulmonology",
  "Radiology","Rheumatology","Urology","General Surgery",
  "Anesthesiology","Emergency Medicine","Infectious Diseases",
];

const inp: React.CSSProperties = {
  width: "100%", height: 46, padding: "0 14px",
  border: "1.5px solid #e2e8f0", borderRadius: 12,
  fontSize: 14, outline: "none", boxSizing: "border-box",
  background: "#f8fafc", color: "#0f172a", transition: "border-color 0.15s",
};

const inpIcon: React.CSSProperties = { ...inp, paddingLeft: 40 };

const lbl: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: "#64748b",
  display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em",
};

const sel: React.CSSProperties = { ...inp, cursor: "pointer" };

const ROLE_CONFIG: Record<Role, { icon: React.ElementType; gradient: string; label: string; desc: string }> = {
  patient: { icon: User, gradient: "linear-gradient(135deg, #2563eb, #06b6d4)", label: "Patient", desc: "Manage your health records" },
  doctor:  { icon: Stethoscope, gradient: "linear-gradient(135deg, #7c3aed, #2563eb)", label: "Doctor", desc: "Access patient files securely" },
  lab:     { icon: FlaskConical, gradient: "linear-gradient(135deg, #0891b2, #16a34a)", label: "Laboratory", desc: "Upload & manage lab results" },
};

export default function Register() {
  const { t } = useTranslation();
  const { register } = useAuth();
  const navigate = useNavigate();

  const [role, setRole] = useState<Role>("patient");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [labName, setLabName] = useState("");
  const [labAddress, setLabAddress] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    if (role === "patient") {
      if (!phone) { setError(t("auth.phone_required")); return; }
      if (!emergencyName || !emergencyPhone) { setError(t("auth.emergency_contact_required")); return; }
    }
    if (role === "doctor" && !specialty) { setError(t("auth.specialty_required")); return; }
    setLoading(true);
    try {
      await register({ email, password, firstName, lastName, role, phone, city, specialty, labName, labAddress, licenseNumber, emergencyContactName: emergencyName, emergencyContactPhone: emergencyPhone });
      navigate("/dashboard");
    } catch (err: any) {
      if (err.code === "auth/email-already-in-use") setError(t("auth.email_in_use"));
      else if (err.code === "auth/weak-password") setError(t("auth.weak_password"));
      else setError(err.message ?? t("auth.register_failed"));
    } finally { setLoading(false); }
  };

  const cfg = ROLE_CONFIG[role];
  const RoleIcon = cfg.icon;

  const focusBlue = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => (e.target.style.borderColor = "#2563eb");
  const blurGray  = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => (e.target.style.borderColor = "#e2e8f0");

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      {/* Top gradient bar */}
      <div style={{ height: 5, background: cfg.gradient, transition: "background 0.4s" }} />

      <div style={{ maxWidth: 560, margin: "0 auto", padding: "32px 20px 60px" }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32 }}>
          <SpitarLogoMark size={36} />
          <span style={{ fontSize: 20, fontWeight: 800, color: "#0f172a" }}>SPITAR</span>
        </div>

        {/* Header */}
        <h1 style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", margin: "0 0 4px" }}>{t("auth.register")}</h1>
        <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 28px" }}>{t("auth.register_subtitle")}</p>

        {/* Role selector */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 24 }}>
          {(["patient", "doctor", "lab"] as Role[]).map(r => {
            const c = ROLE_CONFIG[r]; const Icon = c.icon;
            const active = role === r;
            return (
              <button key={r} type="button" onClick={() => setRole(r)} style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                padding: "14px 8px", borderRadius: 14, cursor: "pointer", transition: "all 0.2s",
                border: active ? "2px solid #2563eb" : "2px solid #e2e8f0",
                background: active ? "#eff6ff" : "#fff",
                boxShadow: active ? "0 0 0 3px rgba(37,99,235,0.1)" : "none",
              }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: active ? c.gradient : "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.2s" }}>
                  <Icon size={17} style={{ color: active ? "#fff" : "#94a3b8" }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: active ? "#2563eb" : "#64748b" }}>{c.label}</span>
              </button>
            );
          })}
        </div>

        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: "#dc2626", display: "flex", gap: 8, alignItems: "center" }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {/* Basic info card */}
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 20, marginBottom: 16, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={lbl}>{t("auth.first_name")}</label>
                <input style={inp} value={firstName} onChange={e => setFirstName(e.target.value)} required onFocus={focusBlue} onBlur={blurGray} />
              </div>
              <div>
                <label style={lbl}>{t("auth.last_name")}</label>
                <input style={inp} value={lastName} onChange={e => setLastName(e.target.value)} required onFocus={focusBlue} onBlur={blurGray} />
              </div>
            </div>
            <div style={{ position: "relative" }}>
              <label style={lbl}>{t("auth.email")}</label>
              <Mail size={15} style={{ position: "absolute", left: 13, bottom: 15, color: "#94a3b8" }} />
              <input style={inpIcon} type="email" value={email} onChange={e => setEmail(e.target.value)} required onFocus={focusBlue} onBlur={blurGray} />
            </div>
            <div style={{ position: "relative" }}>
              <label style={lbl}>{t("auth.password")}</label>
              <Lock size={15} style={{ position: "absolute", left: 13, bottom: 15, color: "#94a3b8" }} />
              <input style={inpIcon} type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} onFocus={focusBlue} onBlur={blurGray} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ position: "relative" }}>
                <label style={lbl}>{t("auth.phone")} {role === "patient" && <span style={{ color: "#ef4444" }}>*</span>}</label>
                <Phone size={15} style={{ position: "absolute", left: 13, bottom: 15, color: "#94a3b8" }} />
                <input style={inpIcon} type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+212 6XX XXX XXX" required={role === "patient"} onFocus={focusBlue} onBlur={blurGray} />
              </div>
              <div style={{ position: "relative" }}>
                <label style={lbl}>{t("auth.city")}</label>
                <MapPin size={15} style={{ position: "absolute", left: 13, bottom: 15, color: "#94a3b8", zIndex: 1 }} />
                <select style={{ ...sel, paddingLeft: 36 }} value={city} onChange={e => setCity(e.target.value)} onFocus={focusBlue} onBlur={blurGray}>
                  <option value="">{t("auth.city_optional")}</option>
                  {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Patient — Emergency Contact */}
          {role === "patient" && (
            <div style={{ background: "#fff5f5", border: "1.5px solid #fca5a5", borderRadius: 16, padding: 20, marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <AlertTriangle size={13} style={{ color: "#dc2626" }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#dc2626", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {t("auth.emergency_contact_section")} *
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={{ ...lbl, color: "#dc2626" }}>{t("auth.emergency_contact_name")} *</label>
                  <input style={inp} value={emergencyName} onChange={e => setEmergencyName(e.target.value)} placeholder={t("auth.emergency_contact_name_placeholder")} required onFocus={e => (e.target.style.borderColor = "#dc2626")} onBlur={blurGray} />
                </div>
                <div style={{ position: "relative" }}>
                  <label style={{ ...lbl, color: "#dc2626" }}>{t("auth.emergency_contact_phone")} *</label>
                  <Phone size={15} style={{ position: "absolute", left: 13, bottom: 15, color: "#94a3b8" }} />
                  <input style={inpIcon} type="tel" value={emergencyPhone} onChange={e => setEmergencyPhone(e.target.value)} placeholder="+212 6XX XXX XXX" required onFocus={e => (e.target.style.borderColor = "#dc2626")} onBlur={blurGray} />
                </div>
              </div>
            </div>
          )}

          {/* Doctor fields */}
          {role === "doctor" && (
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 20, marginBottom: 16, display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={lbl}>{t("auth.specialty")} *</label>
                <select style={sel} value={specialty} onChange={e => setSpecialty(e.target.value)} required onFocus={focusBlue} onBlur={blurGray}>
                  <option value="">{t("auth.specialty_search_placeholder")}</option>
                  {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>{t("auth.license")}</label>
                <input style={inp} value={licenseNumber} onChange={e => setLicenseNumber(e.target.value)} onFocus={focusBlue} onBlur={blurGray} />
              </div>
            </div>
          )}

          {/* Lab fields */}
          {role === "lab" && (
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 20, marginBottom: 16, display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={lbl}>{t("auth.lab_name")}</label>
                <input style={inp} value={labName} onChange={e => setLabName(e.target.value)} placeholder={t("auth.lab_name_placeholder")} onFocus={focusBlue} onBlur={blurGray} />
              </div>
              <div>
                <label style={lbl}>{t("auth.lab_address")}</label>
                <input style={inp} value={labAddress} onChange={e => setLabAddress(e.target.value)} placeholder={t("auth.lab_address_placeholder")} onFocus={focusBlue} onBlur={blurGray} />
              </div>
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            height: 52, background: cfg.gradient, color: "#fff", border: "none",
            borderRadius: 14, fontSize: 15, fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            boxShadow: "0 4px 14px rgba(37,99,235,0.3)", opacity: loading ? 0.8 : 1,
            transition: "all 0.2s",
          }}>
            {loading ? <><Loader2 size={16} className="animate-spin" /> {t("common.loading")}</> : (
              <><RoleIcon size={16} /> {t("auth.register")}</>
            )}
          </button>
        </form>

        <p style={{ textAlign: "center", fontSize: 13, color: "#64748b", marginTop: 20 }}>
          {t("auth.have_account")}{" "}
          <Link to="/login" style={{ color: "#2563eb", fontWeight: 700, textDecoration: "none" }}>{t("auth.login")}</Link>
        </p>
      </div>
    </div>
  );
}
