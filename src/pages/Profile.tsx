import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/Navbar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SpitarIdBadge } from "@/components/SpitarIdBadge";
import { Loader2, CheckCircle2, User, Stethoscope, FlaskConical, Building2, ShieldCheck, Camera, MapPin, Phone, Mail, Heart, AlertCircle, Briefcase, Plus, Trash2 } from "lucide-react";
import type { DoctorProfile, PatientProfile } from "@/lib/types";

interface EmergencyContact { name: string; phone: string; relation: string; }

const RELATIONS = ["Spouse", "Parent", "Child", "Sibling", "Friend", "Colleague", "Other"];

const CITIES = [
  "Agadir", "Casablanca", "El Jadida", "Fès", "Kénitra",
  "Marrakech", "Meknès", "Oujda", "Rabat", "Safi", "Tanger", "Tétouan",
];
const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const ROLE_META: Record<string, { icon: React.ElementType; gradient: string; label: string }> = {
  patient: { icon: User, gradient: "linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)", label: "Patient" },
  doctor: { icon: Stethoscope, gradient: "linear-gradient(135deg, #7c3aed 0%, #2563eb 100%)", label: "Doctor" },
  lab: { icon: FlaskConical, gradient: "linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)", label: "Laboratory" },
  hospital: { icon: Building2, gradient: "linear-gradient(135deg, #0d9488 0%, #16a34a 100%)", label: "Hospital" },
  admin: { icon: ShieldCheck, gradient: "linear-gradient(135deg, #dc2626 0%, #ea580c 100%)", label: "Admin" },
};

function Field({ label, icon: Icon, children }: { label: string; icon?: React.ElementType; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "flex", alignItems: "center", gap: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {Icon && <Icon size={12} />} {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", height: 44, padding: "0 14px", border: "1.5px solid #e2e8f0",
  borderRadius: 10, fontSize: 14, color: "#0f172a", background: "#f8fafc",
  boxSizing: "border-box", outline: "none", transition: "border-color 0.15s",
};

const disabledStyle: React.CSSProperties = { ...inputStyle, opacity: 0.5, cursor: "not-allowed", background: "#f1f5f9" };

function Section({ title, icon: Icon, color, children }: { title: string; icon: React.ElementType; color: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: color + "18", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={15} style={{ color }} />
        </div>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{title}</span>
      </div>
      <div style={{ padding: "20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {children}
      </div>
    </div>
  );
}

function FullRow({ children }: { children: React.ReactNode }) {
  return <div style={{ gridColumn: "1 / -1" }}>{children}</div>;
}

export default function Profile() {
  const { t } = useTranslation();
  const { user, updateProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [city, setCity] = useState(user?.city ?? "");
  const [dateOfBirth, setDateOfBirth] = useState((user as PatientProfile)?.dateOfBirth ?? "");
  const [bloodType, setBloodType] = useState((user as PatientProfile)?.bloodType ?? "");
  const [gender, setGender] = useState((user as PatientProfile)?.gender ?? "");
  const [address, setAddress] = useState((user as PatientProfile)?.address ?? "");
  // Emergency contacts list — seed from legacy single-contact fields
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>(() => {
    const p = user as PatientProfile;
    const legacyName = p?.emergencyContactName ?? "";
    const legacyPhone = p?.emergencyContactPhone ?? "";
    const stored = (p as any)?.emergencyContacts as EmergencyContact[] | undefined;
    if (stored && stored.length > 0) return stored;
    if (legacyName || legacyPhone) return [{ name: legacyName, phone: legacyPhone, relation: "Other" }];
    return [{ name: "", phone: "", relation: "Other" }];
  });
  const [bio, setBio] = useState((user as DoctorProfile)?.bio ?? "");
  const [consultationFee, setConsultationFee] = useState(String((user as DoctorProfile)?.consultationFee ?? ""));

  if (!user) return null;

  const meta = ROLE_META[user.role] ?? ROLE_META.patient;
  const RoleIcon = meta.icon;
  const initials = `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setSaved(false);
    try {
      const base = { firstName, lastName, phone, city };
      const extra: Record<string, unknown> = {};
      if (user.role === "patient") Object.assign(extra, {
        dateOfBirth, bloodType, gender, address,
        emergencyContacts,
        // keep legacy fields for backward compat with EmergencyCard page
        emergencyContactName: emergencyContacts[0]?.name ?? "",
        emergencyContactPhone: emergencyContacts[0]?.phone ?? "",
      });
      else if (user.role === "doctor") Object.assign(extra, { bio, consultationFee: consultationFee ? Number(consultationFee) : undefined });
      await updateProfile({ ...base, ...extra });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally { setSaving(false); }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <Navbar />

      {/* Hero banner */}
      <div style={{ background: meta.gradient, height: 160, position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, opacity: 0.1, backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
      </div>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "0 16px 48px" }}>
        {/* Avatar card */}
        <div style={{ background: "#fff", borderRadius: 20, border: "1px solid #e2e8f0", padding: "0 24px 24px", marginBottom: 20, marginTop: -60, boxShadow: "0 4px 20px rgba(0,0,0,0.08)", position: "relative" }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 20, paddingTop: 0 }}>
            {/* Avatar */}
            <div style={{ position: "relative", marginTop: -40 }}>
              <div style={{ width: 88, height: 88, borderRadius: 22, background: meta.gradient, display: "flex", alignItems: "center", justifyContent: "center", border: "4px solid #fff", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>
                <span style={{ fontSize: 28, fontWeight: 800, color: "#fff" }}>{initials}</span>
              </div>
              <div style={{ position: "absolute", bottom: 2, right: 2, width: 24, height: 24, borderRadius: "50%", background: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff", cursor: "pointer" }}>
                <Camera size={11} style={{ color: "#fff" }} />
              </div>
            </div>

            {/* Name + badges */}
            <div style={{ flex: 1, paddingTop: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", margin: 0 }}>{user.firstName} {user.lastName}</h1>
                {user.isVerified
                  ? <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 20, background: "#dcfce7", color: "#16a34a" }}>✓ Verified</span>
                  : <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 20, background: "#fef3c7", color: "#d97706" }}>Unverified</span>
                }
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                <RoleIcon size={13} style={{ color: "#64748b" }} />
                <span style={{ fontSize: 13, color: "#64748b" }}>{meta.label}</span>
                <span style={{ color: "#e2e8f0" }}>·</span>
                <SpitarIdBadge id={user.spitarId} size="sm" />
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Basic Information */}
          <Section title="Basic Information" icon={User} color="#2563eb">
            <Field label={t("auth.first_name")}>
              <input style={inputStyle} value={firstName} onChange={e => setFirstName(e.target.value)} required
                onFocus={e => (e.target.style.borderColor = "#2563eb")} onBlur={e => (e.target.style.borderColor = "#e2e8f0")} />
            </Field>
            <Field label={t("auth.last_name")}>
              <input style={inputStyle} value={lastName} onChange={e => setLastName(e.target.value)} required
                onFocus={e => (e.target.style.borderColor = "#2563eb")} onBlur={e => (e.target.style.borderColor = "#e2e8f0")} />
            </Field>
            <FullRow>
              <Field label={t("auth.email")} icon={Mail}>
                <input style={disabledStyle} value={user.email} disabled />
              </Field>
            </FullRow>
            <Field label={t("auth.phone")} icon={Phone}>
              <input style={inputStyle} type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                onFocus={e => (e.target.style.borderColor = "#2563eb")} onBlur={e => (e.target.style.borderColor = "#e2e8f0")} />
            </Field>
            <Field label={t("auth.city")} icon={MapPin}>
              <Select value={city} onValueChange={setCity}>
                <SelectTrigger style={{ height: 44, borderRadius: 10, border: "1.5px solid #e2e8f0", background: "#f8fafc", fontSize: 14 }}>
                  <SelectValue placeholder="Select city" />
                </SelectTrigger>
                <SelectContent>
                  {CITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </Section>

          {/* Patient: Health Info */}
          {user.role === "patient" && (
            <>
              <Section title="Health Information" icon={Heart} color="#dc2626">
                <Field label="Date of Birth">
                  <input style={inputStyle} type="date" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)}
                    onFocus={e => (e.target.style.borderColor = "#dc2626")} onBlur={e => (e.target.style.borderColor = "#e2e8f0")} />
                </Field>
                <Field label="Blood Type">
                  <Select value={bloodType} onValueChange={setBloodType}>
                    <SelectTrigger style={{ height: 44, borderRadius: 10, border: "1.5px solid #e2e8f0", background: "#f8fafc", fontSize: 14 }}>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {BLOOD_TYPES.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Gender">
                  <Select value={gender} onValueChange={setGender}>
                    <SelectTrigger style={{ height: 44, borderRadius: 10, border: "1.5px solid #e2e8f0", background: "#f8fafc", fontSize: 14 }}>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male / ذكر</SelectItem>
                      <SelectItem value="female">Female / أنثى</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Address" icon={MapPin}>
                  <input style={inputStyle} value={address} onChange={e => setAddress(e.target.value)} placeholder="Full address"
                    onFocus={e => (e.target.style.borderColor = "#dc2626")} onBlur={e => (e.target.style.borderColor = "#e2e8f0")} />
                </Field>
              </Section>

              {/* Emergency Contacts — multiple */}
              <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: "#ea580c18", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <AlertCircle size={15} style={{ color: "#ea580c" }} />
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>Emergency Contacts</span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#fff7ed", color: "#ea580c", border: "1px solid #fed7aa" }}>
                      {emergencyContacts.length}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEmergencyContacts(prev => [...prev, { name: "", phone: "", relation: "Other" }])}
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, background: "#fff7ed", border: "1px solid #fed7aa", color: "#ea580c", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                  >
                    <Plus size={13} /> Add Person
                  </button>
                </div>

                <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
                  {emergencyContacts.map((ec, i) => (
                    <div key={i} style={{ border: "1.5px solid #fed7aa", borderRadius: 12, padding: "14px 16px", background: "#fffbf7", position: "relative" }}>
                      {/* Remove button */}
                      {emergencyContacts.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setEmergencyContacts(prev => prev.filter((_, idx) => idx !== i))}
                          style={{ position: "absolute", top: 10, right: 10, background: "#fee2e2", border: "none", borderRadius: 6, padding: "3px 6px", cursor: "pointer", color: "#dc2626", display: "flex", alignItems: "center" }}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}

                      <p style={{ fontSize: 11, fontWeight: 700, color: "#ea580c", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        Contact {i + 1}
                      </p>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <Field label="Full Name">
                          <input
                            style={inputStyle} value={ec.name}
                            onChange={e => setEmergencyContacts(prev => prev.map((c, idx) => idx === i ? { ...c, name: e.target.value } : c))}
                            placeholder="e.g. Ahmed Mohamed"
                            onFocus={e => (e.target.style.borderColor = "#ea580c")} onBlur={e => (e.target.style.borderColor = "#e2e8f0")}
                          />
                        </Field>
                        <Field label="Phone" icon={Phone}>
                          <input
                            style={inputStyle} type="tel" value={ec.phone}
                            onChange={e => setEmergencyContacts(prev => prev.map((c, idx) => idx === i ? { ...c, phone: e.target.value } : c))}
                            placeholder="+212 6XX XXX XXX"
                            onFocus={e => (e.target.style.borderColor = "#ea580c")} onBlur={e => (e.target.style.borderColor = "#e2e8f0")}
                          />
                        </Field>
                        <div style={{ gridColumn: "1 / -1" }}>
                          <Field label="Relationship">
                            <Select value={ec.relation} onValueChange={val => setEmergencyContacts(prev => prev.map((c, idx) => idx === i ? { ...c, relation: val } : c))}>
                              <SelectTrigger style={{ height: 44, borderRadius: 10, border: "1.5px solid #e2e8f0", background: "#f8fafc", fontSize: 14 }}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {RELATIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </Field>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Doctor: Professional */}
          {user.role === "doctor" && (
            <Section title="Professional Details" icon={Briefcase} color="#7c3aed">
              <FullRow>
                <Field label="Specialty">
                  <input style={disabledStyle} value={(user as DoctorProfile).specialty ?? ""} disabled />
                  <p style={{ fontSize: 11, color: "#94a3b8", margin: "4px 0 0" }}>Contact admin to update your specialty</p>
                </Field>
              </FullRow>
              <FullRow>
                <Field label="Bio / About">
                  <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3}
                    placeholder="Brief description of your practice..."
                    style={{ ...inputStyle, height: "auto", padding: "12px 14px", resize: "none", lineHeight: 1.6 }}
                    onFocus={e => (e.target.style.borderColor = "#7c3aed")} onBlur={e => (e.target.style.borderColor = "#e2e8f0")} />
                </Field>
              </FullRow>
              <Field label="Consultation Fee (MAD)">
                <input style={inputStyle} type="number" value={consultationFee} onChange={e => setConsultationFee(e.target.value)}
                  placeholder="e.g. 300"
                  onFocus={e => (e.target.style.borderColor = "#7c3aed")} onBlur={e => (e.target.style.borderColor = "#e2e8f0")} />
              </Field>
            </Section>
          )}

          {/* Save button */}
          <button
            type="submit"
            disabled={saving}
            style={{
              width: "100%", height: 50, borderRadius: 14, border: "none", cursor: saving ? "wait" : "pointer",
              background: saved ? "linear-gradient(135deg, #16a34a, #15803d)" : meta.gradient,
              color: "#fff", fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center",
              justifyContent: "center", gap: 8, transition: "all 0.2s", boxShadow: "0 4px 14px rgba(37,99,235,0.3)",
            }}
          >
            {saving
              ? <><Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> {t("common.loading")}</>
              : saved
              ? <><CheckCircle2 size={18} /> Saved successfully!</>
              : t("common.save")
            }
          </button>
        </form>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
