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
  BarChart2, Bot, CalendarCheck, Pill as PillIcon,
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
type Section = "overview" | "access" | "emergency" | "health_profile" | "appointments" | "my_team" | "teleconsult" | "chat" | "labs" | "report";

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

  // ── new widget state ──
  const [profileData, setProfileData] = useState<Record<string, any>>({});
  const [allergiesCount, setAllergiesCount] = useState(0);
  const [takenMeds, setTakenMeds] = useState<Set<string>>(() => {
    try {
      const key = `taken_meds_${new Date().toDateString()}`;
      return new Set(JSON.parse(localStorage.getItem(key) ?? "[]"));
    } catch { return new Set(); }
  });

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

      // load profile for health summary
      try {
        const { getDoc: gd, doc: d2 } = await import("firebase/firestore");
        const uDoc = await gd(d2(db, "users", uid));
        if (uDoc.exists()) setProfileData(uDoc.data());
        const aSnap = await getDocs(query(collection(db, "patient_allergies"), where("patientId", "==", uid)));
        setAllergiesCount(aSnap.size);
      } catch {}

      setLoading(false);
    }
    load();
  }, [user]);

  const toggleMedTaken = (name: string) => {
    setTakenMeds(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      localStorage.setItem(`taken_meds_${new Date().toDateString()}`, JSON.stringify([...next]));
      return next;
    });
  };

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
    { label: t("nav.dashboard"), href: "/dashboard", icon: Sparkles, onClick: () => { setActiveSection("overview"); setActiveTab("records"); }, active: activeSection === "overview" },
    { label: t("nav.my_team"), href: "/dashboard", icon: Users, onClick: () => setActiveSection("my_team"), active: activeSection === "my_team" },
    { label: t("dashboard.emergency_card_quick"), href: "/dashboard", icon: ShieldAlert, onClick: () => setActiveSection("emergency"), active: activeSection === "emergency" },
    { label: t("dashboard.book_appointment_btn"), href: "/dashboard", icon: CalendarPlus, onClick: () => setActiveSection("appointments"), active: activeSection === "appointments" },
    { label: t("dashboard.share_qr_quick"), href: "/dashboard", icon: QrCode, onClick: () => { setActiveSection("overview"); setActiveTab("share_qr"); }, active: activeSection === "overview" && activeTab === "share_qr" },
    { label: t("dashboard.health_profile_quick"), href: "/dashboard", icon: Heart, onClick: () => setActiveSection("health_profile"), active: activeSection === "health_profile" },
    { label: t("records.lab_results"), href: "/dashboard", icon: FlaskConical, onClick: () => setActiveSection("labs"), active: activeSection === "labs" },
    { label: "Health Report", href: "/dashboard", icon: BarChart2, onClick: () => setActiveSection("report"), active: activeSection === "report" },
  ];

  const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "records", label: t("records.medical_records"), icon: FileText },
    { key: "summaries", label: "Visit Summaries", icon: ClipboardList },
    { key: "referrals", label: "Referrals", icon: ArrowRight },
    { key: "treatment", label: "Treatment Plan", icon: CalendarCheck },
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
    { label: t("nav.my_team"), value: permissions.length, icon: Users, grad: "linear-gradient(135deg, #7c3aed, #2563eb)", onClick: () => setActiveSection("my_team") },
    { label: t("dashboard.pending_requests"), value: accessRequests.length, icon: Clock, grad: "linear-gradient(135deg, #d97706, #f59e0b)", onClick: accessRequests.length > 0 ? () => { setActiveSection("overview"); setActiveTab("pending_requests"); } : undefined },
    { label: t("appointments.title"), value: appointments.length, icon: CalendarDays, grad: "linear-gradient(135deg, #0d9488, #16a34a)", onClick: () => { setActiveSection("overview"); setActiveTab("appointments"); } },
  ];

  const initials = `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`.toUpperCase();
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  // ── computed for widgets ──
  const todayStr = new Date().toISOString().split("T")[0];
  const nextAppt = appointments
    .filter(a => a.status === "confirmed" && a.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
  const daysUntilAppt = nextAppt
    ? Math.ceil((new Date(nextAppt.date).getTime() - Date.now()) / 86400000)
    : null;

  const HEALTH_TIPS = [
    "اشرب 8 أكواب من الماء يومياً للحفاظ على صحة الكلى والجلد.",
    "30 دقيقة من المشي يومياً تقلل خطر أمراض القلب بنسبة 35٪.",
    "النوم 7-8 ساعات يقوي جهاز المناعة ويحسن التركيز.",
    "تناول وجبة إفطار كاملة يُحسّن مستوى الطاقة طوال اليوم.",
    "قلّل الملح في طعامك للحفاظ على ضغط الدم في المعدل الطبيعي.",
    "الفحص الدوري مرة في السنة يكشف الأمراض مبكراً ويسهّل العلاج.",
    "تجنب الجلوس لأكثر من ساعة متواصلة — قم وتحرك لدقيقتين.",
  ];
  const dailyTip = HEALTH_TIPS[new Date().getDate() % HEALTH_TIPS.length];

  const CHRONIC_LABELS: Record<string, string> = {
    cancer: "السرطان", hiv: "فيروس نقص المناعة", tuberculosis: "السل",
    heart_disease: "أمراض القلب", kidney_disease: "أمراض الكلى",
    liver_disease: "أمراض الكبد", epilepsy: "الصرع", diabetes: "السكري",
    hypertension: "ضغط الدم", thyroid: "الغدة الدرقية",
  };
  const chronicList: string[] = (profileData.chronicConditions ?? []).filter((c: string) => c !== "pregnancy");

  const recentActivity = [
    ...records.slice(0, 3).map(r => ({ type: "record" as const, date: r.date ?? r.createdAt?.slice(0,10), label: r.title, sub: `د. ${r.doctorName}` })),
    ...labResults.slice(0, 2).map(r => ({ type: "lab" as const, date: r.date ?? r.createdAt?.slice(0,10), label: r.testName, sub: r.labName })),
    ...appointments.filter(a => a.status === "completed").slice(0, 2).map(a => ({ type: "appt" as const, date: a.date, label: `زيارة: د. ${a.doctorName}`, sub: a.reason ?? "" })),
  ].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")).slice(0, 5);

  return (
    <DashboardLayout navItems={navItems} title={t("dashboard.patient_dashboard")} headerActions={
      <>
        <button onClick={() => setActiveSection("teleconsult")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 10, background: activeSection === "teleconsult" ? "linear-gradient(135deg, #2563eb, #06b6d4)" : "#f1f5f9", color: activeSection === "teleconsult" ? "#fff" : "#475569", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          <MessageCircle size={15} /> Teleconsultation
        </button>
        <button onClick={() => setActiveSection("chat")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 10, background: activeSection === "chat" ? "linear-gradient(135deg, #7c3aed, #2563eb)" : "#f1f5f9", color: activeSection === "chat" ? "#fff" : "#475569", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          <Bot size={15} /> Health Assistant
        </button>
      </>
    }>

      {/* ── HERO BANNER ── */}
      {/* ── EMERGENCY CARD SECTION ── */}
      {activeSection === "emergency" && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <button onClick={() => setActiveSection("overview")} style={{ fontSize: 13, color: "#2563eb", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
              ← {t("nav.dashboard")}
            </button>
          </div>
          <EmergencyCardManager />
        </div>
      )}

      {/* ── APPOINTMENTS SECTION ── */}
      {activeSection === "appointments" && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <button onClick={() => setActiveSection("overview")} style={{ fontSize: 13, color: "#2563eb", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
              ← {t("nav.dashboard")}
            </button>
            {permissions.length > 0 ? (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <select
                  onChange={e => {
                    const p = permissions.find(p => p.granteeId === e.target.value);
                    if (p) { setApptDialog({ open: true, doctorId: p.granteeId, doctorName: p.granteeName }); setApptForm({ date: "", time: "", reason: "" }); }
                    e.target.value = "";
                  }}
                  defaultValue=""
                  style={{ height: 38, padding: "0 12px", border: "1.5px solid #2563eb", borderRadius: 10, fontSize: 13, color: "#2563eb", background: "#eff6ff", cursor: "pointer", outline: "none" }}
                >
                  <option value="" disabled>+ {t("appointments.request_appointment")}</option>
                  {permissions.filter(p => p.granteeRole === "doctor").map(p => (
                    <option key={p.granteeId} value={p.granteeId}>{p.granteeName}</option>
                  ))}
                </select>
              </div>
            ) : (
              <span style={{ fontSize: 12, color: "#94a3b8" }}>{t("dashboard.no_active_permissions")}</span>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {appointments.length === 0 ? (
              <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0" }}>
                <EmptyState icon={CalendarDays} text={t("appointments.no_appointments")} />
              </div>
            ) : appointments.map(a => {
              const isReschedule = a.status === "pending" && a.rescheduleDate;
              return (
                <div key={a.id} style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: "16px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.03)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Pill status={a.status} label={t(`appointments.status_${a.status}`)} />
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>Dr. {a.doctorName}</span>
                    </div>
                    <button onClick={() => deleteAppointment(a.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 4 }}><Trash2 size={15} /></button>
                  </div>
                  <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 6px" }}>{a.date} · {a.time ?? ""}</p>
                  {a.reason && <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>{a.reason}</p>}
                  {isReschedule && (
                    <div style={{ marginTop: 10, padding: "10px 14px", background: "#fef3c7", borderRadius: 10, border: "1px solid #fbbf24" }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#92400e", margin: "0 0 8px" }}>
                        {t("appointments.reschedule_proposed")}: {a.rescheduleDate} · {a.rescheduleTime}
                      </p>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => acceptReschedule(a)} style={{ padding: "5px 14px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                          <CheckCircle size={13} /> {t("common.accept")}
                        </button>
                        <button onClick={() => declineReschedule(a)} style={{ padding: "5px 14px", background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                          <XCircle size={13} /> {t("common.decline")}
                        </button>
                      </div>
                    </div>
                  )}
                  {a.status === "completed" && !a.rating && (
                    <button onClick={() => setRatingDialog({ open: true, appointmentId: a.id, doctorId: a.doctorId, doctorName: a.doctorName })}
                      style={{ marginTop: 8, padding: "5px 14px", background: "#fef3c7", border: "1px solid #fbbf24", borderRadius: 8, fontSize: 12, fontWeight: 600, color: "#92400e", cursor: "pointer" }}>
                      ⭐ {t("appointments.rate_doctor")}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── HEALTH PROFILE SECTION ── */}
      {activeSection === "health_profile" && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <button onClick={() => setActiveSection("overview")} style={{ fontSize: 13, color: "#2563eb", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
              ← {t("nav.dashboard")}
            </button>
          </div>
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: 20 }}>
            <HealthProfileContent />
          </div>
        </div>
      )}

      {/* MY TEAM */}
      {activeSection === "my_team" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => setActiveSection("overview")} style={{ fontSize: 13, color: "#2563eb", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
              ← {t("nav.dashboard")}
            </button>
          </div>

          {/* Access toggles */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
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

          {/* Pending Requests */}
          {accessRequests.length > 0 && (
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <div style={{ padding: "14px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 8 }}>
                <Clock size={15} style={{ color: "#d97706" }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{t("dashboard.pending_requests")} ({accessRequests.length})</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 16 }}>
                {accessRequests.map(req => (
                  <div key={req.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderRadius: 12, border: "1.5px solid #fde68a", background: "#fffbeb" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg, #fbbf2433, #f59e0b33)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Clock size={18} style={{ color: "#d97706" }} />
                      </div>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", margin: 0 }}>{req.doctorName}</p>
                        <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0" }}>{t("dashboard.access_request_desc")}</p>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => rejectRequest(req)} style={{ padding: "7px 14px", borderRadius: 10, background: "#fee2e2", color: "#dc2626", border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                        {t("common.reject")}
                      </button>
                      <button onClick={() => approveRequest(req)} style={{ padding: "7px 14px", borderRadius: 10, background: "linear-gradient(135deg, #16a34a, #0d9488)", color: "#fff", border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                        {t("common.approve")}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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

          {/* Team members list */}
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #f1f5f9" }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{t("dashboard.active_permissions")}</span>
            </div>
            <div style={{ padding: "0 20px" }}>
              {permissions.length === 0 ? (
                <EmptyState icon={Users} text={t("dashboard.no_active_permissions")} />
              ) : permissions.map(p => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: "1px solid #f8fafc" }}>
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
          </div>
        </div>
      )}

      {/* HEALTH REPORT */}
      {activeSection === "report" && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <button onClick={() => setActiveSection("overview")} style={{ fontSize: 13, color: "#2563eb", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
              ← {t("nav.dashboard")}
            </button>
          </div>
          <HealthReport
            records={records}
            labResults={labResults}
            appointments={appointments}
            patientName={user ? `${user.firstName} ${user.lastName}` : undefined}
          />
        </div>
      )}

      {/* LAB RESULTS */}
      {activeSection === "labs" && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <button onClick={() => setActiveSection("overview")} style={{ fontSize: 13, color: "#2563eb", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
              ← {t("nav.dashboard")}
            </button>
          </div>
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
        </div>
      )}

      {/* TELECONSULTATION */}
      {activeSection === "teleconsult" && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <button onClick={() => setActiveSection("overview")} style={{ fontSize: 13, color: "#2563eb", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
              ← {t("nav.dashboard")}
            </button>
          </div>
          <PatientTeleconsultation permissions={permissions} />
        </div>
      )}

      {/* HEALTH ASSISTANT */}
      {activeSection === "chat" && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <button onClick={() => setActiveSection("overview")} style={{ fontSize: 13, color: "#2563eb", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
              ← {t("nav.dashboard")}
            </button>
          </div>
          <AiHealthChat />
        </div>
      )}

      {activeSection !== "emergency" && activeSection !== "health_profile" && activeSection !== "appointments" && activeSection !== "my_team" && activeSection !== "teleconsult" && activeSection !== "chat" && activeSection !== "labs" && activeSection !== "report" && <>
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


      {/* ── NEXT APPOINTMENT WIDGET ── */}
      {nextAppt && (
        <div style={{ background: "linear-gradient(135deg,#eff6ff,#e0f2fe)", border: "1.5px solid #93c5fd", borderRadius: 16, padding: "16px 20px", marginBottom: 20, display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: "linear-gradient(135deg,#2563eb,#06b6d4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <CalendarDays size={24} style={{ color: "#fff" }} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: "#2563eb", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 4px" }}>{t("dashboard.next_appointment_label")}</p>
            <p style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", margin: "0 0 2px" }}>Dr. {nextAppt.doctorName}</p>
            <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>{nextAppt.date} · {nextAppt.time ?? ""} {nextAppt.reason ? `· ${nextAppt.reason}` : ""}</p>
          </div>
          <div style={{ textAlign: "center", flexShrink: 0 }}>
            <div style={{ fontSize: 32, fontWeight: 900, color: "#2563eb", lineHeight: 1 }}>{daysUntilAppt === 0 ? t("dashboard.today_label") : daysUntilAppt}</div>
            {daysUntilAppt !== 0 && <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>{t("dashboard.days_label")}</div>}
          </div>
        </div>
      )}

      {/* ── 3-COLUMN WIDGETS ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>

        {/* Health Summary */}
        <div style={{ background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 16, padding: "18px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg,#dc2626,#ea580c)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Heart size={15} style={{ color: "#fff" }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>{t("dashboard.health_summary_title")}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 10px", background: "#fef2f2", borderRadius: 9 }}>
              <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>{t("dashboard.blood_type_label")}</span>
              <span style={{ fontSize: 15, fontWeight: 900, color: "#dc2626" }}>{profileData.bloodType ?? "—"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 10px", background: "#fef9c3", borderRadius: 9 }}>
              <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>{t("dashboard.allergies_label")}</span>
              <span style={{ fontSize: 15, fontWeight: 900, color: "#d97706" }}>{allergiesCount}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 10px", background: "#ede9fe", borderRadius: 9 }}>
              <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>{t("dashboard.chronic_count_label")}</span>
              <span style={{ fontSize: 15, fontWeight: 900, color: "#7c3aed" }}>{chronicList.length}</span>
            </div>
            {chronicList.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 2 }}>
                {chronicList.slice(0, 3).map(c => (
                  <span key={c} style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#f3f4f6", color: "#374151" }}>
                    {CHRONIC_LABELS[c] ?? c}
                  </span>
                ))}
                {chronicList.length > 3 && <span style={{ fontSize: 10, color: "#94a3b8", padding: "2px 4px" }}>+{chronicList.length - 3}</span>}
              </div>
            )}
          </div>
          <button onClick={() => { setActiveSection("overview"); setActiveTab("health_profile"); }} style={{ marginTop: 12, width: "100%", padding: "7px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 9, fontSize: 12, fontWeight: 700, color: "#2563eb", cursor: "pointer" }}>
            {t("dashboard.view_full_profile")}
          </button>
        </div>

        {/* Daily Medications */}
        <div style={{ background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 16, padding: "18px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg,#7c3aed,#2563eb)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <PillIcon size={15} style={{ color: "#fff" }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>{t("dashboard.daily_meds_title")}</span>
            {medications.length > 0 && (
              <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: "#16a34a", background: "#dcfce7", padding: "2px 8px", borderRadius: 20 }}>
                {takenMeds.size}/{medications.length}
              </span>
            )}
          </div>
          {medications.length === 0 ? (
            <p style={{ fontSize: 13, color: "#94a3b8", textAlign: "center", padding: "16px 0" }}>{t("dashboard.no_meds_recorded")}</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 180, overflowY: "auto" }}>
              {medications.map((m, i) => {
                const taken = takenMeds.has(m.name);
                return (
                  <div key={i} onClick={() => toggleMedTaken(m.name)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 9, cursor: "pointer", background: taken ? "#f0fdf4" : "#f8fafc", border: `1px solid ${taken ? "#bbf7d0" : "#e2e8f0"}`, transition: "all 0.15s" }}>
                    <div style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${taken ? "#16a34a" : "#d1d5db"}`, background: taken ? "#16a34a" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}>
                      {taken && <CheckCircle size={12} style={{ color: "#fff" }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: taken ? "#16a34a" : "#0f172a", margin: 0, textDecoration: taken ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</p>
                      {m.dosage && <p style={{ fontSize: 11, color: "#94a3b8", margin: 0 }}>{m.dosage} · {m.frequency}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {takenMeds.size > 0 && takenMeds.size === medications.length && (
            <div style={{ marginTop: 10, padding: "7px 10px", background: "#dcfce7", borderRadius: 9, textAlign: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#16a34a" }}>{t("dashboard.all_meds_taken")}</span>
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div style={{ background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 16, padding: "18px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg,#0d9488,#16a34a)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Clock size={15} style={{ color: "#fff" }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>{t("dashboard.recent_activity_title")}</span>
          </div>
          {recentActivity.length === 0 ? (
            <p style={{ fontSize: 13, color: "#94a3b8", textAlign: "center", padding: "16px 0" }}>{t("dashboard.no_activity_yet")}</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {recentActivity.map((item, i) => {
                const colors = { record: { bg: "#ede9fe", c: "#7c3aed", icon: FileText }, lab: { bg: "#ecfeff", c: "#0891b2", icon: FlaskConical }, appt: { bg: "#dcfce7", c: "#16a34a", icon: CalendarDays } };
                const { bg, c, icon: Icon } = colors[item.type];
                return (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 0", borderBottom: i < recentActivity.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                      <Icon size={13} style={{ color: c }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</p>
                      <p style={{ fontSize: 11, color: "#94a3b8", margin: "1px 0 0" }}>{item.sub} · {item.date}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── DAILY HEALTH TIP ── */}
      <div style={{ background: "linear-gradient(135deg,#f0fdf4,#ecfeff)", border: "1.5px solid #a7f3d0", borderRadius: 14, padding: "12px 18px", marginBottom: 24, display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 20, flexShrink: 0 }}>💡</span>
        <div>
          <p style={{ fontSize: 11, fontWeight: 800, color: "#0d9488", margin: "0 0 2px", letterSpacing: "0.08em" }}>{t("dashboard.daily_tip_label")}</p>
          <p style={{ fontSize: 13, color: "#065f46", margin: 0, lineHeight: 1.5, direction: "rtl" }}>{dailyTip}</p>
        </div>
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
                {/* Google Wallet quick-add banner */}
                <div style={{ marginBottom: 16, padding: "16px 18px", background: "linear-gradient(135deg, #fef2f2, #fff5f5)", border: "1.5px solid #fca5a5", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#dc2626", margin: "0 0 3px" }}>🚨 Emergency Medical Card</p>
                    <p style={{ fontSize: 12, color: "#7f1d1d", margin: 0 }}>
                      Your card is accessible to first responders — no login required.
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      const u = user as any;
                      try {
                        const conditionColors: Record<string, string> = {
                          cancer: "#dc2626", hiv: "#ec4899", tuberculosis: "#d97706",
                          pregnancy: "#7c3aed", heart_disease: "#be185d", kidney_disease: "#0ea5e9",
                          liver_disease: "#a16207", epilepsy: "#6d28d9", diabetes: "#ea580c",
                          hypertension: "#1d4ed8", asthma: "#16a34a", thyroid: "#0891b2",
                          mental_health: "#6b7280",
                        };
                        const conditionPriority = ["cancer","hiv","heart_disease","epilepsy","tuberculosis","pregnancy","kidney_disease","liver_disease","diabetes","hypertension","asthma","thyroid","mental_health"];
                        const conditions: string[] = u.chronicConditions || [];
                        const topCondition = conditionPriority.find(c => conditions.includes(c));
                        const hexBackgroundColor = topCondition ? (conditionColors[topCondition] ?? "#dc2626") : "#dc2626";
                        const res = await fetch("/api/google-wallet", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            name: `${u.firstName} ${u.lastName}`,
                            spitarId: u.spitarId,
                            bloodType: u.bloodType,
                            dateOfBirth: u.dateOfBirth,
                            hexBackgroundColor,
                          }),
                        });
                        const data = await res.json();
                        if (data.saveUrl) window.open(data.saveUrl, "_blank");
                      } catch { /* silent */ }
                    }}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "10px 18px", borderRadius: 10,
                      background: "#fff", color: "#1a73e8",
                      border: "1.5px solid #1a73e8",
                      fontSize: 13, fontWeight: 700, cursor: "pointer",
                      flexShrink: 0, boxShadow: "0 1px 4px rgba(26,115,232,0.15)",
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 48 48">
                      <path fill="#4285F4" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.2l6.8-6.8C35.8 2.3 30.2 0 24 0 14.6 0 6.6 5.4 2.6 13.3l7.9 6.1C12.3 13.1 17.7 9.5 24 9.5z"/>
                      <path fill="#34A853" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4 7.1-10 7.1-17z"/>
                      <path fill="#FBBC05" d="M10.5 28.6A14.6 14.6 0 0 1 9.5 24c0-1.6.3-3.2.7-4.6l-7.9-6.1A23.8 23.8 0 0 0 0 24c0 3.9.9 7.5 2.6 10.7l7.9-6.1z"/>
                      <path fill="#EA4335" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7.5-5.8c-2 1.4-4.6 2.2-7.7 2.2-6.3 0-11.7-3.6-13.5-9.3l-7.9 6.1C6.6 42.6 14.6 48 24 48z"/>
                    </svg>
                    Add to Google Wallet
                  </button>
                </div>
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
      </>}
    </DashboardLayout>
  );
}
