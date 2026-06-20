import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  collection, query, where, getDocs, doc,
  addDoc, updateDoc, orderBy, limit, deleteDoc, setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { sendNotification } from "@/lib/notifications";
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
  Heart, Clock, Plus, Sparkles, CalendarPlus, CheckCircle, XCircle, X,
  MessageCircle, ArrowRight, AlertCircle, ClipboardList, ShieldAlert,
  BarChart2, Bot, CalendarCheck,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { MedicalRecord, LabResult, Appointment, AccessPermission, PatientProfile } from "@/lib/types";
import { RatingDialog } from "@/components/RatingDialog";
import { PatientTeleconsultation } from "@/components/TeleconsultationTab";
import { PatientReferrals } from "@/components/ReferralsTab";
import { PatientVisitSummaries } from "@/components/VisitSummary";
import { EmergencyCardManager } from "@/components/EmergencyCardManager";
import { useAppointmentReminders } from "@/hooks/useAppointmentReminders";
import { useMedicationReminders } from "@/hooks/useMedicationReminders";
import { LabTrendChart } from "@/components/LabTrendChart";
import { AiHealthChat } from "@/components/AiHealthChat";
import { PatientTreatmentPlan } from "@/components/TreatmentPlan";
import { HealthReport } from "@/components/HealthReport";

type Tab = "records" | "health_profile" | "labs" | "my_team" | "appointments" | "share_qr" | "pending_requests" | "teleconsult" | "referrals" | "summaries" | "emergency" | "report" | "chat" | "treatment";
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
  const [medications, setMedications] = useState<{ name: string; dosage?: string; frequency?: string; reminderTimes?: string[] }[]>([]);
  const [accessRequests, setAccessRequests] = useState<{ id: string; doctorId: string; doctorName: string; status: string; createdAt: string }[]>([]);
  const [showPendingRequests, setShowPendingRequests] = useState(false);
  const [loading, setLoading] = useState(true);

  const [ratingDialog, setRatingDialog] = useState<{ open: boolean; appointmentId: string; doctorId: string; doctorName: string } | null>(null);
  const [apptDialog, setApptDialog] = useState<{ open: boolean; doctorId: string; doctorName: string }>({ open: false, doctorId: "", doctorName: "" });
  const [apptForm, setApptForm] = useState({ date: "", time: "", reason: "" });
  const [savingAppt, setSavingAppt] = useState(false);

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
      const [recSnap, labSnap, apptSnap, permSnap, reqSnap, medSnap] = await Promise.allSettled([
        getDocs(query(collection(db, "medical_records"), where("patientId", "==", uid), orderBy("createdAt", "desc"), limit(20))),
        getDocs(query(collection(db, "lab_results"), where("patientId", "==", uid), orderBy("createdAt", "desc"), limit(20))),
        getDocs(query(collection(db, "appointments"), where("patientId", "==", uid), orderBy("date", "desc"), limit(20))),
        getDocs(query(collection(db, "access_permissions"), where("patientId", "==", uid), where("isActive", "==", true))),
        getDocs(query(collection(db, "access_requests"), where("patientId", "==", uid))),
        getDocs(query(collection(db, "patient_medications"), where("patientId", "==", uid))),
      ]);
      if (recSnap.status === "fulfilled") setRecords(recSnap.value.docs.map(d => ({ id: d.id, ...d.data() } as MedicalRecord)));
      if (labSnap.status === "fulfilled") setLabResults(labSnap.value.docs.map(d => ({ id: d.id, ...d.data() } as LabResult)));
      if (apptSnap.status === "fulfilled") setAppointments(apptSnap.value.docs.map(d => ({ id: d.id, ...d.data() } as Appointment)).filter(a => !(a as any).hiddenForPatient));
      if (permSnap.status === "fulfilled") setPermissions(permSnap.value.docs.map(d => ({ id: d.id, ...d.data() } as AccessPermission)));
      if (reqSnap.status === "fulfilled") setAccessRequests(reqSnap.value.docs.map(d => ({ id: d.id, ...d.data() } as { id: string; doctorId: string; doctorName: string; status: string; createdAt: string })).filter(r => r.status === "pending"));
      if (medSnap.status === "fulfilled") setMedications(medSnap.value.docs.map(d => d.data() as { name: string; dosage?: string; frequency?: string; reminderTimes?: string[] }));
      setLoading(false);
    }
    load();
  }, [user]);

  const approveRequest = async (req: { id: string; doctorId: string; doctorName: string }) => {
    if (!user) return;
    // Grant access permission
    const perm: Omit<AccessPermission, "id"> = {
      patientId: user.uid, granteeId: req.doctorId,
      granteeRole: "doctor",
      granteeName: req.doctorName, grantedAt: new Date().toISOString(), isActive: true,
    };
    const ref = await addDoc(collection(db, "access_permissions"), perm);
    setPermissions(prev => [...prev, { id: ref.id, ...perm }]);
    await updateDoc(doc(db, "access_requests", req.id), { status: "approved" });
    setAccessRequests(prev => prev.filter(r => r.id !== req.id));
    sendNotification(
      req.doctorId, "access_approved",
      `${user.firstName} ${user.lastName}`,
      "approved your request to access their medical file",
    ).catch(() => {});
  };

  const rejectRequest = async (req: { id: string; doctorId: string }) => {
    await updateDoc(doc(db, "access_requests", req.id), { status: "rejected" });
    setAccessRequests(prev => prev.filter(r => r.id !== req.id));
    if (user) sendNotification(
      req.doctorId, "access_rejected",
      "Access Request Declined",
      "The patient declined your request to access their medical file",
    ).catch(() => {});
  };

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

  const requestAppointment = async () => {
    if (!user || !apptDialog.doctorId || !apptForm.date || !apptForm.time) return;
    setSavingAppt(true);
    try {
      const appt = {
        patientId: user.uid,
        patientName: `${user.firstName} ${user.lastName}`,
        doctorId: apptDialog.doctorId,
        doctorName: apptDialog.doctorName,
        date: apptForm.date,
        time: apptForm.time,
        reason: apptForm.reason,
        status: "pending",
        createdAt: new Date().toISOString(),
      };
      const ref = await addDoc(collection(db, "appointments"), appt);
      setAppointments(prev => [{ id: ref.id, ...appt } as Appointment, ...prev]);
      // Close dialog immediately
      setApptDialog({ open: false, doctorId: "", doctorName: "" });
      setApptForm({ date: "", time: "", reason: "" });
      setActiveSection("overview");
      setActiveTab("appointments");
      // Send notification silently (don't block on failure)
      sendNotification(
        apptDialog.doctorId, "appointment_request",
        `${user.firstName} ${user.lastName}`,
        `is requesting an appointment on ${apptForm.date} at ${apptForm.time}`,
      ).catch(() => {});
    } finally {
      setSavingAppt(false);
    }
  };

  const acceptReschedule = async (appt: Appointment) => {
    await updateDoc(doc(db, "appointments", appt.id), {
      status: "confirmed",
      date: appt.rescheduleDate ?? appt.date,
      time: appt.rescheduleTime ?? appt.time,
      rescheduleDate: null,
      rescheduleTime: null,
    });
    setAppointments(prev => prev.map(a => a.id === appt.id ? {
      ...a, status: "confirmed" as const,
      date: appt.rescheduleDate ?? appt.date,
      time: appt.rescheduleTime ?? appt.time,
      rescheduleDate: undefined, rescheduleTime: undefined,
    } : a));
    if (user) sendNotification(
      appt.doctorId, "appointment_confirmed",
      `${user.firstName} ${user.lastName}`,
      `accepted the rescheduled appointment on ${appt.rescheduleDate} at ${appt.rescheduleTime}`,
    ).catch(() => {});
  };

  const deleteAppointment = async (apptId: string) => {
    await updateDoc(doc(db, "appointments", apptId), { hiddenForPatient: true });
    setAppointments(prev => prev.filter(a => a.id !== apptId));
  };

  const declineReschedule = async (appt: Appointment) => {
    await updateDoc(doc(db, "appointments", appt.id), { status: "cancelled" });
    setAppointments(prev => prev.map(a => a.id === appt.id ? { ...a, status: "cancelled" as const } : a));
    if (user) sendNotification(
      appt.doctorId, "appointment_cancelled",
      `${user.firstName} ${user.lastName}`,
      "declined the rescheduled appointment",
    ).catch(() => {});
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
    { key: "summaries", label: "Visit Summaries", icon: ClipboardList },
    { key: "teleconsult", label: "Teleconsultation", icon: MessageCircle },
    { key: "referrals", label: "Referrals", icon: ArrowRight },
    { key: "emergency", label: "Emergency Card", icon: ShieldAlert },
    { key: "report", label: "Health Report", icon: BarChart2 },
    { key: "treatment", label: "Treatment Plan", icon: CalendarCheck },
    { key: "chat", label: "Health Assistant", icon: Bot },
    { key: "share_qr", label: t("dashboard.share_qr"), icon: QrCode },
  ];

  // Browser appointment reminders
  useAppointmentReminders(appointments, "patient");
  // Medication daily reminders
  useMedicationReminders(medications);

  // Checkup reminder: show banner if no medical record in 6+ months
  const sixMonthsAgo = new Date(); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const lastRecord = records[0];
  const showCheckupBanner = !loading && (!lastRecord || new Date(lastRecord.createdAt) < sixMonthsAgo);

  const STATS = [
    { label: t("records.medical_records"), value: records.length, icon: FileText, grad: "linear-gradient(135deg, #2563eb, #06b6d4)", onClick: (() => { setActiveSection("overview"); setActiveTab("records"); }) as (() => void) | undefined },
    { label: t("records.lab_results"), value: labResults.length, icon: FlaskConical, grad: "linear-gradient(135deg, #0891b2, #16a34a)", onClick: () => { setActiveSection("overview"); setActiveTab("labs"); } },
    { label: t("dashboard.authorized_providers"), value: permissions.length, icon: Users, grad: "linear-gradient(135deg, #7c3aed, #2563eb)", onClick: () => setActiveSection("access") },
    { label: t("dashboard.pending_requests"), value: accessRequests.length, icon: Clock, grad: "linear-gradient(135deg, #d97706, #f59e0b)", onClick: accessRequests.length > 0 ? () => { setActiveSection("overview"); setActiveTab("pending_requests"); } : undefined },
    { label: t("appointments.title"), value: appointments.length, icon: CalendarDays, grad: "linear-gradient(135deg, #0d9488, #16a34a)", onClick: () => { setActiveSection("overview"); setActiveTab("appointments"); } },
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
        </div>
      </div>

      {/* ── CHECKUP REMINDER BANNER ── */}
      {showCheckupBanner && (
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 20px", borderRadius: 14, background: "linear-gradient(135deg, #fef3c7, #fde68a)", border: "1.5px solid #fbbf24", marginBottom: 20 }}>
          <AlertCircle size={22} style={{ color: "#d97706", flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#92400e", margin: 0 }}>Periodic Checkup Reminder</p>
            <p style={{ fontSize: 13, color: "#78350f", margin: "2px 0 0" }}>
              {lastRecord ? `Your last medical record was over 6 months ago (${lastRecord.date}). It's time for a checkup.` : "You have no medical records yet. Schedule a checkup with your doctor."}
            </p>
          </div>
          <button onClick={() => { setActiveSection("overview"); setActiveTab("appointments"); }} style={{ background: "#d97706", color: "#fff", border: "none", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
            Book Appointment
          </button>
        </div>
      )}

      {/* ── STAT CARDS ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14, marginBottom: 24 }}>
        {STATS.map(({ label, value, icon: Icon, grad, onClick }) => (
          <div key={label}
            onClick={onClick}
            style={{
              background: "#fff", borderRadius: 16,
              border: onClick ? "1.5px solid #fde68a" : "1px solid #e2e8f0",
              padding: "18px 16px", display: "flex", flexDirection: "column", gap: 14,
              boxShadow: "0 1px 4px rgba(0,0,0,0.04)", transition: "transform 0.15s, box-shadow 0.15s",
              cursor: "pointer",
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
                    <div style={{ display: "flex", gap: 8 }}>
                      {p.granteeRole === "doctor" && (
                        <button
                          onClick={() => { setApptDialog({ open: true, doctorId: p.granteeId, doctorName: p.granteeName }); setApptForm({ date: "", time: "", reason: "" }); }}
                          style={{ background: "linear-gradient(135deg, #2563eb, #06b6d4)", border: "none", borderRadius: 10, cursor: "pointer", color: "#fff", padding: "6px 14px", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>
                          <CalendarPlus size={13} /> {t("appointments.request_appointment")}
                        </button>
                      )}
                      <button onClick={() => revokeAccess(p.id)} style={{ background: "#fee2e2", border: "none", borderRadius: 10, cursor: "pointer", color: "#dc2626", padding: "6px 12px", fontSize: 12, fontWeight: 700 }}>
                        Revoke
                      </button>
                    </div>
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
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: "#ede9fe", color: "#7c3aed" }}>{t(`records.type_${r.type}`)}</span>
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
                <LabTrendChart labResults={labResults} />
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
                    <div style={{ display: "flex", gap: 8 }}>
                      {p.granteeRole === "doctor" && (
                        <button
                          onClick={() => { setApptDialog({ open: true, doctorId: p.granteeId, doctorName: p.granteeName }); setApptForm({ date: "", time: "", reason: "" }); }}
                          style={{ background: "linear-gradient(135deg, #2563eb, #06b6d4)", border: "none", borderRadius: 10, cursor: "pointer", color: "#fff", padding: "6px 14px", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>
                          <CalendarPlus size={13} /> {t("appointments.request_appointment")}
                        </button>
                      )}
                      <button onClick={() => revokeAccess(p.id)} style={{ background: "#fee2e2", border: "none", borderRadius: 10, cursor: "pointer", color: "#dc2626", padding: "6px 14px", fontSize: 12, fontWeight: 700 }}>
                        Revoke
                      </button>
                    </div>
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
                  <div key={a.id} style={{
                    background: a.status === "reschedule_requested" ? "#fffbeb" : "#fff",
                    borderRadius: 16,
                    border: a.status === "reschedule_requested" ? "1.5px solid #fde68a" : "1px solid #e2e8f0",
                    padding: "16px 20px",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
                  }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <Pill status={a.status === "reschedule_requested" ? "abnormal" : a.status} label={t(`appointments.status_${a.status}`)} />
                          <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>Dr. {a.doctorName}</span>
                        </div>
                        <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>{a.date} · {a.time}</p>
                        {a.status === "reschedule_requested" && a.rescheduleDate && (
                          <p style={{ fontSize: 12, color: "#d97706", margin: "4px 0 0", fontWeight: 600 }}>
                            {t("appointments.new_proposed")}: {a.rescheduleDate} · {a.rescheduleTime}
                          </p>
                        )}
                        {a.reason && <p style={{ fontSize: 13, color: "#64748b", margin: "6px 0 0" }}>{a.reason}</p>}
                      </div>
                      {a.status === "reschedule_requested" && (
                        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                          <button onClick={() => declineReschedule(a)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 10, background: "#fee2e2", color: "#dc2626", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                            <XCircle size={13} /> {t("common.reject")}
                          </button>
                          <button onClick={() => acceptReschedule(a)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 10, background: "linear-gradient(135deg, #16a34a, #0d9488)", color: "#fff", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                            <CheckCircle size={13} /> {t("common.approve")}
                          </button>
                        </div>
                      )}
                      {a.status === "completed" && (
                        <button onClick={() => setRatingDialog({ open: true, appointmentId: a.id, doctorId: a.doctorId, doctorName: a.doctorName })} style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 10, background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#fff", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                          ★ Rate
                        </button>
                      )}
                      {a.status === "cancelled" && (
                        <button onClick={() => deleteAppointment(a.id)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 10, background: "#fee2e2", color: "#dc2626", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                          <Trash2 size={13} /> {t("common.delete")}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Visit Summaries */}
            {activeTab === "summaries" && user && (
              <PatientVisitSummaries patientId={user.uid} />
            )}

            {/* Emergency Card */}
            {activeTab === "emergency" && (
              <div style={{ maxWidth: 600 }}>
                <EmergencyCardManager />
              </div>
            )}

            {/* Teleconsultation */}
            {activeTab === "teleconsult" && (
              <PatientTeleconsultation permissions={permissions} />
            )}

            {/* Referrals */}
            {activeTab === "referrals" && user && (
              <PatientReferrals patientId={user.uid} />
            )}

            {/* Health Report */}
            {activeTab === "report" && (
              <HealthReport
                records={records}
                labResults={labResults}
                appointments={appointments}
                patientName={user ? `${user.firstName} ${user.lastName}` : undefined}
              />
            )}

            {/* Treatment Plan */}
            {activeTab === "treatment" && user && (
              <PatientTreatmentPlan patientId={user.uid} />
            )}

            {/* Health Assistant AI */}
            {activeTab === "chat" && (
              <AiHealthChat />
            )}

            {/* Share QR */}
            {activeTab === "share_qr" && (
              <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: 20 }}>
                <QrAccessContent />
              </div>
            )}

            {/* Pending Requests */}
            {activeTab === "pending_requests" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {accessRequests.length === 0 ? (
                  <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0" }}>
                    <EmptyState icon={Clock} text={t("dashboard.pending_requests")} />
                  </div>
                ) : accessRequests.map(req => (
                  <div key={req.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderRadius: 16, border: "1.5px solid #fde68a", background: "#fffbeb", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg, #fbbf2433, #f59e0b33)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Clock size={20} style={{ color: "#d97706" }} />
                      </div>
                      <div>
                        <p style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", margin: 0 }}>{req.doctorName}</p>
                        <p style={{ fontSize: 13, color: "#64748b", margin: "2px 0 0" }}>{t("dashboard.access_request_desc")}</p>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                      <button onClick={() => rejectRequest(req)} style={{ padding: "9px 18px", borderRadius: 10, background: "#fee2e2", color: "#dc2626", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                        {t("common.reject")}
                      </button>
                      <button onClick={() => approveRequest(req).then(() => { if (accessRequests.length <= 1) setActiveTab("records"); })} style={{ padding: "9px 18px", borderRadius: 10, background: "linear-gradient(135deg, #16a34a, #0d9488)", color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                        {t("common.approve")}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Appointment Request Dialog */}
      <Dialog open={apptDialog.open} onOpenChange={open => setApptDialog(d => ({ ...d, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("appointments.request_appointment")} — {apptDialog.doctorName}</DialogTitle>
          </DialogHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "8px 0" }}>
            <div>
              <Label>{t("appointments.appt_date")}</Label>
              <input
                type="date"
                value={apptForm.date}
                min={new Date().toISOString().split("T")[0]}
                onChange={e => setApptForm(f => ({ ...f, date: e.target.value }))}
                style={{ width: "100%", height: 44, marginTop: 6, padding: "0 14px", border: "1.5px solid #e2e8f0", borderRadius: 12, fontSize: 14, outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <Label>{t("appointments.appt_time")}</Label>
              <input
                type="time"
                value={apptForm.time}
                onChange={e => setApptForm(f => ({ ...f, time: e.target.value }))}
                style={{ width: "100%", height: 44, marginTop: 6, padding: "0 14px", border: "1.5px solid #e2e8f0", borderRadius: 12, fontSize: 14, outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <Label>{t("appointments.appt_reason")}</Label>
              <textarea
                value={apptForm.reason}
                onChange={e => setApptForm(f => ({ ...f, reason: e.target.value }))}
                rows={3}
                placeholder={t("appointments.appt_reason_placeholder")}
                style={{ width: "100%", marginTop: 6, padding: "10px 14px", border: "1.5px solid #e2e8f0", borderRadius: 12, fontSize: 14, outline: "none", resize: "vertical", boxSizing: "border-box" }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApptDialog(d => ({ ...d, open: false }))}>{t("common.cancel")}</Button>
            <Button onClick={requestAppointment} disabled={savingAppt || !apptForm.date || !apptForm.time}>
              {savingAppt ? "..." : t("appointments.send_request")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rating Dialog */}
      {ratingDialog?.open && user && (
        <RatingDialog
          open={ratingDialog.open}
          onClose={() => setRatingDialog(null)}
          appointmentId={ratingDialog.appointmentId}
          doctorId={ratingDialog.doctorId}
          doctorName={ratingDialog.doctorName}
          patientId={user.uid}
          patientName={`${user.firstName} ${user.lastName}`}
        />
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
