import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { collection, query, where, getDocs, addDoc, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FlaskConical, Activity, Search, Upload } from "lucide-react";
import type { LabResult, PatientProfile } from "@/lib/types";

type LabStatus = "normal" | "abnormal" | "critical" | "pending";

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  normal:   { bg: "#dcfce7", text: "#16a34a" },
  critical: { bg: "#fee2e2", text: "#dc2626" },
  abnormal: { bg: "#fef3c7", text: "#d97706" },
  pending:  { bg: "#f1f5f9", text: "#64748b" },
};

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_COLORS[status] ?? { bg: "#f1f5f9", text: "#64748b" };
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20, background: c.bg, color: c.text, textTransform: "capitalize", flexShrink: 0 }}>
      {status}
    </span>
  );
}

const NAV_ITEMS = (t: (k: string) => string, setTab: (t: string) => void) => [
  { label: t("nav.dashboard"), href: "/dashboard", icon: Activity, onClick: () => setTab("overview") },
  { label: t("dashboard.search_patient"), href: "/dashboard", icon: Search, onClick: () => setTab("patients") },
  { label: t("records.lab_results"), href: "/dashboard", icon: FlaskConical, onClick: () => setTab("results") },
];

export default function LabDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");

  const [myResults, setMyResults] = useState<LabResult[]>([]);
  const [loading, setLoading] = useState(true);

  const [patientSpitarId, setPatientSpitarId] = useState("");
  const [foundPatient, setFoundPatient] = useState<PatientProfile | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");

  const [showUpload, setShowUpload] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    testName: "", result: "", referenceRange: "",
    status: "pending" as LabStatus,
    date: new Date().toISOString().split("T")[0],
  });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!user) return;
    async function load() {
      setLoading(true);
      const snap = await getDocs(query(
        collection(db, "lab_results"),
        where("labId", "==", user!.uid),
        orderBy("createdAt", "desc"),
        limit(50),
      ));
      setMyResults(snap.docs.map(d => ({ id: d.id, ...d.data() } as LabResult)));
      setLoading(false);
    }
    load();
  }, [user]);

  const searchPatient = async () => {
    if (!patientSpitarId.trim()) return;
    setSearchLoading(true);
    setSearchError("");
    setFoundPatient(null);
    try {
      const snap = await getDocs(query(
        collection(db, "users"),
        where("spitarId", "==", patientSpitarId.trim().toUpperCase()),
        where("role", "==", "patient"),
      ));
      if (snap.empty) { setSearchError(t("dashboard.patient_not_found")); return; }
      const data = snap.docs[0].data() as PatientProfile;
      data.uid = snap.docs[0].id;
      setFoundPatient(data);
    } catch {
      setSearchError(t("common.error"));
    } finally {
      setSearchLoading(false);
    }
  };

  const uploadResult = async () => {
    if (!user || !foundPatient) return;
    if (!uploadForm.testName || !uploadForm.result) return;
    setUploading(true);
    try {
      const result: Omit<LabResult, "id"> = {
        patientId: foundPatient.uid,
        labId: user.uid,
        labName: (user as any).name || `${user.firstName} Lab`,
        testName: uploadForm.testName,
        result: uploadForm.result,
        referenceRange: uploadForm.referenceRange,
        status: uploadForm.status,
        date: uploadForm.date,
        createdAt: new Date().toISOString(),
      };
      const ref = await addDoc(collection(db, "lab_results"), result);
      setMyResults(prev => [{ id: ref.id, ...result }, ...prev]);
      setShowUpload(false);
      setUploadForm({ testName: "", result: "", referenceRange: "", status: "pending", date: new Date().toISOString().split("T")[0] });
    } finally {
      setUploading(false);
    }
  };

  const tabs = [
    { key: "overview", label: t("nav.dashboard") },
    { key: "patients", label: t("dashboard.search_patient") },
    { key: "results", label: t("records.lab_results") },
  ];

  const inp: React.CSSProperties = {
    height: 44, padding: "0 14px", border: "1.5px solid #e2e8f0", borderRadius: 12,
    fontSize: 14, outline: "none", background: "#f8fafc", color: "#0f172a",
    width: "100%", boxSizing: "border-box", transition: "border-color 0.15s",
  };

  return (
    <DashboardLayout navItems={NAV_ITEMS(t, setActiveTab)} title={`${(user as any).name || user?.firstName} — Lab`}>

      {/* Tab bar */}
      <div style={{ display: "flex", borderBottom: "2px solid #e5e7eb", marginBottom: 24, gap: 0, overflowX: "auto" }}>
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
            padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer",
            border: "none", background: "none", whiteSpace: "nowrap",
            borderBottom: activeTab === tab.key ? "2px solid #0891b2" : "2px solid transparent",
            marginBottom: -2, color: activeTab === tab.key ? "#0891b2" : "#6b7280",
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
              { label: t("records.lab_results"), value: myResults.length, icon: FlaskConical, grad: "linear-gradient(135deg, #0891b2, #16a34a)" },
              { label: "Critical Results", value: myResults.filter(r => r.status === "critical").length, icon: Activity, grad: "linear-gradient(135deg, #dc2626, #ea580c)" },
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
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9" }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>Recent Uploads</span>
            </div>
            <div style={{ padding: "0 20px" }}>
              {myResults.length === 0 ? (
                <p style={{ fontSize: 13, color: "#94a3b8", padding: "20px 0" }}>{t("common.no_data")}</p>
              ) : (
                myResults.slice(0, 5).map(r => (
                  <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 0", borderBottom: "1px solid #f1f5f9" }}>
                    <StatusBadge status={r.status} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", flex: 1 }}>{r.testName}</span>
                    <span style={{ fontSize: 12, color: "#94a3b8", flexShrink: 0 }}>{r.date}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Patient search */}
      {activeTab === "patients" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9" }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>Search Patient by SPITAR ID</span>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ display: "flex", gap: 10 }}>
                <input style={inp} placeholder="SP-XXXXXXXX" value={patientSpitarId}
                  onChange={e => setPatientSpitarId(e.target.value)} onKeyDown={e => e.key === "Enter" && searchPatient()}
                  onFocus={e => (e.target.style.borderColor = "#0891b2")} onBlur={e => (e.target.style.borderColor = "#e2e8f0")} />
                <button onClick={searchPatient} disabled={searchLoading} style={{ padding: "0 20px", height: 44, borderRadius: 12, background: "linear-gradient(135deg, #0891b2, #16a34a)", color: "#fff", border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}>
                  <Search size={15} /> {t("common.search")}
                </button>
              </div>
              {searchError && <p style={{ fontSize: 13, color: "#dc2626", marginTop: 10 }}>{searchError}</p>}
            </div>
          </div>

          {foundPatient && (
            <div style={{ background: "#f0fdf4", borderRadius: 16, border: "1.5px solid #86efac", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>{foundPatient.firstName} {foundPatient.lastName}</p>
                <p style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{foundPatient.spitarId}</p>
              </div>
              <button onClick={() => setShowUpload(true)} style={{ padding: "8px 16px", borderRadius: 12, background: "linear-gradient(135deg, #0891b2, #16a34a)", color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                <Upload size={14} /> {t("dashboard.upload_result")}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Results list */}
      {activeTab === "results" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {myResults.length === 0 ? (
            <div style={{ padding: "48px 24px", textAlign: "center", color: "#94a3b8", fontSize: 14, background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0" }}>{t("records.lab_no_results")}</div>
          ) : (
            myResults.map(r => (
              <div key={r.id} style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: "16px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", display: "flex", gap: 14, alignItems: "flex-start" }}>
                <StatusBadge status={r.status} />
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{r.testName}</p>
                  <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{r.date}</p>
                  <p style={{ fontSize: 13, color: "#64748b", marginTop: 6 }}>{r.result}</p>
                  {r.referenceRange && <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>Ref: {r.referenceRange}</p>}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Lab Result — {foundPatient?.firstName} {foundPatient?.lastName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t("records.test_name")}</Label>
              <Input value={uploadForm.testName} onChange={e => setUploadForm(f => ({ ...f, testName: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>{t("records.result")}</Label>
              <Input value={uploadForm.result} onChange={e => setUploadForm(f => ({ ...f, result: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>{t("records.reference_range")}</Label>
              <Input value={uploadForm.referenceRange} onChange={e => setUploadForm(f => ({ ...f, referenceRange: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={uploadForm.status} onValueChange={v => setUploadForm(f => ({ ...f, status: v as LabStatus }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">{t("records.normal")}</SelectItem>
                  <SelectItem value="abnormal">{t("records.abnormal")}</SelectItem>
                  <SelectItem value="critical">{t("records.critical")}</SelectItem>
                  <SelectItem value="pending">{t("records.pending")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={uploadForm.date} onChange={e => setUploadForm(f => ({ ...f, date: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpload(false)}>{t("common.cancel")}</Button>
            <Button onClick={uploadResult} disabled={uploading}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
