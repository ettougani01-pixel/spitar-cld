import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { collection, query, where, getDocs, addDoc, updateDoc, doc, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Building2, Users, Activity, Search, UserPlus } from "lucide-react";
import type { PatientProfile } from "@/lib/types";

const NAV_ITEMS = (t: (k: string) => string, setTab: (t: string) => void) => [
  { label: t("nav.dashboard"), href: "/dashboard", icon: Activity, onClick: () => setTab("overview") },
  { label: "Admissions", href: "/dashboard", icon: Users, onClick: () => setTab("admissions") },
];

interface Admission {
  id: string;
  patientId: string;
  patientName: string;
  patientSpitarId: string;
  hospitalId: string;
  admissionDate: string;
  dischargeDate?: string;
  reason: string;
  status: "admitted" | "discharged";
  dischargeSummary?: string;
}

export default function HospitalDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");

  const [admissions, setAdmissions] = useState<Admission[]>([]);
  const [patientSearch, setPatientSearch] = useState("");
  const [foundPatient, setFoundPatient] = useState<PatientProfile | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [showAdmitDialog, setShowAdmitDialog] = useState(false);
  const [admitReason, setAdmitReason] = useState("");
  const [showDischargeDialog, setShowDischargeDialog] = useState<Admission | null>(null);
  const [dischargeSummary, setDischargeSummary] = useState("");

  useEffect(() => {
    if (!user) return;
    async function load() {
      const snap = await getDocs(query(
        collection(db, "hospital_admissions"),
        where("hospitalId", "==", user!.uid),
        orderBy("admissionDate", "desc"),
        limit(50),
      ));
      setAdmissions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Admission)));
    }
    load();
  }, [user]);

  const searchPatient = async () => {
    if (!patientSearch.trim()) return;
    setSearchLoading(true);
    setSearchError("");
    setFoundPatient(null);
    try {
      const snap = await getDocs(query(
        collection(db, "users"),
        where("spitarId", "==", patientSearch.trim().toUpperCase()),
        where("role", "==", "patient"),
      ));
      if (snap.empty) { setSearchError("No patient found."); return; }
      const data = snap.docs[0].data() as PatientProfile;
      data.uid = snap.docs[0].id;
      if (!data.hospitalOpenAccess) {
        const permSnap = await getDocs(query(
          collection(db, "access_permissions"),
          where("patientId", "==", snap.docs[0].id),
          where("granteeId", "==", user!.uid),
          where("isActive", "==", true),
        ));
        if (permSnap.empty) { setSearchError("Patient has not granted hospital access."); return; }
      }
      setFoundPatient(data);
    } catch {
      setSearchError(t("common.error"));
    } finally {
      setSearchLoading(false);
    }
  };

  const admitPatient = async () => {
    if (!user || !foundPatient || !admitReason) return;
    const admission: Omit<Admission, "id"> = {
      patientId: foundPatient.uid,
      patientName: `${foundPatient.firstName} ${foundPatient.lastName}`,
      patientSpitarId: foundPatient.spitarId,
      hospitalId: user.uid,
      admissionDate: new Date().toISOString().split("T")[0],
      reason: admitReason,
      status: "admitted",
    };
    const ref = await addDoc(collection(db, "hospital_admissions"), admission);
    setAdmissions(prev => [{ id: ref.id, ...admission }, ...prev]);
    setShowAdmitDialog(false);
    setAdmitReason("");
    setFoundPatient(null);
    setPatientSearch("");
  };

  const dischargePatient = async () => {
    if (!showDischargeDialog || !user) return;
    await updateDoc(doc(db, "hospital_admissions", showDischargeDialog.id), {
      status: "discharged",
      dischargeDate: new Date().toISOString().split("T")[0],
      dischargeSummary,
    });
    if (dischargeSummary) {
      await addDoc(collection(db, "medical_records"), {
        patientId: showDischargeDialog.patientId,
        doctorId: user.uid,
        doctorName: `${user.firstName} ${user.lastName} (Hospital)`,
        type: "other",
        title: "Hospital Discharge Summary",
        description: dischargeSummary,
        date: new Date().toISOString().split("T")[0],
        createdAt: new Date().toISOString(),
      });
    }
    setAdmissions(prev => prev.map(a =>
      a.id === showDischargeDialog.id
        ? { ...a, status: "discharged", dischargeDate: new Date().toISOString().split("T")[0], dischargeSummary }
        : a
    ));
    setShowDischargeDialog(null);
    setDischargeSummary("");
  };

  const admitted = admissions.filter(a => a.status === "admitted");
  const discharged = admissions.filter(a => a.status === "discharged");

  const tabs = [
    { key: "overview", label: t("nav.dashboard") },
    { key: "admissions", label: "Admissions" },
  ];

  const inp: React.CSSProperties = {
    height: 44, padding: "0 14px", border: "1.5px solid #e2e8f0", borderRadius: 12,
    fontSize: 14, outline: "none", background: "#f8fafc", color: "#0f172a",
    width: "100%", boxSizing: "border-box", transition: "border-color 0.15s",
  };

  return (
    <DashboardLayout navItems={NAV_ITEMS(t, setActiveTab)} title={`${(user as any).name || user?.firstName} — Hospital`}>

      {/* Tab bar */}
      <div style={{ display: "flex", borderBottom: "2px solid #e5e7eb", marginBottom: 24, gap: 0, overflowX: "auto" }}>
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
            padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer",
            border: "none", background: "none", whiteSpace: "nowrap",
            borderBottom: activeTab === tab.key ? "2px solid #0d9488" : "2px solid transparent",
            marginBottom: -2, color: activeTab === tab.key ? "#0d9488" : "#6b7280",
            transition: "all 0.15s",
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {[
              { label: "Currently Admitted", value: admitted.length, icon: Users, grad: "linear-gradient(135deg, #0d9488, #16a34a)" },
              { label: "Total Discharged", value: discharged.length, icon: Building2, grad: "linear-gradient(135deg, #2563eb, #06b6d4)" },
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

          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>Current Admissions</span>
              <button onClick={() => setActiveTab("admissions")} style={{ padding: "7px 14px", borderRadius: 10, background: "linear-gradient(135deg, #0d9488, #16a34a)", color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                <UserPlus size={14} /> Admit Patient
              </button>
            </div>
            <div style={{ padding: "0 20px" }}>
              {admitted.length === 0 ? (
                <p style={{ fontSize: 13, color: "#94a3b8", padding: "20px 0" }}>No patients currently admitted.</p>
              ) : (
                admitted.map(a => (
                  <div key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: "1px solid #f1f5f9" }}>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{a.patientName}</p>
                      <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{a.patientSpitarId} · Admitted {a.admissionDate}</p>
                    </div>
                    <button onClick={() => setShowDischargeDialog(a)} style={{ padding: "6px 14px", borderRadius: 10, background: "#fee2e2", color: "#dc2626", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                      Discharge
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Admissions tab */}
      {activeTab === "admissions" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Search & admit */}
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9" }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>Admit a Patient</span>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                <input style={inp} placeholder="Patient SPITAR ID" value={patientSearch}
                  onChange={e => setPatientSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && searchPatient()}
                  onFocus={e => (e.target.style.borderColor = "#0d9488")} onBlur={e => (e.target.style.borderColor = "#e2e8f0")} />
                <button onClick={searchPatient} disabled={searchLoading} style={{ padding: "0 20px", height: 44, borderRadius: 12, background: "linear-gradient(135deg, #0d9488, #16a34a)", color: "#fff", border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}>
                  <Search size={15} /> {t("common.search")}
                </button>
              </div>
              {searchError && <p style={{ fontSize: 13, color: "#dc2626" }}>{searchError}</p>}
              {foundPatient && (
                <div style={{ background: "#f0fdf4", border: "1.5px solid #86efac", borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{foundPatient.firstName} {foundPatient.lastName}</p>
                    <p style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{foundPatient.spitarId}</p>
                  </div>
                  <button onClick={() => setShowAdmitDialog(true)} style={{ padding: "7px 16px", borderRadius: 10, background: "linear-gradient(135deg, #0d9488, #16a34a)", color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    Admit
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* All admissions */}
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9" }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>All Admissions</span>
            </div>
            <div style={{ padding: "0 20px" }}>
              {admissions.length === 0 ? (
                <p style={{ fontSize: 13, color: "#94a3b8", padding: "20px 0" }}>{t("common.no_data")}</p>
              ) : (
                admissions.map(a => (
                  <div key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: "1px solid #f1f5f9" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20, background: a.status === "admitted" ? "#dcfce7" : "#f1f5f9", color: a.status === "admitted" ? "#16a34a" : "#64748b", textTransform: "capitalize" }}>
                          {a.status}
                        </span>
                        <span style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{a.patientName}</span>
                      </div>
                      <p style={{ fontSize: 12, color: "#94a3b8" }}>{a.admissionDate}{a.dischargeDate ? ` → ${a.dischargeDate}` : ""}</p>
                    </div>
                    {a.status === "admitted" && (
                      <button onClick={() => setShowDischargeDialog(a)} style={{ padding: "6px 14px", borderRadius: 10, background: "#fee2e2", color: "#dc2626", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                        Discharge
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Admit dialog */}
      <Dialog open={showAdmitDialog} onOpenChange={setShowAdmitDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Admit {foundPatient?.firstName} {foundPatient?.lastName}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Reason for Admission</Label>
            <Textarea value={admitReason} onChange={e => setAdmitReason(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdmitDialog(false)}>{t("common.cancel")}</Button>
            <Button onClick={admitPatient} disabled={!admitReason}>Confirm Admission</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discharge dialog */}
      <Dialog open={!!showDischargeDialog} onOpenChange={() => setShowDischargeDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Discharge {showDischargeDialog?.patientName}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Discharge Summary (will be added to patient's medical file)</Label>
            <Textarea value={dischargeSummary} onChange={e => setDischargeSummary(e.target.value)} rows={4} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDischargeDialog(null)}>{t("common.cancel")}</Button>
            <Button onClick={dischargePatient}>Confirm Discharge</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
