import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  collection, query, where, getDocs, doc,
  addDoc, updateDoc, orderBy, limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { HealthProfileContent } from "@/components/HealthProfileContent";
import { QrAccessContent } from "@/components/QrAccessContent";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  FileText, FlaskConical, Users, ShieldCheck, QrCode,
  CalendarDays, Trash2, Search, Globe, Building2,
  Heart, Clock, Plus, Sparkles,
} from "lucide-react";
import type { MedicalRecord, LabResult, Appointment, AccessPermission, PatientProfile } from "@/lib/types";

type Tab = "records" | "health_profile" | "labs" | "my_team" | "appointments" | "share_qr";
type Section = "overview" | "access";

const STATUS = {
  normal:    { bg: "#dcfce7", color: "#16a34a" },
  critical:  { bg: "#fee2e2", color: "#dc2626" },
  abnormal:  { bg: "#fef3c7", color: "#d97706" },
  pending:   { bg: "#f1f5f9", color: "#64748b" },
  confirmed: { bg: "#dcfce7", color: "#16a34a" },
  cancelled: { bg: "#fee2e2", color: "#dc2626" },
  completed: { bg: "#eff6ff", color: "#2563eb" },
};

function Pill({ status, label }: { status: string; label: string }) {
  const s = STATUS[status as keyof typeof STATUS] ?? { bg: "#f1f5f9", color: "#64748b" };
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: s.bg, color: s.color }}>
      {label}
    </span>
  );
}

function EmptyState({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "52px 24px" }}>
      <div style={{ width: 56, height: 56, borderRadius: 16, background: "linear-gradient(135deg, #e0e7ff, #dbeafe)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={24} style={{ color: "#6366f1" }} />
      </div>
      <p style={{ fontSize: 14, color: "#94a3b8", fontWeight: 500, margin: 0 }}>{text}</p>
    </div>
  );
}

export default function PatientDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("records");
  const [activeSection, setActiveSection] = useState<Section>("overview");

  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [labResults, setLabResults] = useState<LabResult[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [permissions, setPermissions] = useState<AccessPermission[]>([]);
  const [loading, setLoading] = useState(true);

  const [universalAccess, setUniversalAccess] = useState(false);
  const [hospitalAccess, setHospitalAccess] = useState(false);
  const [showUniversalDialog, setShowUniversalDialog] = useState(false);

  const [spitarIdSearch, setSpitarIdSearch] = useState("");
  const [searchResult, setSearchResult] = useState<{ uid: string; name: string; role: string; spitarId: string } | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");

  useEffect(() => {
    if (!user) return;
    const profile = user as PatientProfile;
    setUniversalAccess(profile.universalDoctorAccess ?? false);
    setHospitalAccess(profile.hospitalOpenAccess ?? false);
    async function load() {
      setLoading(true);
      const uid = user!.uid;
      const [recSnap, labSnap, apptSnap, permSnap] = await Promise.all([
        getDocs(query(collection(db, "medical_records"), where("patientId", "==", uid), orderBy("createdAt", "desc"), limit(20))),
        getDocs(query(collection(db, "lab_results"), where("patientId", "==", uid), orderBy("createdAt", "desc"), limit(20))),
        getDocs(query(collection(db, "appointments"), where("patientId", "==", uid), orderBy("date", "desc"), limit(20))),
        getDocs(query(collection(db, "access_permissions"), where("patientId", "==", uid), where("isActive", "==", true))),
      ]);
      setRecords(recSnap.docs.map(d => ({ id: d.id, ...d.data() } as MedicalRecord)));
      setLabResults(labSnap.docs.map(d => ({ id: d.id, ...d.data() } as LabResult)));
      setAppointments(apptSnap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment)));
      setPermissions(permSnap.docs.map(d => ({ id: d.id, ...d.data() } as AccessPermission)));
      setLoading(false);
    }
    load();
  }, [user]);

  const toggleUniversalAccess = async (value: boolean) => {
    if (!user) return;
    await updateDoc(doc(db, "users", user.uid), { universalDoctorAccess: value });
    setUniversalAccess(value);
    setShowUniversalDialog(false);
  };

  const searchProvider = async () => {
    if (!spitarIdSearch.trim()) return;
    setSearchLoading(true); setSearchError(""); setSearchResult(null);
    try {
      const snap = await getDocs(query(
        collection(db, "users"),
        where("spitarId", "==", spitarIdSearch.trim().toUpperCase()),
        where("role", "in", ["doctor", "hospital"]),
      ));
      if (snap.empty) { setSearchError(t("dashboard.provider_not_found")); }
      else {
        const d = snap.docs[0].data();
        setSearchResult({ uid: snap.docs[0].id, name: `${d.firstName} ${d.lastName}`, role: d.role, spitarId: d.spitarId });
      }
    } catch { setSearchError(t("common.error")); }
    finally { setSearchLoading(false); }
  };

  const grantAccess = async () => {
    if (!user || !searchResult) return;
    if (permissions.some(p => p.granteeId === searchResult.uid)) { setSearchError(t("dashboard.already_authorized")); return; }
    try {
      const perm: Omit<AccessPermission, "id"> = {
        patientId: user.uid, granteeId: searchResult.uid,
        granteeRole: searchResult.role as "doctor" | "hospital",
        granteeName: searchResult.name, grantedAt: new Date().toISOString(), isActive: true,
      };
      const ref = await addDoc(collection(db, "access_permissions"), perm);
      setPermissions(prev => [...prev, { id: ref.id, ...perm }]);
      setSearchResult(null); setSpitarIdSearch("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSearchError(msg);
    }
  };

  const revokeAccess = async (permId: string) => {
    await updateDoc(doc(db, "access_permissions", permId), { isActive: false, revokedAt: new Date().toISOString() });
    setPermissions(prev => prev.filter(p => p.id !== permId));
  };

  const navItems = [
    { label: t("nav.dashboard"), href: "/dashboard", icon: Sparkles, onClick: () => { setActiveSection("overview"); setActiveTab("records"); }, active: activeSection === "overview" && activeTab === "records" },
    { label: t("records.medical_records"), href: "/dashboard", icon: FileText, onClick: () => { setActiveSection("overview"); setActiveTab("records"); }, active: activeSection === "overview" && activeTab === "records" },
    { label: t("records.lab_results"), href: "/dashboard", icon: FlaskConical, onClick: () => { setActiveSection("overview"); setActiveTab("labs"); }, active: activeSection === "overview" && activeTab === "labs" },
    { label: t("dashboard.authorized_providers"), href: "/dashboard", icon: ShieldCheck, onClick: () => setActiveSection("access"), active: activeSection === "access" },
    { label: t("dashboard.share_qr"), href: "/dashboard", icon: QrCode, onClick: () => { setActiveSection("overview"); setActiveTab("share_qr"); }, active: activeSection === "overview" && activeTab === "share_qr" },
  ];

  const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "records", label: t("records.medical_records"), icon: FileText },
    { key: "health_profile", label: t("nav.health_profile"), icon: Heart },
    { key: "labs", label: t("records.lab_results"), icon: FlaskConical },
    { key: "my_team", label: t("dashboard.my_medical_team"), icon: ShieldCheck },
    { key: "appointments", label: t("appointments.title"), icon: CalendarDays },
    { key: "share_qr", label: t("dashboard.share_qr"), icon: QrCode },
  ];

  const STATS = [
    { label: t("records.medical_records"), value: records.length, icon: FileText, grad: "linear-gradient(135deg, #2563eb, #06b6d4)" },
    { label: t("records.lab_results"), value: labResults.length, icon: FlaskConical, grad: "linear-gradient(135deg, #0891b2, #16a34a)" },
    { label: t("dashboard.authorized_providers"), value: permissions.length, icon: Users, grad: "linear-gradient(135deg, #7c3aed, #2563eb)" },
    { label: t("dashboard.pending_requests"), value: 0, icon: Clock, grad: "linear-gradient(135deg, #d97706, #f59e0b)" },
    { label: t("appointments.title"), value: appointments.length, icon: CalendarDays, grad: "linear-gradient(135deg, #0d9488, #16a34a)" },
  ];

  const initials = `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`.toUpperCase();
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <DashboardLayout navItems={navItems} title={t("dashboard.patient_dashboard")}>

      {/* ── HERO BANNER ── */}
      <div style={{
        borderRadius: 20, overflow: "hidden", marginBottom: 24, position: "relative",
        background: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 50%, #06b6d4 100%)",
        padding: "28px 32px",
      }}>
        {/* decorative circles */}
        <div style={{ position: "absolute", top: -60, right: -60, width: 220, height: 220, borderRadius: "50%", background: "rgba(255,255,255,0.06)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -40, right: 180, width: 140, height: 140, borderRadius: "50%", background: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />

        <div style={{ display: "flex", alignItems: "center", gap: 18, position: "relative" }}>
          <div style={{ width: 60, height: 60, borderRadius: 18, background: "rgba(255,255,255,0.2)", border: "2px solid rgba(255,255,255,0.35)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ color: "#fff", fontWeight: 800, fontSize: 22 }}>{initials}</span>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, margin: "0 0 4px", fontWeight: 500 }}>{today}</p>
            <h2 style={{ color: "#fff", fontSize: 22, fontWeight: 800, margin: "0 0 6px", lineHeight: 1.2 }}>
              {t("dashboard.welcome")}, {user?.firstName}! 👋
            </h2>
            <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 12px", borderRadius: 20, background: "rgba(255,255,255,0.18)", color: "rgba(255,255,255,0.9)", textTransform: "capitalize" }}>
              {user?.role} · {user?.spitarId}
            </span>
          </div>
          <button
            onClick={() => setActiveSection("access")}
            style={{ padding: "10px 18px", borderRadius: 12, background: "rgba(255,255,255,0.15)", border: "1.5px solid rgba(255,255,255,0.3)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, backdropFilter: "blur(8px)", flexShrink: 0 }}
          >
            <ShieldCheck size={15} /> {t("dashboard.authorized_providers")}
          </button>
        </div>
      </div>

      {/* ── STAT CARDS ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14, marginBottom: 24 }}>
        {STATS.map(({ label, value, icon: Icon, grad }) => (
          <div key={label} style={{
            background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0",
            padding: "18px 16px", display: "flex", flexDirection: "column", gap: 14,
            boxShadow: "0 1px 4px rgba(0,0,0,0.04)", transition: "transform 0.15s, box-shadow 0.15s",
            cursor: "default",
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 6px 20px rgba(0,0,0,0.09)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = "0 1px 4px rgba(0,0,0,0.04)"; }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 11, background: grad, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon size={18} style={{ color: "#fff" }} />
            </div>
            <div>
              <p style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", margin: 0, lineHeight: 1 }}>{value}</p>
              <p style={{ fontSize: 11, color: "#94a3b8", margin: "5px 0 0", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── ACCESS CONTROL ── */}
      {activeSection === "access" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", margin: 0 }}>{t("dashboard.authorized_providers")}</h3>
            <button onClick={() => setActiveSection("overview")} style={{ fontSize: 13, color: "#2563eb", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
              ← Back to Dashboard
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Universal Doctor Access */}
            <div style={{ background: universalAccess ? "linear-gradient(135deg, #eff6ff, #dbeafe)" : "#fff", border: `1.5px solid ${universalAccess ? "#93c5fd" : "#e2e8f0"}`, borderRadius: 16, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #2563eb, #06b6d4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Globe size={16} style={{ color: "#fff" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", margin: 0 }}>{t("dashboard.universal_doctor_access_title")}</p>
                </div>
                <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 20, background: universalAccess ? "#dcfce7" : "#f1f5f9", color: universalAccess ? "#16a34a" : "#94a3b8" }}>
                  {universalAccess ? "ON" : "OFF"}
                </span>
              </div>
              <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 14px", lineHeight: 1.6 }}>
                {universalAccess ? t("dashboard.universal_doctor_access_on") : t("dashboard.universal_doctor_access_off")}
              </p>
              {universalAccess ? (
                <button onClick={() => toggleUniversalAccess(false)} style={{ padding: "7px 16px", borderRadius: 10, background: "#fee2e2", color: "#dc2626", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  {t("common.disable")}
                </button>
              ) : (
                <button onClick={() => setShowUniversalDialog(true)} style={{ padding: "7px 16px", borderRadius: 10, background: "linear-gradient(135deg, #2563eb, #06b6d4)", color: "#fff", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  {t("common.enable")}
                </button>
              )}
            </div>

            {/* Hospital Open Access */}
            <div style={{ background: hospitalAccess ? "linear-gradient(135deg, #f0fdf4, #dcfce7)" : "#fff", border: `1.5px solid ${hospitalAccess ? "#86efac" : "#e2e8f0"}`, borderRadius: 16, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #0d9488, #16a34a)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Building2 size={16} style={{ color: "#fff" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", margin: 0 }}>{t("dashboard.hospital_open_access_title")}</p>
                </div>
                <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 20, background: hospitalAccess ? "#dcfce7" : "#f1f5f9", color: hospitalAccess ? "#16a34a" : "#94a3b8" }}>
                  {hospitalAccess ? "ON" : "OFF"}
                </span>
              </div>
              <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 14px", lineHeight: 1.6 }}>
                {hospitalAccess ? t("dashboard.hospital_open_access_on") : t("dashboard.hospital_open_access_off")}
              </p>
              <button
                onClick={async () => { if (!user) return; await updateDoc(doc(db, "users", user.uid), { hospitalOpenAccess: !hospitalAccess }); setHospitalAccess(v => !v); }}
                style={{ padding: "7px 16px", borderRadius: 10, background: hospitalAccess ? "#fee2e2" : "linear-gradient(135deg, #0d9488, #16a34a)", color: hospitalAccess ? "#dc2626" : "#fff", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
              >
                {hospitalAccess ? t("common.disable") : t("common.enable")}
              </button>
            </div>
          </div>

          {/* Add provider */}
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", margin: "0 0 14px" }}>{t("dashboard.add_by_id")}</p>
            <div style={{ display: "flex", gap: 10 }}>
              <input
                style={{ flex: 1, height: 44, padding: "0 14px", border: "1.5px solid #e2e8f0", borderRadius: 12, fontSize: 14, outline: "none", background: "#f8fafc", color: "#0f172a", boxSizing: "border-box", transition: "border-color 0.15s" }}
                placeholder={t("dashboard.search_placeholder")} value={spitarIdSearch}
                onChange={e => setSpitarIdSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && searchProvider()}
                onFocus={e => (e.target.style.borderColor = "#2563eb")} onBlur={e => (e.target.style.borderColor = "#e2e8f0")}
              />
              <button onClick={searchProvider} disabled={searchLoading} style={{ padding: "0 20px", height: 44, borderRadius: 12, background: "linear-gradient(135deg, #2563eb, #06b6d4)", color: "#fff", border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                <Search size={15} /> {t("common.search")}
              </button>
            </div>
            {searchError && <p style={{ fontSize: 13, color: "#dc2626", margin: "8px 0 0" }}>{searchError}</p>}
            {searchResult && (
              <div style={{ marginTop: 12, padding: "12px 16px", background: "#f0f9ff", border: "1.5px solid #bae6fd", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "#0f172a" }}>{searchResult.name}</p>
                  <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0", textTransform: "capitalize" }}>{searchResult.role} · {searchResult.spitarId}</p>
                </div>
                <button onClick={grantAccess} style={{ padding: "7px 16px", borderRadius: 10, background: "linear-gradient(135deg, #2563eb, #06b6d4)", color: "#fff", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                  <Plus size={13} /> {t("dashboard.authorize_access")}
                </button>
              </div>
            )}
          </div>

          {/* Active permissions */}
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9" }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{t("dashboard.active_permissions")}</span>
            </div>
            <div style={{ padding: "0 20px" }}>
              {permissions.length === 0 ? (
                <EmptyState icon={ShieldCheck} text={t("dashboard.no_active_permissions")} />
              ) : (
                permissions.map(p => (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: "1px solid #f8fafc" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 10, background: p.granteeRole === "doctor" ? "linear-gradient(135deg, #7c3aed, #2563eb)" : "linear-gradient(135deg, #0d9488, #16a34a)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ color: "#fff", fontSize: 14, fontWeight: 800 }}>{p.granteeName[0]}</span>
                      </div>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "#0f172a" }}>{p.granteeName}</p>
                        <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0", textTransform: "capitalize" }}>{p.granteeRole} · {t("dashboard.since")} {new Date(p.grantedAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <button onClick={() => revokeAccess(p.id)} style={{ background: "#fee2e2", border: "none", borderRadius: 10, cursor: "pointer", color: "#dc2626", padding: "6px 12px", fontSize: 12, fontWeight: 700 }}>
                      Revoke
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── OVERVIEW TABS ── */}
      {activeSection === "overview" && (
        <>
          {/* Pill tab bar */}
          <div style={{ background: "#f1f5f9", borderRadius: 14, padding: 5, display: "inline-flex", gap: 4, marginBottom: 20, overflowX: "auto", maxWidth: "100%" }}>
            {TABS.map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => setActiveTab(key)} style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600,
                cursor: "pointer", border: "none", whiteSpace: "nowrap", transition: "all 0.15s",
                background: activeTab === key ? "#fff" : "transparent",
                color: activeTab === key ? "#2563eb" : "#64748b",
                boxShadow: activeTab === key ? "0 1px 6px rgba(0,0,0,0.1)" : "none",
              }}>
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div>
            {/* Medical Records */}
            {activeTab === "records" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {records.length === 0 ? (
                  <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0" }}>
                    <EmptyState icon={FileText} text={t("common.no_data")} />
                  </div>
                ) : records.map(r => (
                  <div key={r.id} style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: "16px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.03)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: "#ede9fe", color: "#7c3aed", textTransform: "capitalize" }}>{r.type}</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{r.title}</span>
                    </div>
                    <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 6px" }}>Dr. {r.doctorName} · {r.date}</p>
                    <p style={{ fontSize: 13, color: "#64748b", margin: 0, lineHeight: 1.6 }}>{r.description}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Health Profile */}
            {activeTab === "health_profile" && (
              <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: 20 }}>
                <HealthProfileContent />
              </div>
            )}

            {/* Lab Results */}
            {activeTab === "labs" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {labResults.length === 0 ? (
                  <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0" }}>
                    <EmptyState icon={FlaskConical} text={t("records.lab_no_results")} />
                  </div>
                ) : labResults.map(r => (
                  <div key={r.id} style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: "16px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.03)", display: "flex", gap: 14, alignItems: "flex-start" }}>
                    <Pill status={r.status} label={t(`records.${r.status}`)} />
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", margin: "0 0 4px" }}>{r.testName}</p>
                      <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 6px" }}>{r.labName} · {r.date}</p>
                      <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>{r.result}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* My Medical Team */}
            {activeTab === "my_team" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {permissions.length === 0 ? (
                  <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0" }}>
                    <EmptyState icon={Users} text={t("dashboard.no_active_permissions")} />
                  </div>
                ) : permissions.map(p => (
                  <div key={p.id} style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: "14px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.03)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 42, height: 42, borderRadius: 12, background: p.granteeRole === "doctor" ? "linear-gradient(135deg, #7c3aed, #2563eb)" : "linear-gradient(135deg, #0d9488, #16a34a)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ color: "#fff", fontSize: 16, fontWeight: 800 }}>{p.granteeName[0]}</span>
                      </div>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "#0f172a" }}>{p.granteeName}</p>
                        <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0", textTransform: "capitalize" }}>{p.granteeRole} · {t("dashboard.since")} {new Date(p.grantedAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <button onClick={() => revokeAccess(p.id)} style={{ background: "#fee2e2", border: "none", borderRadius: 10, cursor: "pointer", color: "#dc2626", padding: "6px 14px", fontSize: 12, fontWeight: 700 }}>
                      Revoke
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Appointments */}
            {activeTab === "appointments" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {appointments.length === 0 ? (
                  <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0" }}>
                    <EmptyState icon={CalendarDays} text={t("appointments.no_appointments")} />
                  </div>
                ) : appointments.map(a => (
                  <div key={a.id} style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: "16px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.03)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <Pill status={a.status} label={t(`appointments.status_${a.status}`)} />
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>Dr. {a.doctorName}</span>
                    </div>
                    <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>{a.date} · {a.time}</p>
                    {a.reason && <p style={{ fontSize: 13, color: "#64748b", margin: "6px 0 0" }}>{a.reason}</p>}
                  </div>
                ))}
              </div>
            )}

            {/* Share QR */}
            {activeTab === "share_qr" && (
              <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: 20 }}>
                <QrAccessContent />
              </div>
            )}
          </div>
        </>
      )}

      {/* Universal access dialog */}
      <AlertDialog open={showUniversalDialog} onOpenChange={setShowUniversalDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("dashboard.enable_universal_doctor_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("dashboard.enable_universal_doctor_desc")}
              <span style={{ display: "block", marginTop: 8, color: "#d97706", fontWeight: 600 }}>{t("dashboard.universal_doctor_access_warn")}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => toggleUniversalAccess(true)}>{t("common.confirm")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
