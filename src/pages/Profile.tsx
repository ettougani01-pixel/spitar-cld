import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/Navbar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SpitarIdBadge } from "@/components/SpitarIdBadge";
import {
  Loader2, CheckCircle2, User, Stethoscope, FlaskConical, Building2, ShieldCheck,
  MapPin, Phone, Mail, Heart, AlertCircle, Briefcase, Plus, Trash2,
  Droplets, Baby, Calendar, Home, UserCheck,
} from "lucide-react";
import type { DoctorProfile, PatientProfile } from "@/lib/types";
import { HealthProfileContent } from "@/components/HealthProfileContent";

interface EmergencyContact { name: string; phone: string; relation: string; }

const RELATIONS = ["Spouse", "Parent", "Child", "Sibling", "Friend", "Colleague", "Other"];
const CITIES = ["Agadir","Casablanca","El Jadida","Fès","Kénitra","Marrakech","Meknès","Oujda","Rabat","Safi","Tanger","Tétouan"];
const BLOOD_TYPES = ["A+","A-","B+","B-","AB+","AB-","O+","O-"];

const ROLE_META: Record<string, { icon: React.ElementType; gradient: string; accentColor: string; label: string }> = {
  patient:  { icon: User,        gradient: "linear-gradient(135deg,#2563eb,#06b6d4)", accentColor: "#2563eb", label: "Patient" },
  doctor:   { icon: Stethoscope, gradient: "linear-gradient(135deg,#7c3aed,#2563eb)", accentColor: "#7c3aed", label: "Doctor" },
  lab:      { icon: FlaskConical,gradient: "linear-gradient(135deg,#0891b2,#06b6d4)", accentColor: "#0891b2", label: "Laboratory" },
  hospital: { icon: Building2,   gradient: "linear-gradient(135deg,#0d9488,#16a34a)", accentColor: "#0d9488", label: "Hospital" },
  admin:    { icon: ShieldCheck,  gradient: "linear-gradient(135deg,#dc2626,#ea580c)", accentColor: "#dc2626", label: "Admin" },
};

const inp: React.CSSProperties = {
  width: "100%", height: 46, padding: "0 14px 0 40px", border: "1.5px solid #e2e8f0",
  borderRadius: 12, fontSize: 14, color: "#0f172a", background: "#fff",
  boxSizing: "border-box", outline: "none", transition: "all 0.2s",
};
const inpNoIcon: React.CSSProperties = { ...inp, paddingLeft: 14 };
const disabledInp: React.CSSProperties = { ...inp, paddingLeft: 14, opacity: 0.55, cursor: "not-allowed", background: "#f8fafc" };

function InputWrap({ icon: Icon, color, children }: { icon?: React.ElementType; color?: string; children: React.ReactNode }) {
  return (
    <div style={{ position: "relative" }}>
      {Icon && (
        <div style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", zIndex: 1, pointerEvents: "none" }}>
          <Icon size={15} style={{ color: color ?? "#94a3b8" }} />
        </div>
      )}
      {children}
    </div>
  );
}

function CardSection({ title, icon: Icon, accent, children }: { title: string; icon: React.ElementType; accent: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", borderRadius: 20, border: "1px solid #f1f5f9", overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
      <div style={{ padding: "18px 24px 14px", borderBottom: "1px solid #f8fafc", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 12, background: accent + "15", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={17} style={{ color: accent }} />
        </div>
        <span style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>{title}</span>
      </div>
      <div style={{ padding: "20px 24px" }}>
        {children}
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>{children}</p>;
}

export default function Profile() {
  const { t } = useTranslation();
  const { user, updateProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName,  setLastName]  = useState(user?.lastName  ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [city,  setCity]  = useState(user?.city  ?? "");
  const [dateOfBirth, setDateOfBirth] = useState((user as PatientProfile)?.dateOfBirth ?? "");
  const [bloodType,   setBloodType]   = useState((user as PatientProfile)?.bloodType   ?? "");
  const [gender,      setGender]      = useState((user as PatientProfile)?.gender      ?? "");
  const [address,     setAddress]     = useState((user as PatientProfile)?.address     ?? "");
  const [bio,             setBio]             = useState((user as DoctorProfile)?.bio             ?? "");
  const [consultationFee, setConsultationFee] = useState(String((user as DoctorProfile)?.consultationFee ?? ""));

  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>(() => {
    const p = user as PatientProfile;
    const stored = (p as any)?.emergencyContacts as EmergencyContact[] | undefined;
    if (stored && stored.length > 0) return stored;
    const ln = p?.emergencyContactName ?? "", lp = p?.emergencyContactPhone ?? "";
    if (ln || lp) return [{ name: ln, phone: lp, relation: "Other" }];
    return [{ name: "", phone: "", relation: "Other" }];
  });

  const [healthCounts, setHealthCounts] = useState({ allergies: 0, medications: 0, familyHistory: 0, sideEffects: 0, vaccinations: 0, visits: 0 });
  const [firestoreProfile, setFirestoreProfile] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!user || user.role !== "patient") return;
    const uid = user.uid;
    async function load() {
      const [aR, mR, fR, sR, uR, vacR, visR] = await Promise.allSettled([
        getDocs(query(collection(db, "patient_allergies"),     where("patientId", "==", uid))),
        getDocs(query(collection(db, "patient_medications"),   where("patientId", "==", uid))),
        getDocs(query(collection(db, "patient_family_history"),where("patientId", "==", uid))),
        getDocs(query(collection(db, "patient_side_effects"),  where("patientId", "==", uid))),
        getDoc(doc(db, "users", uid)),
        getDocs(query(collection(db, "patient_vaccinations"),  where("patientId", "==", uid))),
        getDocs(query(collection(db, "patient_visits"),        where("patientId", "==", uid))),
      ]);
      setHealthCounts({
        allergies:     aR.status === "fulfilled" ? aR.value.size : 0,
        medications:   mR.status === "fulfilled" ? mR.value.size : 0,
        familyHistory: fR.status === "fulfilled" ? fR.value.size : 0,
        sideEffects:   sR.status === "fulfilled" ? sR.value.size : 0,
        vaccinations:  vacR.status === "fulfilled" ? vacR.value.size : 0,
        visits:        visR.status === "fulfilled" ? visR.value.size : 0,
      });
      if (uR.status === "fulfilled" && uR.value.exists()) {
        const d = uR.value.data();
        setFirestoreProfile(d);
        if (d.dateOfBirth && !dateOfBirth) setDateOfBirth(d.dateOfBirth);
        if (d.bloodType   && !bloodType)   setBloodType(d.bloodType);
        if (d.gender      && !gender)      setGender(d.gender);
        if (d.address     && !address)     setAddress(d.address);
      }
    }
    load();
  }, [user?.uid]);

  if (!user) return null;

  const meta = ROLE_META[user.role] ?? ROLE_META.patient;
  const RoleIcon = meta.icon;
  const initials = `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase();

  const isFemale = gender.toLowerCase() === "female";
  const chronicConditions: string[] = (firestoreProfile.chronicConditions ?? []) as string[];
  const hasEmergencyContact = emergencyContacts.some(c => c.name || c.phone)
    || !!(firestoreProfile.emergencyContactName || firestoreProfile.emergencyContactPhone);

  const completionFields = user.role === "patient" ? [
    { label: t("profile.field_full_name"),         done: !!(firstName && lastName) },
    { label: t("profile.field_email"),             done: !!(user.email) },
    { label: t("profile.field_phone"),             done: !!(phone) },
    { label: t("profile.field_city"),              done: !!(city) },
    { label: t("profile.field_dob"),               done: !!(dateOfBirth) },
    { label: t("profile.field_blood_type"),        done: !!(bloodType) },
    { label: t("profile.field_gender"),            done: !!(gender) },
    { label: t("profile.field_address"),           done: !!(address) },
    { label: t("profile.field_emergency_contact"), done: hasEmergencyContact },
    { label: t("profile.field_allergies"),         done: healthCounts.allergies > 0 || !!(firestoreProfile.allergiesAnswered) },
    { label: t("profile.field_medications"),       done: healthCounts.medications > 0 },
    { label: t("profile.field_family_history"),    done: healthCounts.familyHistory > 0 || !!(firestoreProfile.familyHistoryAnswered) },
    { label: t("profile.field_side_effects"),      done: healthCounts.sideEffects > 0 || !!(firestoreProfile.sideEffectsAnswered) },
    { label: t("profile.field_chronic"),           done: chronicConditions.filter(c => c !== "pregnancy").length > 0 || !!(firestoreProfile.chronicConditionsAnswered) },
    { label: t("profile.field_vaccinations"),      done: healthCounts.vaccinations > 0 },
    { label: t("profile.field_visits"),            done: healthCounts.visits > 0 },
    ...(isFemale ? [{ label: t("profile.field_pregnancy"), done: chronicConditions.includes("pregnancy") }] : []),
  ] : [];
  const doneCnt = completionFields.filter(f => f.done).length;
  const completeness = completionFields.length > 0 ? Math.round((doneCnt / completionFields.length) * 100) : 0;
  const isComplete = completeness === 100;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setSaved(false);
    try {
      const base = { firstName, lastName, phone, city };
      const extra: Record<string, unknown> = {};
      if (user.role === "patient") Object.assign(extra, {
        dateOfBirth, bloodType, gender, address, emergencyContacts,
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
    <div style={{ minHeight: "100vh", background: "#f1f5f9" }}>
      <Navbar />

      {/* Hero */}
      <div style={{ background: meta.gradient, height: 200, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 15% 50%, rgba(255,255,255,0.12) 0%, transparent 60%), radial-gradient(circle at 85% 20%, rgba(255,255,255,0.08) 0%, transparent 50%)" }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 60, background: "linear-gradient(to bottom, transparent, rgba(241,245,249,0.5))" }} />
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 16px 60px" }}>

        {/* Profile Card */}
        <div style={{ background: "#fff", borderRadius: 24, border: "1px solid #e2e8f0", padding: "28px 28px 24px", marginTop: -80, marginBottom: 20, boxShadow: "0 8px 32px rgba(0,0,0,0.1)", position: "relative" }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 20, flexWrap: "wrap" }}>
            {/* Avatar */}
            <div style={{ position: "relative" }}>
              <div style={{
                width: 96, height: 96, borderRadius: 26, background: meta.gradient,
                display: "flex", alignItems: "center", justifyContent: "center",
                border: "4px solid #fff", boxShadow: "0 6px 20px rgba(0,0,0,0.18)",
              }}>
                <span style={{ fontSize: 32, fontWeight: 900, color: "#fff", letterSpacing: -1 }}>{initials}</span>
              </div>
              {/* Online dot */}
              <div style={{ position: "absolute", bottom: 4, right: 4, width: 16, height: 16, borderRadius: "50%", background: "#22c55e", border: "3px solid #fff" }} />
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0, paddingBottom: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: 0 }}>{user.firstName} {user.lastName}</h1>
                {user.isVerified
                  ? <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: "#dcfce7", color: "#16a34a", border: "1px solid #bbf7d0" }}>✓ Verified</span>
                  : <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: "#fef3c7", color: "#d97706", border: "1px solid #fde68a" }}>Pending</span>
                }
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "#64748b", background: "#f8fafc", padding: "3px 10px", borderRadius: 20, border: "1px solid #e2e8f0" }}>
                  <RoleIcon size={12} /> {meta.label}
                </span>
                <SpitarIdBadge id={user.spitarId} size="sm" />
                {user.city && (
                  <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#94a3b8" }}>
                    <MapPin size={11} /> {user.city}
                  </span>
                )}
              </div>
            </div>

            {/* Completion ring (patients only) */}
            {user.role === "patient" && (
              <div style={{ textAlign: "center", paddingBottom: 4 }}>
                <div style={{
                  position: "relative", width: 64, height: 64,
                  background: `conic-gradient(${isComplete ? "#16a34a" : "#ef4444"} ${completeness * 3.6}deg, #f1f5f9 0deg)`,
                  borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: `0 0 0 4px #fff, 0 0 0 6px ${isComplete ? "#16a34a" : "#ef4444"}22`,
                }}>
                  <div style={{ width: 46, height: 46, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: isComplete ? "#16a34a" : "#ef4444" }}>{completeness}%</span>
                  </div>
                </div>
                <p style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", margin: "6px 0 0", textAlign: "center" }}>{t("profile.completion_label")}</p>
              </div>
            )}
          </div>

          {/* Completion checklist (patients) */}
          {user.role === "patient" && (
            <div style={{ marginTop: 20, paddingTop: 18, borderTop: "1px solid #f1f5f9" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>{t("profile.profile_completeness")}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: isComplete ? "#16a34a" : "#ef4444" }}>{t("profile.fields_done", { done: doneCnt, total: completionFields.length })}</span>
              </div>
              {/* Progress bar */}
              <div style={{ height: 6, background: "#f1f5f9", borderRadius: 99, overflow: "hidden", marginBottom: 14 }}>
                <div style={{ height: "100%", width: `${completeness}%`, background: isComplete ? "#16a34a" : "#ef4444", borderRadius: 99, transition: "width 0.6s cubic-bezier(.4,0,.2,1)" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px 12px" }}>
                {completionFields.map(({ label, done }) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{
                      width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
                      background: done ? "#dcfce7" : "#f1f5f9",
                      border: `1.5px solid ${done ? "#16a34a" : "#e2e8f0"}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 9, fontWeight: 800, color: done ? "#16a34a" : "#cbd5e1",
                    }}>{done ? "✓" : ""}</div>
                    <span style={{ fontSize: 11, color: done ? "#374151" : "#94a3b8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Basic Information */}
          <CardSection title={t("profile.basic_info")} icon={User} accent={meta.accentColor}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <FieldLabel>{t("profile.first_name")}</FieldLabel>
                <InputWrap icon={User} color={meta.accentColor}>
                  <input style={inp} value={firstName} onChange={e => setFirstName(e.target.value)} required
                    onFocus={e => (e.target.style.borderColor = meta.accentColor)} onBlur={e => (e.target.style.borderColor = "#e2e8f0")} />
                </InputWrap>
              </div>
              <div>
                <FieldLabel>{t("profile.last_name")}</FieldLabel>
                <InputWrap icon={User} color={meta.accentColor}>
                  <input style={inp} value={lastName} onChange={e => setLastName(e.target.value)} required
                    onFocus={e => (e.target.style.borderColor = meta.accentColor)} onBlur={e => (e.target.style.borderColor = "#e2e8f0")} />
                </InputWrap>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <FieldLabel>{t("profile.field_email")}</FieldLabel>
                <InputWrap icon={Mail}>
                  <input style={disabledInp} value={user.email} disabled />
                </InputWrap>
              </div>
              <div>
                <FieldLabel>{t("profile.field_phone")}</FieldLabel>
                <InputWrap icon={Phone} color={meta.accentColor}>
                  <input style={inp} type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                    onFocus={e => (e.target.style.borderColor = meta.accentColor)} onBlur={e => (e.target.style.borderColor = "#e2e8f0")} />
                </InputWrap>
              </div>
              <div>
                <FieldLabel>{t("profile.field_city")}</FieldLabel>
                <Select value={city} onValueChange={setCity}>
                  <SelectTrigger style={{ height: 46, borderRadius: 12, border: "1.5px solid #e2e8f0", background: "#fff", fontSize: 14 }}>
                    <SelectValue placeholder={t("profile.select_city")} />
                  </SelectTrigger>
                  <SelectContent>
                    {CITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardSection>

          {/* Patient: Health Info */}
          {user.role === "patient" && (
            <>
              <CardSection title={t("profile.health_info")} icon={Heart} accent="#ef4444">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div>
                    <FieldLabel>{t("profile.field_dob")}</FieldLabel>
                    <InputWrap icon={Calendar} color="#ef4444">
                      <input style={inp} type="date" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)}
                        onFocus={e => (e.target.style.borderColor = "#ef4444")} onBlur={e => (e.target.style.borderColor = "#e2e8f0")} />
                    </InputWrap>
                  </div>
                  <div>
                    <FieldLabel>{t("profile.field_blood_type")}</FieldLabel>
                    <Select value={bloodType} onValueChange={setBloodType}>
                      <SelectTrigger style={{ height: 46, borderRadius: 12, border: "1.5px solid #e2e8f0", background: "#fff", fontSize: 14 }}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BLOOD_TYPES.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <FieldLabel>{t("profile.field_gender")}</FieldLabel>
                    <Select value={gender} onValueChange={setGender}>
                      <SelectTrigger style={{ height: 46, borderRadius: 12, border: "1.5px solid #e2e8f0", background: "#fff", fontSize: 14 }}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">{t("profile.male")}</SelectItem>
                        <SelectItem value="female">{t("profile.female")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <FieldLabel>{t("profile.field_address")}</FieldLabel>
                    <InputWrap icon={Home} color="#ef4444">
                      <input style={inp} value={address} onChange={e => setAddress(e.target.value)} placeholder={t("profile.address_placeholder")}
                        onFocus={e => (e.target.style.borderColor = "#ef4444")} onBlur={e => (e.target.style.borderColor = "#e2e8f0")} />
                    </InputWrap>
                  </div>
                </div>
              </CardSection>

              {/* Emergency Contacts */}
              <CardSection title={t("profile.emergency_contacts")} icon={AlertCircle} accent="#f97316">
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
                  <button
                    type="button"
                    onClick={() => setEmergencyContacts(p => [...p, { name: "", phone: "", relation: "Other" }])}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 10, background: "#fff7ed", border: "1.5px solid #fed7aa", color: "#f97316", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                  >
                    <Plus size={14} /> {t("profile.add_contact")}
                  </button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {emergencyContacts.map((ec, i) => (
                    <div key={i} style={{ borderRadius: 14, border: "1.5px solid #fed7aa", background: "linear-gradient(135deg,#fffbf5,#fff7ed)", padding: "16px 18px", position: "relative" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 26, height: 26, borderRadius: 8, background: "#fed7aa", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <UserCheck size={13} style={{ color: "#f97316" }} />
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#ea580c" }}>{t("profile.contact_number", { n: i + 1 })}</span>
                        </div>
                        {emergencyContacts.length > 1 && (
                          <button type="button" onClick={() => setEmergencyContacts(p => p.filter((_, idx) => idx !== i))}
                            style={{ width: 28, height: 28, borderRadius: 8, background: "#fee2e2", border: "none", cursor: "pointer", color: "#dc2626", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <div>
                          <FieldLabel>{t("profile.field_full_name")}</FieldLabel>
                          <InputWrap icon={User} color="#f97316">
                            <input style={inp} value={ec.name}
                              onChange={e => setEmergencyContacts(p => p.map((c, idx) => idx === i ? { ...c, name: e.target.value } : c))}
                              placeholder="Ahmed Mohamed"
                              onFocus={e => (e.target.style.borderColor = "#f97316")} onBlur={e => (e.target.style.borderColor = "#e2e8f0")} />
                          </InputWrap>
                        </div>
                        <div>
                          <FieldLabel>{t("profile.field_phone")}</FieldLabel>
                          <InputWrap icon={Phone} color="#f97316">
                            <input style={inp} type="tel" value={ec.phone}
                              onChange={e => setEmergencyContacts(p => p.map((c, idx) => idx === i ? { ...c, phone: e.target.value } : c))}
                              placeholder="+212 6XX XXX XXX"
                              onFocus={e => (e.target.style.borderColor = "#f97316")} onBlur={e => (e.target.style.borderColor = "#e2e8f0")} />
                          </InputWrap>
                        </div>
                        <div style={{ gridColumn: "1 / -1" }}>
                          <FieldLabel>{t("profile.relation")}</FieldLabel>
                          <Select value={ec.relation} onValueChange={val => setEmergencyContacts(p => p.map((c, idx) => idx === i ? { ...c, relation: val } : c))}>
                            <SelectTrigger style={{ height: 46, borderRadius: 12, border: "1.5px solid #e2e8f0", background: "#fff", fontSize: 14 }}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {RELATIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardSection>
            </>
          )}

          {/* Doctor: Professional */}
          {user.role === "doctor" && (
            <CardSection title={t("profile.professional_details")} icon={Briefcase} accent="#7c3aed">
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <FieldLabel>{t("dashboard.specialty")}</FieldLabel>
                  <input style={{ ...disabledInp, paddingLeft: 14 }} value={(user as DoctorProfile).specialty ?? ""} disabled />
                  <p style={{ fontSize: 11, color: "#94a3b8", margin: "4px 0 0" }}>{t("profile.specialty_change_hint")}</p>
                </div>
                <div>
                  <FieldLabel>{t("profile.bio")}</FieldLabel>
                  <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3}
                    placeholder={t("profile.bio_placeholder")}
                    style={{ ...inpNoIcon, height: "auto", padding: "12px 14px", resize: "none", lineHeight: 1.7 }}
                    onFocus={e => (e.target.style.borderColor = "#7c3aed")} onBlur={e => (e.target.style.borderColor = "#e2e8f0")} />
                </div>
                <div>
                  <FieldLabel>{t("profile.consultation_fee")}</FieldLabel>
                  <input style={inpNoIcon} type="number" value={consultationFee} onChange={e => setConsultationFee(e.target.value)}
                    placeholder={t("profile.fee_placeholder")}
                    onFocus={e => (e.target.style.borderColor = "#7c3aed")} onBlur={e => (e.target.style.borderColor = "#e2e8f0")} />
                </div>
              </div>
            </CardSection>
          )}

          {/* Save */}
          <button type="submit" disabled={saving} style={{
            width: "100%", height: 54, borderRadius: 16, border: "none",
            cursor: saving ? "wait" : "pointer",
            background: saved ? "linear-gradient(135deg,#16a34a,#15803d)" : meta.gradient,
            color: "#fff", fontSize: 15, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            transition: "all 0.25s", boxShadow: `0 6px 20px ${meta.accentColor}40`,
          }}>
            {saving
              ? <><Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> {t("profile.saving")}</>
              : saved
              ? <><CheckCircle2 size={18} /> {t("profile.saved_success")}</>
              : t("profile.save_changes")
            }
          </button>
        </form>

        {/* Health sections */}
        {user.role === "patient" && (
          <div style={{ marginTop: 20 }}>
            <HealthProfileContent hideDocumentsAndIncidents hideVitals />
          </div>
        )}
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
