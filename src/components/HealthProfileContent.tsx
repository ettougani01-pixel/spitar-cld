import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { collection, query, where, getDocs, addDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertTriangle, Pill, Users, Activity, Plus, Trash2, Zap, FileText, ChevronDown, ChevronUp, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

interface Allergy { id: string; allergenName: string; type: string; severity: string; reaction: string; }
interface Medication { id: string; name: string; type: string; dosage: string; frequency: string; startDate: string; notes?: string; }
interface FamilyHistory { id: string; relation: string; condition: string; detail: string; }
interface SideEffect { id: string; treatmentName: string; symptom: string; occurredAt: string; }
interface Vital { id: string; type: string; value: string; unit: string; notes?: string; recordedAt: string; }
interface PatientDocument { id: string; docType: string; docDate: string; notes: string; url?: string; fileName?: string; fileBase64?: string; fileType?: string; }

type SeverityLevel = "mild" | "moderate" | "severe" | "life_threatening";
const SEVERITY_COLORS: Record<SeverityLevel, { bg: string; color: string }> = {
  mild: { bg: "#dcfce7", color: "#16a34a" },
  moderate: { bg: "#fef9c3", color: "#ca8a04" },
  severe: { bg: "#fed7aa", color: "#ea580c" },
  life_threatening: { bg: "#fecaca", color: "#dc2626" },
};

const VITAL_TABS = [
  { key: "blood_pressure", label: "Blood Pressure", unit: "mmHg" },
  { key: "blood_sugar", label: "Blood Sugar", unit: "mg/dL" },
  { key: "weight", label: "Weight / BMI", unit: "kg" },
  { key: "heart_rate", label: "Heart Rate", unit: "bpm" },
  { key: "sleep", label: "Sleep", unit: "hours" },
];

function SectionCard({ title, icon: Icon, iconColor, iconBg, children, addLabel, onAdd, defaultOpen = true }: {
  title: string; icon: any; iconColor: string; iconBg: string;
  children: React.ReactNode; addLabel: string; onAdd: () => void; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, marginBottom: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      <div
        onClick={() => setOpen(v => !v)}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", cursor: "pointer", borderBottom: open ? "1px solid #f3f4f6" : "none" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: iconBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon size={15} style={{ color: iconColor }} />
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{title}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={e => { e.stopPropagation(); onAdd(); }}
            style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, color: "#2563eb", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}
          >
            <Plus size={12} /> {addLabel}
          </button>
          {open ? <ChevronUp size={16} style={{ color: "#9ca3af" }} /> : <ChevronDown size={16} style={{ color: "#9ca3af" }} />}
        </div>
      </div>
      {open && <div style={{ padding: "12px 16px" }}>{children}</div>}
    </div>
  );
}

export function HealthProfileContent() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [allergies, setAllergies] = useState<Allergy[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [familyHistory, setFamilyHistory] = useState<FamilyHistory[]>([]);
  const [sideEffects, setSideEffects] = useState<SideEffect[]>([]);
  const [vitals, setVitals] = useState<Vital[]>([]);
  const [documents, setDocuments] = useState<PatientDocument[]>([]);
  const [activeVitalTab, setActiveVitalTab] = useState("blood_pressure");
  const [loading, setLoading] = useState(true);

  const [showAllergyDialog, setShowAllergyDialog] = useState(false);
  const [showMedDialog, setShowMedDialog] = useState(false);
  const [showFamilyDialog, setShowFamilyDialog] = useState(false);
  const [showSideEffectDialog, setShowSideEffectDialog] = useState(false);
  const [showVitalDialog, setShowVitalDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saving2, setSaving2] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [allergyForm, setAllergyForm] = useState({ allergenName: "", type: "medication", severity: "mild", reaction: "" });
  const [medForm, setMedForm] = useState({ name: "", type: "prescription_med", dosage: "", frequency: "", startDate: "", notes: "" });
  const [familyForm, setFamilyForm] = useState({ relation: "parent", condition: "diabetes", detail: "" });
  const [sideEffectForm, setSideEffectForm] = useState({ treatmentName: "", symptom: "", occurredAt: "" });
  const [vitalForm, setVitalForm] = useState({ type: "blood_pressure", value: "", unit: "mmHg", notes: "", recordedAt: new Date().toISOString().split("T")[0] });
  const [docForm, setDocForm] = useState({ docType: "lab_result", docDate: new Date().toISOString().split("T")[0], notes: "" });

  useEffect(() => {
    if (!user) return;
    const uid = user.uid;
    async function load() {
      setLoading(true);
      try {
      const [aSnap, mSnap, fSnap, seSnap, vSnap, dSnap] = await Promise.all([
        getDocs(query(collection(db, "patient_allergies"), where("patientId", "==", uid))),
        getDocs(query(collection(db, "patient_medications"), where("patientId", "==", uid))),
        getDocs(query(collection(db, "patient_family_history"), where("patientId", "==", uid))),
        getDocs(query(collection(db, "patient_side_effects"), where("patientId", "==", uid))),
        getDocs(query(collection(db, "patient_vitals"), where("patientId", "==", uid))),
        getDocs(query(collection(db, "patient_documents"), where("patientId", "==", uid))),
      ]);
      setAllergies(aSnap.docs.map(d => ({ id: d.id, ...d.data() } as Allergy)));
      setMedications(mSnap.docs.map(d => ({ id: d.id, ...d.data() } as Medication)));
      setFamilyHistory(fSnap.docs.map(d => ({ id: d.id, ...d.data() } as FamilyHistory)));
      setSideEffects(seSnap.docs.map(d => ({ id: d.id, ...d.data() } as SideEffect)));
      setVitals(vSnap.docs.map(d => ({ id: d.id, ...d.data() } as Vital)).sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)));
      setDocuments(dSnap.docs.map(d => ({ id: d.id, ...d.data() } as PatientDocument)).sort((a, b) => b.docDate.localeCompare(a.docDate)));
      } catch (err) {
        console.error("HealthProfile load error:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  const deleteItem = async (col: string, id: string, setter: React.Dispatch<React.SetStateAction<any[]>>) => {
    await deleteDoc(doc(db, col, id));
    setter(p => p.filter(x => x.id !== id));
  };

  const addAllergy = async () => {
    if (!user || !allergyForm.allergenName) return;
    setSaving(true);
    try {
      const ref2 = await addDoc(collection(db, "patient_allergies"), { ...allergyForm, patientId: user.uid, createdAt: new Date().toISOString() });
      setAllergies(p => [{ id: ref2.id, ...allergyForm }, ...p]);
      setShowAllergyDialog(false);
      setAllergyForm({ allergenName: "", type: "medication", severity: "mild", reaction: "" });
    } finally { setSaving(false); }
  };

  const addMedication = async () => {
    if (!user || !medForm.name) return;
    setSaving(true);
    try {
      const ref2 = await addDoc(collection(db, "patient_medications"), { ...medForm, patientId: user.uid, createdAt: new Date().toISOString() });
      setMedications(p => [{ id: ref2.id, ...medForm }, ...p]);
      setShowMedDialog(false);
      setMedForm({ name: "", type: "prescription_med", dosage: "", frequency: "", startDate: "", notes: "" });
    } finally { setSaving(false); }
  };

  const addFamilyHistory = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const ref2 = await addDoc(collection(db, "patient_family_history"), { ...familyForm, patientId: user.uid, createdAt: new Date().toISOString() });
      setFamilyHistory(p => [{ id: ref2.id, ...familyForm }, ...p]);
      setShowFamilyDialog(false);
      setFamilyForm({ relation: "parent", condition: "diabetes", detail: "" });
    } finally { setSaving(false); }
  };

  const addSideEffect = async () => {
    if (!user || !sideEffectForm.treatmentName) return;
    setSaving(true);
    try {
      const ref2 = await addDoc(collection(db, "patient_side_effects"), { ...sideEffectForm, patientId: user.uid, createdAt: new Date().toISOString() });
      setSideEffects(p => [{ id: ref2.id, ...sideEffectForm }, ...p]);
      setShowSideEffectDialog(false);
      setSideEffectForm({ treatmentName: "", symptom: "", occurredAt: "" });
    } finally { setSaving(false); }
  };

  const addVital = async () => {
    if (!user || !vitalForm.value) return;
    setSaving(true);
    try {
      const ref2 = await addDoc(collection(db, "patient_vitals"), { ...vitalForm, patientId: user.uid, createdAt: new Date().toISOString() });
      setVitals(p => [{ id: ref2.id, ...vitalForm }, ...p]);
      setShowVitalDialog(false);
      setVitalForm({ type: "blood_pressure", value: "", unit: "mmHg", notes: "", recordedAt: new Date().toISOString().split("T")[0] });
    } finally { setSaving(false); }
  };

  const saveDocument = async (file?: File) => {
    if (!user) return;
    setSaving2(true);
    setUploadError(null);
    try {
      let fileData: { fileName?: string; url?: string } = {};
      if (file) {
        const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
        const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", uploadPreset);
        formData.append("folder", "spitar_docs");
        const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
          method: "POST",
          body: formData,
        });
        if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
        const json = await res.json();
        fileData = { fileName: file.name, url: json.secure_url };
      }
      const docData = { ...docForm, ...fileData, patientId: user.uid, createdAt: new Date().toISOString() };
      const docRef = await addDoc(collection(db, "patient_documents"), docData);
      setDocuments(p => [{ id: docRef.id, ...docData } as PatientDocument, ...p]);
      setDocForm({ docType: "lab_result", docDate: new Date().toISOString().split("T")[0], notes: "" });
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: any) {
      setUploadError(err?.message ?? "Error saving document");
    } finally {
      setSaving2(false);
    }
  };

  const totalSections = 6;
  const filledSections = [
    allergies.length > 0, medications.length > 0, familyHistory.length > 0,
    sideEffects.length > 0, vitals.length > 0, documents.length > 0,
  ].filter(Boolean).length;
  const completeness = Math.round((filledSections / totalSections) * 100);

  const hasCritical = allergies.some(a => a.severity === "life_threatening" || a.severity === "severe");
  const vitalsByType = (type: string) => vitals.filter(v => v.type === type);

  if (loading) return <div style={{ textAlign: "center", padding: 40, color: "#9ca3af", fontSize: 13 }}>Loading...</div>;

  return (
    <div>
      {/* Critical alert */}
      {hasCritical && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={15} style={{ color: "#dc2626", flexShrink: 0 }} />
          <p style={{ fontSize: 12, fontWeight: 600, color: "#dc2626", margin: 0 }}>{t("hp.high_alert_warning")}</p>
        </div>
      )}

      {/* Profile Completeness */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "14px 16px", marginBottom: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{t("hp.profile_completeness")}</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: completeness === 100 ? "#16a34a" : completeness >= 50 ? "#d97706" : "#dc2626" }}>{completeness}%</span>
        </div>
        <div style={{ height: 6, background: "#f3f4f6", borderRadius: 99, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${completeness}%`, background: completeness === 100 ? "#16a34a" : completeness >= 50 ? "#f59e0b" : "#ef4444", borderRadius: 99, transition: "width 0.4s" }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 24px", marginTop: 10 }}>
          {[
            { label: t("hp.allergies"), done: allergies.length > 0 },
            { label: t("hp.medications"), done: medications.length > 0 },
            { label: t("hp.family_history"), done: familyHistory.length > 0 },
            { label: t("hp.side_effects_journal"), done: sideEffects.length > 0 },
            { label: t("hp.vitals_biometrics"), done: vitals.length > 0 },
            { label: t("hp.documents_vault"), done: documents.length > 0 },
          ].map(({ label, done }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: done ? "#16a34a" : "#9ca3af" }}>
              <span style={{ fontSize: 10 }}>{done ? "✓" : "○"}</span> {label}
            </div>
          ))}
        </div>
      </div>

      {/* Allergies */}
      <SectionCard title={t("hp.allergies")} icon={AlertTriangle} iconColor="#dc2626" iconBg="#fef2f2" addLabel={t("hp.add_allergy")} onAdd={() => setShowAllergyDialog(true)}>
        {allergies.length === 0 ? (
          <p style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", padding: "16px 0" }}>{t("hp.no_allergies")}</p>
        ) : (
          allergies.map(a => {
            const sev = SEVERITY_COLORS[a.severity as SeverityLevel] || { bg: "#f3f4f6", color: "#6b7280" };
            return (
              <div key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f3f4f6" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: sev.bg, color: sev.color }}>
                    {t(`hp.${a.severity}`)}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{a.allergenName}</span>
                  {a.reaction && <span style={{ fontSize: 12, color: "#6b7280" }}>· {a.reaction}</span>}
                </div>
                <button onClick={() => deleteItem("patient_allergies", a.id, setAllergies)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", padding: 4 }}>
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })
        )}
      </SectionCard>

      {/* Medications */}
      <SectionCard title={t("hp.medications")} icon={Pill} iconColor="#7c3aed" iconBg="#f5f3ff" addLabel={t("hp.add_medication")} onAdd={() => setShowMedDialog(true)}>
        {medications.length === 0 ? (
          <p style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", padding: "16px 0" }}>{t("hp.no_medications")}</p>
        ) : (
          medications.map(m => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f3f4f6" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, background: "#f3f4f6", color: "#6b7280", padding: "2px 8px", borderRadius: 20 }}>{m.type.replace(/_/g, " ")}</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{m.name}</span>
                </div>
                <p style={{ fontSize: 11, color: "#9ca3af", margin: "2px 0 0" }}>{m.dosage} · {m.frequency}</p>
              </div>
              <button onClick={() => deleteItem("patient_medications", m.id, setMedications)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", padding: 4 }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </SectionCard>

      {/* Family History */}
      <SectionCard title={t("hp.family_history")} icon={Users} iconColor="#0891b2" iconBg="#ecfeff" addLabel={t("hp.add_family_entry")} onAdd={() => setShowFamilyDialog(true)}>
        {familyHistory.length === 0 ? (
          <p style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", padding: "16px 0" }}>{t("hp.no_family_history")}</p>
        ) : (
          familyHistory.map(f => (
            <div key={f.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f3f4f6" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, background: "#f3f4f6", color: "#6b7280", padding: "2px 8px", borderRadius: 20, textTransform: "capitalize" }}>{t(`hp.${f.relation}`)}</span>
                <span style={{ fontSize: 13, fontWeight: 600, textTransform: "capitalize" }}>{t(`hp.${f.condition}`) || f.condition}</span>
                {f.detail && <span style={{ fontSize: 12, color: "#6b7280" }}>· {f.detail}</span>}
              </div>
              <button onClick={() => deleteItem("patient_family_history", f.id, setFamilyHistory)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", padding: 4 }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </SectionCard>

      {/* Side Effects */}
      <SectionCard title={t("hp.side_effects_journal")} icon={Zap} iconColor="#d97706" iconBg="#fffbeb" addLabel={t("hp.log_side_effect")} onAdd={() => setShowSideEffectDialog(true)}>
        {sideEffects.length === 0 ? (
          <p style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", padding: "16px 0" }}>{t("hp.no_side_effects")}</p>
        ) : (
          sideEffects.map(s => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f3f4f6" }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{s.treatmentName}</p>
                <p style={{ fontSize: 12, color: "#6b7280", margin: "2px 0 0" }}>{s.symptom} · {s.occurredAt}</p>
              </div>
              <button onClick={() => deleteItem("patient_side_effects", s.id, setSideEffects)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", padding: 4 }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </SectionCard>

      {/* Vitals */}
      <SectionCard title={t("hp.vitals_biometrics")} icon={Activity} iconColor="#16a34a" iconBg="#dcfce7" addLabel={`Log ${VITAL_TABS.find(v => v.key === activeVitalTab)?.label ?? "Vital"}`} onAdd={() => { setVitalForm(f => ({ ...f, type: activeVitalTab, unit: VITAL_TABS.find(v => v.key === activeVitalTab)?.unit ?? "" })); setShowVitalDialog(true); }}>
        {/* Vital type tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 12, overflowX: "auto", flexWrap: "wrap" }}>
          {VITAL_TABS.map(vt => (
            <button
              key={vt.key}
              onClick={() => setActiveVitalTab(vt.key)}
              style={{ fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 20, cursor: "pointer", border: "none", background: activeVitalTab === vt.key ? "#2563eb" : "#f3f4f6", color: activeVitalTab === vt.key ? "#fff" : "#6b7280", transition: "all 0.15s" }}
            >
              {vt.label}
            </button>
          ))}
        </div>
        {vitalsByType(activeVitalTab).length === 0 ? (
          <p style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", padding: "16px 0" }}>
            {t("hp.no_vitals", { type: VITAL_TABS.find(v => v.key === activeVitalTab)?.label })}
          </p>
        ) : (
          vitalsByType(activeVitalTab).slice(0, 5).map(v => (
            <div key={v.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f3f4f6" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>{v.value}</span>
                <span style={{ fontSize: 12, color: "#6b7280" }}>{v.unit}</span>
                {v.notes && <span style={{ fontSize: 11, color: "#9ca3af" }}>· {v.notes}</span>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: "#9ca3af" }}>{v.recordedAt}</span>
                <button onClick={() => deleteItem("patient_vitals", v.id, setVitals)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", padding: 4 }}>
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))
        )}
      </SectionCard>

      {/* Documents Vault */}
      <SectionCard title={t("hp.documents_vault")} icon={FileText} iconColor="#2563eb" iconBg="#eff6ff" addLabel={t("hp.document_uploaded")} onAdd={() => fileInputRef.current?.click()}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>{t("hp.doc_type")}</label>
            <select
              value={docForm.docType}
              onChange={e => setDocForm(f => ({ ...f, docType: e.target.value }))}
              style={{ width: "100%", height: 36, padding: "0 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, background: "#fff" }}
            >
              <option value="lab_result">{t("hp.lab_result")}</option>
              <option value="radiology">{t("hp.radiology")}</option>
              <option value="discharge_summary">{t("hp.discharge_summary")}</option>
              <option value="surgery_report">{t("hp.surgery_report")}</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>{t("hp.document_date")}</label>
            <input type="date" value={docForm.docDate} onChange={e => setDocForm(f => ({ ...f, docDate: e.target.value }))} style={{ width: "100%", height: 36, padding: "0 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, boxSizing: "border-box" }} />
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>{t("records.notes")}</label>
          <input value={docForm.notes} onChange={e => setDocForm(f => ({ ...f, notes: e.target.value }))} placeholder={t("hp.doc_notes_placeholder")} style={{ width: "100%", height: 36, padding: "0 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, boxSizing: "border-box" }} />
        </div>

        {/* Drop zone */}
        <div
          onClick={() => !saving2 && fileInputRef.current?.click()}
          style={{ border: "2px dashed #d1d5db", borderRadius: 8, padding: "20px 16px", textAlign: "center", cursor: saving2 ? "wait" : "pointer", background: "#f9fafb", marginBottom: 8 }}
        >
          <Upload size={22} style={{ color: "#9ca3af", margin: "0 auto 6px", display: "block" }} />
          <p style={{ fontSize: 13, color: "#374151", margin: "0 0 2px", fontWeight: 500 }}>
            {saving2 ? t("hp.uploading") : t("hp.drop_or_click")}
          </p>
          <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>{t("hp.supported_formats")} — {t("hp.max_size")}</p>
        </div>
        <button
          onClick={() => saveDocument()}
          disabled={saving2}
          style={{ width: "100%", padding: "8px", background: "#f8fafc", color: "#374151", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: saving2 ? "not-allowed" : "pointer", opacity: saving2 ? 0.7 : 1, marginBottom: 8 }}
        >
          {saving2 ? "..." : t("hp.save_document")}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          style={{ display: "none" }}
          onChange={e => { const f = e.target.files?.[0]; if (f) saveDocument(f); }}
        />
        {uploadError && (
          <p style={{ fontSize: 12, color: "#dc2626", padding: "6px 10px", background: "#fef2f2", borderRadius: 6, margin: "4px 0" }}>{uploadError}</p>
        )}

        {documents.length === 0 ? (
          <p style={{ fontSize: 12, color: "#9ca3af", textAlign: "center", marginTop: 12 }}>{t("hp.no_documents")}</p>
        ) : (
          <div style={{ marginTop: 12 }}>
            {documents.map(d => (
              <div key={d.id} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #f3f4f6", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* File name */}
                  {d.fileName && (
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", margin: "0 0 4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {d.fileName}
                    </p>
                  )}
                  {/* Doc type badge + date */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: d.notes ? 3 : 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: "#eff6ff", color: "#2563eb" }}>
                      {t(`hp.${d.docType}`) || d.docType}
                    </span>
                    <span style={{ fontSize: 11, color: "#6b7280" }}>📅 {d.docDate}</span>
                  </div>
                  {/* Notes */}
                  {d.notes && (
                    <p style={{ fontSize: 12, color: "#6b7280", margin: "2px 0 0", fontStyle: "italic" }}>
                      {d.notes}
                    </p>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  {(d.url || d.fileBase64) && (
                    <a
                      href={d.url ?? `data:${d.fileType ?? "application/octet-stream"};base64,${d.fileBase64}`}
                      download={d.fileName ?? "document"}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 12, color: "#2563eb", textDecoration: "none", fontWeight: 500 }}
                    >
                      {t("common.download")}
                    </a>
                  )}
                  <button onClick={() => deleteItem("patient_documents", d.id, setDocuments)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", padding: 4 }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* ── Dialogs ── */}
      <Dialog open={showAllergyDialog} onOpenChange={setShowAllergyDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("hp.add_allergy")}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2"><Label>{t("hp.allergen_name")}</Label><Input value={allergyForm.allergenName} onChange={e => setAllergyForm(f => ({ ...f, allergenName: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("hp.allergy_type")}</Label>
                <Select value={allergyForm.type} onValueChange={v => setAllergyForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="medication">{t("hp.medication")}</SelectItem>
                    <SelectItem value="food">{t("hp.food")}</SelectItem>
                    <SelectItem value="material">{t("hp.material")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("hp.severity")}</Label>
                <Select value={allergyForm.severity} onValueChange={v => setAllergyForm(f => ({ ...f, severity: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mild">{t("hp.mild")}</SelectItem>
                    <SelectItem value="moderate">{t("hp.moderate")}</SelectItem>
                    <SelectItem value="severe">{t("hp.severe")}</SelectItem>
                    <SelectItem value="life_threatening">{t("hp.life_threatening")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2"><Label>{t("hp.reaction")}</Label><Input value={allergyForm.reaction} onChange={e => setAllergyForm(f => ({ ...f, reaction: e.target.value }))} placeholder={t("hp.reaction_placeholder")} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowAllergyDialog(false)}>{t("common.cancel")}</Button><Button onClick={addAllergy} disabled={saving}>{t("common.save")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showMedDialog} onOpenChange={setShowMedDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("hp.add_medication")}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2"><Label>{t("hp.med_name")}</Label><Input value={medForm.name} onChange={e => setMedForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("hp.med_type")}</Label>
                <Select value={medForm.type} onValueChange={v => setMedForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prescription_med">{t("hp.prescription_med")}</SelectItem>
                    <SelectItem value="otc">{t("hp.otc")}</SelectItem>
                    <SelectItem value="vitamin">{t("hp.vitamin")}</SelectItem>
                    <SelectItem value="supplement">{t("hp.supplement")}</SelectItem>
                    <SelectItem value="herb">{t("hp.herb")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>{t("hp.dosage")}</Label><Input value={medForm.dosage} onChange={e => setMedForm(f => ({ ...f, dosage: e.target.value }))} placeholder="500mg" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>{t("hp.frequency")}</Label><Input value={medForm.frequency} onChange={e => setMedForm(f => ({ ...f, frequency: e.target.value }))} placeholder="Once daily" /></div>
              <div className="space-y-2"><Label>{t("hp.start_date")}</Label><Input type="date" value={medForm.startDate} onChange={e => setMedForm(f => ({ ...f, startDate: e.target.value }))} /></div>
            </div>
            <div className="space-y-2"><Label>{t("records.notes")} ({t("common.optional")})</Label><Input value={medForm.notes} onChange={e => setMedForm(f => ({ ...f, notes: e.target.value }))} placeholder={t("hp.med_notes_placeholder")} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowMedDialog(false)}>{t("common.cancel")}</Button><Button onClick={addMedication} disabled={saving}>{t("common.save")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showFamilyDialog} onOpenChange={setShowFamilyDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("hp.add_family_entry")}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("hp.relation")}</Label>
                <Select value={familyForm.relation} onValueChange={v => setFamilyForm(f => ({ ...f, relation: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="parent">{t("hp.parent")}</SelectItem>
                    <SelectItem value="sibling">{t("hp.sibling")}</SelectItem>
                    <SelectItem value="grandparent">{t("hp.grandparent")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("hp.condition")}</Label>
                <Select value={familyForm.condition} onValueChange={v => setFamilyForm(f => ({ ...f, condition: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="diabetes">{t("hp.diabetes")}</SelectItem>
                    <SelectItem value="heart_disease">{t("hp.heart_disease")}</SelectItem>
                    <SelectItem value="cancer">{t("hp.cancer")}</SelectItem>
                    <SelectItem value="hypertension">{t("hp.hypertension")}</SelectItem>
                    <SelectItem value="stroke">{t("hp.stroke")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2"><Label>{t("hp.condition_detail")}</Label><Input value={familyForm.detail} onChange={e => setFamilyForm(f => ({ ...f, detail: e.target.value }))} placeholder={t("hp.condition_detail_placeholder")} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowFamilyDialog(false)}>{t("common.cancel")}</Button><Button onClick={addFamilyHistory} disabled={saving}>{t("common.save")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSideEffectDialog} onOpenChange={setShowSideEffectDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("hp.log_side_effect")}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2"><Label>{t("hp.treatment_name")}</Label><Input value={sideEffectForm.treatmentName} onChange={e => setSideEffectForm(f => ({ ...f, treatmentName: e.target.value }))} /></div>
            <div className="space-y-2"><Label>{t("hp.symptom")}</Label><Textarea value={sideEffectForm.symptom} onChange={e => setSideEffectForm(f => ({ ...f, symptom: e.target.value }))} placeholder={t("hp.symptom_placeholder")} rows={3} /></div>
            <div className="space-y-2"><Label>{t("hp.occurred_at")}</Label><Input type="date" value={sideEffectForm.occurredAt} onChange={e => setSideEffectForm(f => ({ ...f, occurredAt: e.target.value }))} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowSideEffectDialog(false)}>{t("common.cancel")}</Button><Button onClick={addSideEffect} disabled={saving}>{t("common.save")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showVitalDialog} onOpenChange={setShowVitalDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("hp.log_vital")}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>{t("hp.vitals_biometrics")}</Label>
              <Select value={vitalForm.type} onValueChange={v => { const u = VITAL_TABS.find(vt => vt.key === v)?.unit ?? ""; setVitalForm(f => ({ ...f, type: v, unit: u })); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VITAL_TABS.map(vt => <SelectItem key={vt.key} value={vt.key}>{vt.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Value</Label><Input value={vitalForm.value} onChange={e => setVitalForm(f => ({ ...f, value: e.target.value }))} placeholder={vitalForm.type === "blood_pressure" ? "120/80" : "0"} /></div>
              <div className="space-y-2"><Label>Unit</Label><Input value={vitalForm.unit} onChange={e => setVitalForm(f => ({ ...f, unit: e.target.value }))} /></div>
            </div>
            <div className="space-y-2"><Label>{t("hp.recorded_on")}</Label><Input type="date" value={vitalForm.recordedAt} onChange={e => setVitalForm(f => ({ ...f, recordedAt: e.target.value }))} /></div>
            <div className="space-y-2"><Label>{t("records.notes")} ({t("common.optional")})</Label><Input value={vitalForm.notes} onChange={e => setVitalForm(f => ({ ...f, notes: e.target.value }))} placeholder={t("hp.vital_notes_placeholder")} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowVitalDialog(false)}>{t("common.cancel")}</Button><Button onClick={addVital} disabled={saving}>{t("common.save")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
