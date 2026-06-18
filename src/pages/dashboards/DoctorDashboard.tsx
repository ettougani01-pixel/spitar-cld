import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  collection, query, where, getDocs, getDoc, doc, addDoc,
  updateDoc, deleteDoc, orderBy, limit, setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { sendNotification } from "@/lib/notifications";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FileText, FlaskConical, Users, CalendarDays, Activity, Search, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { HealthProfileContent } from "@/components/HealthProfileContent";
import type { MedicalRecord, LabResult, Appointment, PatientProfile } from "@/lib/types";

type RecordType = "consultation" | "prescription" | "surgery" | "diagnosis" | "imaging" | "other";

const COMMON_MEDICATIONS = [
  "Amoxicillin", "Augmentin", "Azithromycin", "Ciprofloxacin", "Doxycycline",
  "Metronidazole", "Ceftriaxone", "Trimethoprim", "Clarithromycin", "Erythromycin",
  "Ibuprofen", "Paracetamol", "Aspirin", "Naproxen", "Diclofenac", "Ketoprofen",
  "Tramadol", "Codeine", "Morphine", "Celecoxib",
  "Omeprazole", "Pantoprazole", "Ranitidine", "Metoclopramide", "Domperidone",
  "Loperamide", "Bisacodyl", "Lactulose",
  "Metformin", "Glibenclamide", "Insulin", "Sitagliptin", "Empagliflozin",
  "Atorvastatin", "Simvastatin", "Rosuvastatin",
  "Amlodipine", "Ramipril", "Lisinopril", "Losartan", "Bisoprolol",
  "Atenolol", "Furosemide", "Hydrochlorothiazide", "Spironolactone", "Carvedilol",
  "Salbutamol", "Budesonide", "Montelukast", "Theophylline", "Ipratropium",
  "Cetirizine", "Loratadine", "Fexofenadine", "Chlorphenamine",
  "Levothyroxine", "Prednisolone", "Dexamethasone", "Hydrocortisone",
  "Sertraline", "Fluoxetine", "Amitriptyline", "Diazepam", "Alprazolam",
  "Haloperidol", "Risperidone", "Quetiapine",
  "Methotrexate", "Hydroxychloroquine", "Colchicine", "Allopurinol",
  "Calcium + Vitamin D", "Vitamin B12", "Ferrous sulfate", "Folic acid",
  "Zinc", "Magnesium", "Multivitamins",
  "Heparin", "Warfarin", "Rivaroxaban", "Clopidogrel",
  "Ondansetron", "Acyclovir", "Fluconazole", "Nystatin",
];
type Tab = "overview" | "patients" | "records" | "appointments";

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  normal:    { bg: "#dcfce7", text: "#16a34a" },
  critical:  { bg: "#fee2e2", text: "#dc2626" },
  abnormal:  { bg: "#fef3c7", text: "#d97706" },
  pending:   { bg: "#f1f5f9", text: "#64748b" },
  confirmed: { bg: "#dcfce7", text: "#16a34a" },
  cancelled: { bg: "#fee2e2", text: "#dc2626" },
  completed: { bg: "#eff6ff", text: "#2563eb" },
};

function StatusBadge({ status, label }: { status: string; label: string }) {
  const c = STATUS_COLORS[status] ?? { bg: "#f1f5f9", text: "#64748b" };
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20, background: c.bg, color: c.text, textTransform: "capitalize" }}>
      {label}
    </span>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", overflow: "hidden", ...style }}>
      {children}
    </div>
  );
}

function CardHead({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{title}</span>
      {action}
    </div>
  );
}

export default function DoctorDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [myRecords, setMyRecords] = useState<MedicalRecord[]>([]);
  const [authorizedPatientsCount, setAuthorizedPatientsCount] = useState(0);
  const [authorizedPatients, setAuthorizedPatients] = useState<PatientProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [foundPatient, setFoundPatient] = useState<PatientProfile | null>(null);
  const [searchResults, setSearchResults] = useState<PatientProfile[]>([]);
  const [patientRecords, setPatientRecords] = useState<MedicalRecord[]>([]);
  const [patientLabs, setPatientLabs] = useState<LabResult[]>([]);
  const [patientExpanded, setPatientExpanded] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [noPermPatients, setNoPermPatients] = useState<PatientProfile[]>([]);
  const [requestingSent, setRequestingSent] = useState<Record<string, boolean>>({});

  const [showAddRecord, setShowAddRecord] = useState(false);
  const [recordForm, setRecordForm] = useState({
    type: "consultation" as RecordType,
    title: "",
    description: "",
    date: new Date().toISOString().split("T")[0],
  });
  const [prescriptionMeds, setPrescriptionMeds] = useState<{ value: string; custom: string; duration: string; frequency: string; timing: string }[]>([{ value: "", custom: "", duration: "", frequency: "", timing: "" }]);
  const [savingRecord, setSavingRecord] = useState(false);

  // Doctor's custom medication list
  const [customMedList, setCustomMedList] = useState<string[]>([]);
  const [newMedInput, setNewMedInput] = useState("");
  const [savingMedList, setSavingMedList] = useState(false);

  useEffect(() => {
    if (!user) return;
    async function load() {
      setLoading(true);
      const [apptSnap, recSnap, permSnap] = await Promise.allSettled([
        getDocs(query(collection(db, "appointments"), where("doctorId", "==", user!.uid), orderBy("date", "desc"), limit(30))),
        getDocs(query(collection(db, "medical_records"), where("doctorId", "==", user!.uid), orderBy("createdAt", "desc"), limit(30))),
        getDocs(query(collection(db, "access_permissions"), where("granteeId", "==", user!.uid), where("isActive", "==", true))),
      ]);
      if (apptSnap.status === "fulfilled") setAppointments(apptSnap.value.docs.map(d => ({ id: d.id, ...d.data() } as Appointment)));
      if (recSnap.status === "fulfilled") setMyRecords(recSnap.value.docs.map(d => ({ id: d.id, ...d.data() } as MedicalRecord)));
      if (permSnap.status === "fulfilled") {
        setAuthorizedPatientsCount(permSnap.value.size);
        // Load patient profiles for authorized patients
        const patientProfiles = await Promise.allSettled(
          permSnap.value.docs.map(d => getDoc(doc(db, "users", d.data().patientId)))
        );
        const profiles: PatientProfile[] = [];
        patientProfiles.forEach(r => {
          if (r.status === "fulfilled" && r.value.exists()) {
            profiles.push({ uid: r.value.id, ...r.value.data() } as PatientProfile);
          }
        });
        setAuthorizedPatients(profiles);
      }
      setLoading(false);
      // Load custom medication list
      const medDoc = await getDoc(doc(db, "doctor_med_lists", user!.uid));
      if (medDoc.exists()) setCustomMedList(medDoc.data().medications ?? []);
    }
    load();
  }, [user]);

  const checkPermission = async (patientId: string, universalDoctorAccess: boolean) => {
    if (universalDoctorAccess) return true;
    const permSnap = await getDocs(query(
      collection(db, "access_permissions"),
      where("patientId", "==", patientId),
      where("granteeId", "==", user!.uid),
      where("isActive", "==", true),
    ));
    return !permSnap.empty;
  };

  const loadPatientData = async (patient: PatientProfile) => {
    setFoundPatient(patient);
    setSearchResults([]);
    setPatientExpanded(true);
    setPatientRecords([]);
    setPatientLabs([]);
    const [recSnap, labSnap] = await Promise.allSettled([
      getDocs(query(collection(db, "medical_records"), where("patientId", "==", patient.uid), orderBy("createdAt", "desc"), limit(20))),
      getDocs(query(collection(db, "lab_results"), where("patientId", "==", patient.uid), orderBy("createdAt", "desc"), limit(20))),
    ]);
    if (recSnap.status === "fulfilled") setPatientRecords(recSnap.value.docs.map(d => ({ id: d.id, ...d.data() } as MedicalRecord)));
    if (labSnap.status === "fulfilled") setPatientLabs(labSnap.value.docs.map(d => ({ id: d.id, ...d.data() } as LabResult)));
  };

  const searchPatient = async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setSearchLoading(true);
    setSearchError("");
    setFoundPatient(null);
    setSearchResults([]);
    setPatientRecords([]);
    setPatientLabs([]);
    setNoPermPatients([]);
    try {
      const isSpitarId = /^SP-/i.test(q);
      const usersRef = collection(db, "users");

      let snaps;
      if (isSpitarId) {
        const snap = await getDocs(query(usersRef, where("spitarId", "==", q.toUpperCase()), where("role", "==", "patient")));
        snaps = snap.docs;
      } else {
        // Search with multiple casings to handle stored data regardless of case
        const variants = Array.from(new Set([q, q.toUpperCase(), q.toLowerCase(), q.charAt(0).toUpperCase() + q.slice(1).toLowerCase()]));
        const searchSnaps = await Promise.all(variants.flatMap(v => [
          getDocs(query(usersRef, where("firstName", ">=", v), where("firstName", "<=", v + ""), limit(10))),
          getDocs(query(usersRef, where("lastName", ">=", v), where("lastName", "<=", v + ""), limit(10))),
        ]));
        const seen = new Set<string>();
        snaps = searchSnaps.flatMap(s => s.docs).filter(d => { if (seen.has(d.id)) return false; seen.add(d.id); return d.data().role === "patient"; });
      }

      if (snaps.length === 0) { setSearchError(t("dashboard.patient_not_found")); return; }

      // Check permissions for each result
      const withPerm: PatientProfile[] = [];
      for (const d of snaps) {
        const data = { uid: d.id, ...d.data() } as PatientProfile;
        const allowed = await checkPermission(d.id, !!data.universalDoctorAccess);
        if (allowed) withPerm.push(data);
      }

      if (withPerm.length === 0) {
        // Show patients without permission so doctor can request access
        const noPerm = snaps.map(d => ({ uid: d.id, ...d.data() } as PatientProfile));
        setNoPermPatients(noPerm);
        return;
      }
      if (withPerm.length === 1) {
        await loadPatientData(withPerm[0]);
      } else {
        setSearchResults(withPerm);
      }
    } catch {
      setSearchError(t("common.error"));
    } finally {
      setSearchLoading(false);
    }
  };

  const requestAccess = async (patient: PatientProfile) => {
    if (!user) return;
    const docId = `${patient.uid}_${user.uid}_req`;
    await setDoc(doc(db, "access_requests", docId), {
      patientId: patient.uid,
      doctorId: user.uid,
      doctorName: `${user.firstName} ${user.lastName}`,
      status: "pending",
      createdAt: new Date().toISOString(),
    });
    setRequestingSent(prev => ({ ...prev, [patient.uid]: true }));
    await sendNotification(
      patient.uid,
      "access_request",
      `Dr. ${user.firstName} ${user.lastName}`,
      "is requesting access to your medical file",
    );
  };

  const saveRecord = async () => {
    if (!user || !foundPatient) return;
    let title = recordForm.title;
    if (recordForm.type === "prescription") {
      const parts = prescriptionMeds
        .map(m => {
          const name = m.value === "__other__" ? m.custom.trim() : m.value;
          if (!name) return null;
          const extras = [m.duration, m.frequency, m.timing].filter(Boolean).join(" - ");
          return extras ? `${name} (${extras})` : name;
        })
        .filter(Boolean);
      if (parts.length === 0) return;
      title = parts.join(" | ");
    }
    if (!title) return;
    if (recordForm.type !== "prescription" && !recordForm.description) return;
    setSavingRecord(true);
    try {
      const record: Omit<MedicalRecord, "id"> = {
        patientId: foundPatient.uid,
        doctorId: user.uid,
        doctorName: `${user.firstName} ${user.lastName}`,
        type: recordForm.type,
        title,
        description: recordForm.description,
        date: recordForm.date,
        createdAt: new Date().toISOString(),
      };
      const ref = await addDoc(collection(db, "medical_records"), record);
      setPatientRecords(prev => [{ id: ref.id, ...record }, ...prev]);
      setMyRecords(prev => [{ id: ref.id, ...record }, ...prev]);
      setShowAddRecord(false);
      setRecordForm({ type: "consultation", title: "", description: "", date: new Date().toISOString().split("T")[0] });
      setPrescriptionMeds([{ value: "", custom: "", duration: "", frequency: "", timing: "" }]);
    } finally {
      setSavingRecord(false);
    }
  };

  const deleteRecord = async (recordId: string) => {
    await deleteDoc(doc(db, "medical_records", recordId));
    setPatientRecords(prev => prev.filter(r => r.id !== recordId));
    setMyRecords(prev => prev.filter(r => r.id !== recordId));
  };

  const addCustomMed = async () => {
    const name = newMedInput.trim();
    if (!name || customMedList.includes(name)) return;
    setSavingMedList(true);
    const updated = [...customMedList, name];
    await setDoc(doc(db, "doctor_med_lists", user!.uid), { medications: updated });
    setCustomMedList(updated);
    setNewMedInput("");
    setSavingMedList(false);
  };

  const removeCustomMed = async (name: string) => {
    const updated = customMedList.filter(m => m !== name);
    await setDoc(doc(db, "doctor_med_lists", user!.uid), { medications: updated });
    setCustomMedList(updated);
  };

  const updateAppointmentStatus = async (apptId: string, status: string) => {
    await updateDoc(doc(db, "appointments", apptId), { status });
    setAppointments(prev => prev.map(a => a.id === apptId ? { ...a, status: status as Appointment["status"] } : a));
  };

  const pendingAppts = appointments.filter(a => a.status === "pending");
  const confirmedAppts = appointments.filter(a => a.status === "confirmed");

  const navItems = [
    { label: t("nav.dashboard"), href: "/dashboard", icon: Activity, onClick: () => setActiveTab("overview"), active: activeTab === "overview" },
    { label: t("dashboard.search_patient"), href: "/dashboard", icon: Search, onClick: () => setActiveTab("patients"), active: activeTab === "patients" },
    { label: t("records.prescriptions"), href: "/dashboard", icon: FileText, onClick: () => setActiveTab("records"), active: activeTab === "records" },
    { label: t("appointments.title"), href: "/dashboard", icon: CalendarDays, onClick: () => setActiveTab("appointments"), active: activeTab === "appointments" },
  ];

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: t("nav.dashboard") },
    { key: "patients", label: t("dashboard.search_patient") },
    { key: "records", label: t("records.prescriptions") },
    { key: "appointments", label: t("appointments.title") },
  ];

  const inp: React.CSSProperties = {
    height: 44, padding: "0 14px", border: "1.5px solid #e2e8f0", borderRadius: 12,
    fontSize: 14, outline: "none", background: "#f8fafc", color: "#0f172a",
    width: "100%", boxSizing: "border-box", transition: "border-color 0.15s",
  };

  return (
    <DashboardLayout navItems={navItems} title={`Dr. ${user?.firstName} ${user?.lastName}`}>

      {/* Tab bar */}
      <div style={{ display: "flex", borderBottom: "2px solid #e5e7eb", marginBottom: 24, gap: 0, overflowX: "auto" }}>
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
            padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer",
            border: "none", background: "none", whiteSpace: "nowrap",
            borderBottom: activeTab === tab.key ? "2px solid #7c3aed" : "2px solid transparent",
            marginBottom: -2, color: activeTab === tab.key ? "#7c3aed" : "#6b7280",
            transition: "all 0.15s",
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Stat cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14 }}>
            {[
              { label: t("dashboard.records_created"), value: myRecords.length, icon: FileText, grad: "linear-gradient(135deg, #7c3aed, #2563eb)" },
              { label: t("appointments.title"), value: appointments.length, icon: CalendarDays, grad: "linear-gradient(135deg, #0891b2, #06b6d4)" },
              { label: t("dashboard.pending"), value: pendingAppts.length, icon: Activity, grad: "linear-gradient(135deg, #d97706, #f59e0b)" },
              { label: t("dashboard.authorized_patients"), value: authorizedPatientsCount, icon: Users, grad: "linear-gradient(135deg, #16a34a, #15803d)", onClick: () => setActiveTab("patients") },
            ].map(({ label, value, icon: Icon, grad, onClick }) => (
              <div key={label} onClick={onClick} style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: "18px 20px", display: "flex", alignItems: "center", gap: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.04)", cursor: onClick ? "pointer" : "default" }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: grad, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon size={20} style={{ color: "#fff" }} />
                </div>
                <div>
                  <p style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", lineHeight: 1 }}>{value}</p>
                  <p style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{label}</p>
                </div>
              </div>
            ))}
          </div>

          {pendingAppts.length > 0 && (
            <Card>
              <CardHead title={t("dashboard.pending_appointments")} />
              <div style={{ padding: "0 20px" }}>
                {pendingAppts.slice(0, 5).map(a => (
                  <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 0", borderBottom: "1px solid #f1f5f9" }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{a.patientName}</p>
                      <p style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{a.date} · {a.time}</p>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => updateAppointmentStatus(a.id, "confirmed")} style={{ padding: "6px 14px", borderRadius: 10, background: "linear-gradient(135deg, #16a34a, #15803d)", color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                        {t("appointments.confirm_appt")}
                      </button>
                      <button onClick={() => updateAppointmentStatus(a.id, "cancelled")} style={{ padding: "6px 14px", borderRadius: 10, background: "#fee2e2", color: "#dc2626", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                        {t("appointments.cancel_appt")}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Patient search */}
      {activeTab === "patients" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Authorized patients list */}
          {authorizedPatients.length > 0 && !foundPatient && (
            <Card>
              <CardHead title={t("dashboard.authorized_patients")} />
              <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                {authorizedPatients.map(p => (
                  <button key={p.uid} onClick={() => loadPatientData(p)}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, border: "1.5px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", textAlign: "left", width: "100%" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #16a34a22, #15803d22)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, color: "#16a34a" }}>
                      {p.firstName?.[0]?.toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", margin: 0 }}>{p.firstName} {p.lastName}</p>
                      <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>{p.spitarId} · {p.city}</p>
                    </div>
                    <ChevronDown size={16} style={{ color: "#94a3b8", transform: "rotate(-90deg)" }} />
                  </button>
                ))}
              </div>
            </Card>
          )}

          <Card>
            <CardHead title={t("dashboard.search_patient")} />
            <div style={{ padding: 20 }}>
              <div style={{ display: "flex", gap: 10 }}>
                <input style={inp} placeholder={t("dashboard.patient_search_placeholder")} value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && searchPatient()}
                  onFocus={e => (e.target.style.borderColor = "#7c3aed")} onBlur={e => (e.target.style.borderColor = "#e2e8f0")} />
                <button onClick={searchPatient} disabled={searchLoading} style={{ padding: "0 20px", height: 44, borderRadius: 12, background: "linear-gradient(135deg, #7c3aed, #2563eb)", color: "#fff", border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}>
                  <Search size={15} /> {t("common.search")}
                </button>
              </div>
              {searchError && <p style={{ fontSize: 13, color: "#dc2626", marginTop: 10 }}>{searchError}</p>}
              {noPermPatients.length > 0 && (
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                  {noPermPatients.map(p => (
                    <div key={p.uid} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: 12, border: "1.5px solid #ede9fe", background: "#faf9ff" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg, #7c3aed22, #2563eb22)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: "#7c3aed" }}>
                          {p.firstName?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", margin: 0 }}>{p.firstName} {p.lastName}</p>
                          <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>{p.spitarId}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => requestAccess(p)}
                        disabled={!!requestingSent[p.uid]}
                        style={{ padding: "8px 16px", borderRadius: 10, background: requestingSent[p.uid] ? "#e2e8f0" : "linear-gradient(135deg, #7c3aed, #2563eb)", color: requestingSent[p.uid] ? "#64748b" : "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: requestingSent[p.uid] ? "default" : "pointer" }}>
                        {requestingSent[p.uid] ? t("dashboard.request_sent") : t("dashboard.request_access")}
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {searchResults.length > 1 && (
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  {searchResults.map(p => (
                    <button key={p.uid} onClick={() => loadPatientData(p)}
                      style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, border: "1.5px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", textAlign: "left", width: "100%" }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #7c3aed22, #2563eb22)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, color: "#7c3aed" }}>
                        {p.firstName?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", margin: 0 }}>{p.firstName} {p.lastName}</p>
                        <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>{p.spitarId} · {p.city}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {foundPatient && (
            <Card>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <p style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>{foundPatient.firstName} {foundPatient.lastName}</p>
                  <p style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{foundPatient.spitarId} · {foundPatient.city}</p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setShowAddRecord(true)} style={{ padding: "8px 16px", borderRadius: 12, background: "linear-gradient(135deg, #7c3aed, #2563eb)", color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                    <Plus size={14} /> {t("records.add_record_btn")}
                  </button>
                  <button onClick={() => setPatientExpanded(v => !v)} style={{ padding: "8px 12px", borderRadius: 12, background: "#f8fafc", border: "1.5px solid #e2e8f0", cursor: "pointer", color: "#64748b" }}>
                    {patientExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>
              </div>

              {patientExpanded && (
                <div style={{ padding: 20 }}>
                  {/* Medical Records */}
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>{t("records.medical_records")}</p>
                  {patientRecords.length === 0 ? (
                    <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 20 }}>{t("common.no_data")}</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                      {patientRecords.map(r => (
                        <div key={r.id} style={{ padding: 12, borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#ede9fe", color: "#7c3aed" }}>{t(`records.type_${r.type}`)}</span>
                                <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{r.title}</span>
                              </div>
                              <p style={{ fontSize: 11, color: "#94a3b8" }}>{r.date}</p>
                              <p style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{r.description}</p>
                            </div>
                            {r.doctorId === user?.uid && (
                              <button onClick={() => deleteRecord(r.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", padding: 4 }}>
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Full Health Profile (read-only) */}
                  <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 16, marginTop: 4 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>{t("hp.health_profile")}</p>
                    <HealthProfileContent patientId={foundPatient.uid} readOnly />
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>
      )}

      {/* Prescriptions tab */}
      {activeTab === "records" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Custom medication list manager */}
          <Card>
            <CardHead title={t("records.my_med_list")} />
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Add new medication */}
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={newMedInput}
                  onChange={e => setNewMedInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addCustomMed()}
                  placeholder={t("records.new_med_placeholder")}
                  style={{ flex: 1, height: 40, padding: "0 14px", border: "1.5px solid #e2e8f0", borderRadius: 10, fontSize: 14, outline: "none", background: "#f8fafc" }}
                />
                <button
                  onClick={addCustomMed}
                  disabled={savingMedList || !newMedInput.trim()}
                  style={{ padding: "0 18px", height: 40, borderRadius: 10, background: "linear-gradient(135deg, #7c3aed, #2563eb)", color: "#fff", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, opacity: (!newMedInput.trim() || savingMedList) ? 0.5 : 1 }}
                >
                  <Plus size={15} /> {t("common.submit")}
                </button>
              </div>
              {/* List */}
              {customMedList.length === 0 ? (
                <p style={{ fontSize: 13, color: "#94a3b8", textAlign: "center", padding: "16px 0" }}>{t("records.no_custom_meds")}</p>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {customMedList.map(name => (
                    <div key={name} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 20, background: "#ede9fe", border: "1px solid #c4b5fd" }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#5b21b6" }}>{name}</span>
                      <button onClick={() => removeCustomMed(name)} style={{ background: "none", border: "none", cursor: "pointer", color: "#7c3aed", padding: 0, display: "flex", alignItems: "center", lineHeight: 1 }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* Prescription records */}
          <Card>
            <CardHead title={t("records.prescriptions")} />
            <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
              {myRecords.filter(r => r.type === "prescription").length === 0 ? (
                <div style={{ padding: "32px 24px", textAlign: "center", color: "#94a3b8", fontSize: 14 }}>{t("common.no_data")}</div>
              ) : (
                myRecords.filter(r => r.type === "prescription").map(r => (
                  <div key={r.id} style={{ background: "#f8fafc", borderRadius: 12, border: "1px solid #e2e8f0", padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20, background: "#ede9fe", color: "#7c3aed" }}>{t("records.type_prescription")}</span>
                          <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{r.title}</span>
                        </div>
                        <p style={{ fontSize: 12, color: "#94a3b8", margin: "2px 0 4px" }}>{r.date}</p>
                        <p style={{ fontSize: 13, color: "#64748b" }}>{r.description}</p>
                      </div>
                      <button onClick={() => deleteRecord(r.id)} style={{ background: "#fee2e2", border: "none", borderRadius: 10, cursor: "pointer", color: "#dc2626", padding: "6px 8px", marginLeft: 12 }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

        </div>
      )}

      {/* Appointments */}
      {activeTab === "appointments" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {appointments.length === 0 ? (
            <div style={{ padding: "48px 24px", textAlign: "center", color: "#94a3b8", fontSize: 14, background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0" }}>{t("appointments.no_appointments")}</div>
          ) : (
            appointments.map(a => (
              <div key={a.id} style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: "16px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <StatusBadge status={a.status} label={t(`appointments.status_${a.status}`)} />
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{a.patientName}</span>
                    </div>
                    <p style={{ fontSize: 12, color: "#94a3b8" }}>{a.date} · {a.time}</p>
                    {a.reason && <p style={{ fontSize: 13, color: "#64748b", marginTop: 6 }}>{a.reason}</p>}
                  </div>
                  {a.status === "pending" && (
                    <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                      <button onClick={() => updateAppointmentStatus(a.id, "confirmed")} style={{ padding: "6px 14px", borderRadius: 10, background: "linear-gradient(135deg, #16a34a, #15803d)", color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                        {t("appointments.confirm_appt")}
                      </button>
                      <button onClick={() => updateAppointmentStatus(a.id, "cancelled")} style={{ padding: "6px 14px", borderRadius: 10, background: "#fee2e2", color: "#dc2626", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                        {t("appointments.cancel_appt")}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Add Record Dialog */}
      <Dialog open={showAddRecord} onOpenChange={setShowAddRecord}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("dashboard.add_record_title")} — {foundPatient?.firstName} {foundPatient?.lastName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t("records.record_type")}</Label>
              <Select value={recordForm.type} onValueChange={v => {
                setRecordForm(f => ({ ...f, type: v as RecordType, title: "" }));
                setPrescriptionMeds([{ value: "", custom: "", duration: "", frequency: "", timing: "" }]);
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["consultation", "prescription", "surgery", "diagnosis", "imaging", "other"] as RecordType[]).map(rt => (
                    <SelectItem key={rt} value={rt}>{t(`records.type_${rt}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {recordForm.type === "prescription" ? (
              <div className="space-y-2">
                <Label>{t("records.med_name_label")}</Label>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {prescriptionMeds.map((med, idx) => (
                    <div key={idx} style={{ background: "#f8f7ff", border: "1px solid #ede9fe", borderRadius: 12, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
                      {/* Row 1: medication name + delete */}
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <div style={{ flex: 1 }}>
                          <Select value={med.value} onValueChange={v => setPrescriptionMeds(prev => prev.map((m, i) => i === idx ? { ...m, value: v, custom: "" } : m))}>
                            <SelectTrigger style={{ height: 38, background: "#fff" }}>
                              <SelectValue placeholder={t("records.select_med_placeholder")} />
                            </SelectTrigger>
                            <SelectContent style={{ maxHeight: 240, overflowY: "auto" }}>
                              {customMedList.length === 0 && (
                                <div style={{ padding: "8px 12px", fontSize: 13, color: "#94a3b8" }}>{t("records.no_custom_meds")}</div>
                              )}
                              {customMedList.map(name => (
                                <SelectItem key={`custom-${name}`} value={name}>{name}</SelectItem>
                              ))}
                              <SelectItem value="__other__">{t("common.other")}</SelectItem>
                            </SelectContent>
                          </Select>
                          {med.value === "__other__" && (
                            <input
                              style={{ marginTop: 6, height: 36, padding: "0 12px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 14, width: "100%", boxSizing: "border-box", outline: "none", background: "#fff" }}
                              placeholder={t("records.custom_med_placeholder")}
                              value={med.custom}
                              onChange={e => setPrescriptionMeds(prev => prev.map((m, i) => i === idx ? { ...m, custom: e.target.value } : m))}
                            />
                          )}
                        </div>
                        {prescriptionMeds.length > 1 && (
                          <button onClick={() => setPrescriptionMeds(prev => prev.filter((_, i) => i !== idx))} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", padding: 4, flexShrink: 0 }}>
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                      {/* Row 2: duration + frequency + timing */}
                      {med.value && (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                          {/* Duration */}
                          <Select value={med.duration} onValueChange={v => setPrescriptionMeds(prev => prev.map((m, i) => i === idx ? { ...m, duration: v } : m))}>
                            <SelectTrigger style={{ height: 34, fontSize: 12, background: "#fff" }}>
                              <SelectValue placeholder={t("records.duration_placeholder")} />
                            </SelectTrigger>
                            <SelectContent>
                              {[
                                { v: "1j", l: t("records.dur_1d") },
                                { v: "2j", l: t("records.dur_2d") },
                                { v: "3j", l: t("records.dur_3d") },
                                { v: "4j", l: t("records.dur_4d") },
                                { v: "5j", l: t("records.dur_5d") },
                                { v: "6j", l: t("records.dur_6d") },
                                { v: "1sem", l: t("records.dur_1w") },
                                { v: "2sem", l: t("records.dur_2w") },
                                { v: "1mois", l: t("records.dur_1m") },
                                { v: "2mois", l: t("records.dur_2m") },
                                { v: "toujours", l: t("records.dur_always") },
                              ].map(o => <SelectItem key={o.v} value={o.l}>{o.l}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          {/* Frequency */}
                          <Select value={med.frequency} onValueChange={v => setPrescriptionMeds(prev => prev.map((m, i) => i === idx ? { ...m, frequency: v } : m))}>
                            <SelectTrigger style={{ height: 34, fontSize: 12, background: "#fff" }}>
                              <SelectValue placeholder={t("records.frequency_placeholder")} />
                            </SelectTrigger>
                            <SelectContent>
                              {[
                                t("records.freq_1"),
                                t("records.freq_2"),
                                t("records.freq_3"),
                                t("records.freq_4"),
                              ].map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          {/* Timing */}
                          <Select value={med.timing} onValueChange={v => setPrescriptionMeds(prev => prev.map((m, i) => i === idx ? { ...m, timing: v } : m))}>
                            <SelectTrigger style={{ height: 34, fontSize: 12, background: "#fff" }}>
                              <SelectValue placeholder={t("records.timing_placeholder")} />
                            </SelectTrigger>
                            <SelectContent>
                              {[
                                t("records.timing_before"),
                                t("records.timing_during"),
                                t("records.timing_after"),
                              ].map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => setPrescriptionMeds(prev => [...prev, { value: "", custom: "", duration: "", frequency: "", timing: "" }])}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, border: "1.5px dashed #c4b5fd", background: "#f5f3ff", color: "#7c3aed", fontSize: 13, fontWeight: 600, cursor: "pointer", alignSelf: "flex-start" }}
                  >
                    <Plus size={14} /> {t("records.add_med_btn")}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>{t("records.record_title")}</Label>
                <Input value={recordForm.title} onChange={e => setRecordForm(f => ({ ...f, title: e.target.value }))} />
              </div>
            )}

            <div className="space-y-2">
              <Label>{t("records.record_description")}</Label>
              <Textarea value={recordForm.description} onChange={e => setRecordForm(f => ({ ...f, description: e.target.value }))} rows={4} />
            </div>
            <div className="space-y-2">
              <Label>{t("records.record_date")}</Label>
              <Input type="date" value={recordForm.date} onChange={e => setRecordForm(f => ({ ...f, date: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddRecord(false)}>{t("common.cancel")}</Button>
            <Button onClick={saveRecord} disabled={savingRecord}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
