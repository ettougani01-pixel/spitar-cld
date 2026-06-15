import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  collection, query, where, getDocs, doc, addDoc,
  updateDoc, deleteDoc, orderBy, limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FileText, FlaskConical, Users, CalendarDays, Activity, Search, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import type { MedicalRecord, LabResult, Appointment, PatientProfile } from "@/lib/types";

type RecordType = "consultation" | "prescription" | "surgery" | "diagnosis" | "imaging" | "other";
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
  const [loading, setLoading] = useState(true);

  const [patientSpitarId, setPatientSpitarId] = useState("");
  const [foundPatient, setFoundPatient] = useState<PatientProfile | null>(null);
  const [patientRecords, setPatientRecords] = useState<MedicalRecord[]>([]);
  const [patientLabs, setPatientLabs] = useState<LabResult[]>([]);
  const [patientExpanded, setPatientExpanded] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");

  const [showAddRecord, setShowAddRecord] = useState(false);
  const [recordForm, setRecordForm] = useState({
    type: "consultation" as RecordType,
    title: "",
    description: "",
    date: new Date().toISOString().split("T")[0],
  });
  const [savingRecord, setSavingRecord] = useState(false);

  useEffect(() => {
    if (!user) return;
    async function load() {
      setLoading(true);
      const [apptSnap, recSnap] = await Promise.all([
        getDocs(query(collection(db, "appointments"), where("doctorId", "==", user!.uid), orderBy("date", "desc"), limit(30))),
        getDocs(query(collection(db, "medical_records"), where("doctorId", "==", user!.uid), orderBy("createdAt", "desc"), limit(30))),
      ]);
      setAppointments(apptSnap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment)));
      setMyRecords(recSnap.docs.map(d => ({ id: d.id, ...d.data() } as MedicalRecord)));
      setLoading(false);
    }
    load();
  }, [user]);

  const searchPatient = async () => {
    if (!patientSpitarId.trim()) return;
    setSearchLoading(true);
    setSearchError("");
    setFoundPatient(null);
    setPatientRecords([]);
    setPatientLabs([]);
    try {
      const snap = await getDocs(query(
        collection(db, "users"),
        where("spitarId", "==", patientSpitarId.trim().toUpperCase()),
        where("role", "==", "patient"),
      ));
      if (snap.empty) { setSearchError(t("dashboard.patient_not_found")); return; }

      const patientData = snap.docs[0].data() as PatientProfile;
      const patientId = snap.docs[0].id;
      patientData.uid = patientId;

      const hasUniversal = patientData.universalDoctorAccess;
      if (!hasUniversal) {
        const permSnap = await getDocs(query(
          collection(db, "access_permissions"),
          where("patientId", "==", patientId),
          where("granteeId", "==", user!.uid),
          where("isActive", "==", true),
        ));
        if (permSnap.empty) { setSearchError(t("dashboard.no_permission")); return; }
      }

      setFoundPatient(patientData);
      setPatientExpanded(true);

      const [recSnap, labSnap] = await Promise.all([
        getDocs(query(collection(db, "medical_records"), where("patientId", "==", patientId), orderBy("createdAt", "desc"), limit(20))),
        getDocs(query(collection(db, "lab_results"), where("patientId", "==", patientId), orderBy("createdAt", "desc"), limit(20))),
      ]);
      setPatientRecords(recSnap.docs.map(d => ({ id: d.id, ...d.data() } as MedicalRecord)));
      setPatientLabs(labSnap.docs.map(d => ({ id: d.id, ...d.data() } as LabResult)));
    } catch {
      setSearchError(t("common.error"));
    } finally {
      setSearchLoading(false);
    }
  };

  const saveRecord = async () => {
    if (!user || !foundPatient) return;
    if (!recordForm.title || !recordForm.description) return;
    setSavingRecord(true);
    try {
      const record: Omit<MedicalRecord, "id"> = {
        patientId: foundPatient.uid,
        doctorId: user.uid,
        doctorName: `${user.firstName} ${user.lastName}`,
        type: recordForm.type,
        title: recordForm.title,
        description: recordForm.description,
        date: recordForm.date,
        createdAt: new Date().toISOString(),
      };
      const ref = await addDoc(collection(db, "medical_records"), record);
      setPatientRecords(prev => [{ id: ref.id, ...record }, ...prev]);
      setMyRecords(prev => [{ id: ref.id, ...record }, ...prev]);
      setShowAddRecord(false);
      setRecordForm({ type: "consultation", title: "", description: "", date: new Date().toISOString().split("T")[0] });
    } finally {
      setSavingRecord(false);
    }
  };

  const deleteRecord = async (recordId: string) => {
    await deleteDoc(doc(db, "medical_records", recordId));
    setPatientRecords(prev => prev.filter(r => r.id !== recordId));
    setMyRecords(prev => prev.filter(r => r.id !== recordId));
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
    { label: t("records.medical_records"), href: "/dashboard", icon: FileText, onClick: () => setActiveTab("records"), active: activeTab === "records" },
    { label: t("appointments.title"), href: "/dashboard", icon: CalendarDays, onClick: () => setActiveTab("appointments"), active: activeTab === "appointments" },
  ];

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: t("nav.dashboard") },
    { key: "patients", label: t("dashboard.search_patient") },
    { key: "records", label: t("records.medical_records") },
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
              { label: t("appointments.status_confirmed"), value: confirmedAppts.length, icon: Users, grad: "linear-gradient(135deg, #16a34a, #15803d)" },
            ].map(({ label, value, icon: Icon, grad }) => (
              <div key={label} style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: "18px 20px", display: "flex", alignItems: "center", gap: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
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
          <Card>
            <CardHead title={t("dashboard.search_patient")} />
            <div style={{ padding: 20 }}>
              <div style={{ display: "flex", gap: 10 }}>
                <input style={inp} placeholder={t("dashboard.patient_search_placeholder")} value={patientSpitarId}
                  onChange={e => setPatientSpitarId(e.target.value)} onKeyDown={e => e.key === "Enter" && searchPatient()}
                  onFocus={e => (e.target.style.borderColor = "#7c3aed")} onBlur={e => (e.target.style.borderColor = "#e2e8f0")} />
                <button onClick={searchPatient} disabled={searchLoading} style={{ padding: "0 20px", height: 44, borderRadius: 12, background: "linear-gradient(135deg, #7c3aed, #2563eb)", color: "#fff", border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}>
                  <Search size={15} /> {t("common.search")}
                </button>
              </div>
              {searchError && <p style={{ fontSize: 13, color: "#dc2626", marginTop: 10 }}>{searchError}</p>}
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
                <div style={{ padding: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>{t("records.medical_records")}</p>
                    {patientRecords.length === 0 ? (
                      <p style={{ fontSize: 13, color: "#94a3b8" }}>{t("common.no_data")}</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {patientRecords.map(r => (
                          <div key={r.id} style={{ padding: 12, borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                                  <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#ede9fe", color: "#7c3aed", textTransform: "capitalize" }}>{r.type}</span>
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
                  </div>

                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>{t("records.lab_results")}</p>
                    {patientLabs.length === 0 ? (
                      <p style={{ fontSize: 13, color: "#94a3b8" }}>{t("records.lab_no_results")}</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {patientLabs.map(l => (
                          <div key={l.id} style={{ padding: 12, borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                              <StatusBadge status={l.status} label={t(`records.${l.status}`)} />
                              <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{l.testName}</span>
                            </div>
                            <p style={{ fontSize: 11, color: "#94a3b8" }}>{l.labName} · {l.date}</p>
                            <p style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{l.result}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>
      )}

      {/* My Records */}
      {activeTab === "records" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {myRecords.length === 0 ? (
            <div style={{ padding: "48px 24px", textAlign: "center", color: "#94a3b8", fontSize: 14, background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0" }}>{t("common.no_data")}</div>
          ) : (
            myRecords.map(r => (
              <div key={r.id} style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: "16px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20, background: "#ede9fe", color: "#7c3aed", textTransform: "capitalize" }}>{r.type}</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{r.title}</span>
                    </div>
                    <p style={{ fontSize: 12, color: "#94a3b8" }}>{t("dashboard.patient_id_prefix")}: {r.patientId} · {r.date}</p>
                    <p style={{ fontSize: 13, color: "#64748b", marginTop: 6 }}>{r.description}</p>
                  </div>
                  <button onClick={() => deleteRecord(r.id)} style={{ background: "#fee2e2", border: "none", borderRadius: 10, cursor: "pointer", color: "#dc2626", padding: "6px 8px", marginLeft: 12 }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
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
              <Select value={recordForm.type} onValueChange={v => setRecordForm(f => ({ ...f, type: v as RecordType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["consultation", "prescription", "surgery", "diagnosis", "imaging", "other"] as RecordType[]).map(rt => (
                    <SelectItem key={rt} value={rt} className="capitalize">{rt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("records.record_title")}</Label>
              <Input value={recordForm.title} onChange={e => setRecordForm(f => ({ ...f, title: e.target.value }))} />
            </div>
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
