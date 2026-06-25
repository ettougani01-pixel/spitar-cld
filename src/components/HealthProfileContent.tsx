import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertTriangle, Pill, Users, Activity, Plus, Trash2, Zap, FileText,
  ChevronDown, ChevronUp, Upload, ShieldAlert, Phone, PhoneCall,
  Syringe, CalendarCheck, Link2, FileDown, Copy, Check, Bell, BellOff, X,
  Stethoscope, ClipboardList,
} from "lucide-react";
import { VitalsChart } from "@/components/VitalsChart";
import { ChronicTracker } from "@/components/ChronicTracker";
import { IncidentLog } from "@/components/IncidentLog";
import type { ChronicCondition } from "@/lib/types";

const CHRONIC_CONDITIONS: { key: ChronicCondition; label: string; labelAr: string; color: string; bg: string }[] = [
  { key: "cancer",         label: "Cancer",          labelAr: "السرطان",           color: "#dc2626", bg: "#fee2e2" },
  { key: "hiv",            label: "HIV/AIDS",        labelAr: "فيروس نقص المناعة", color: "#db2777", bg: "#fce7f3" },
  { key: "tuberculosis",   label: "Tuberculosis",    labelAr: "السل",              color: "#d97706", bg: "#fef3c7" },
  { key: "heart_disease",  label: "Heart Disease",   labelAr: "أمراض القلب",       color: "#e11d48", bg: "#ffe4e6" },
  { key: "kidney_disease", label: "Kidney Disease",  labelAr: "أمراض الكلى",       color: "#0891b2", bg: "#ecfeff" },
  { key: "liver_disease",  label: "Liver Disease",   labelAr: "أمراض الكبد",       color: "#b45309", bg: "#fef9c3" },
  { key: "epilepsy",       label: "Epilepsy",        labelAr: "الصرع",             color: "#7c3aed", bg: "#ede9fe" },
  { key: "diabetes",       label: "Diabetes",        labelAr: "السكري",            color: "#ea580c", bg: "#fff7ed" },
  { key: "hypertension",   label: "Hypertension",    labelAr: "ضغط الدم",          color: "#2563eb", bg: "#eff6ff" },
  { key: "thyroid",        label: "Thyroid Disorder",labelAr: "الغدة الدرقية",     color: "#0d9488", bg: "#f0fdfa" },
];

const CANCER_TYPES = [
  { key: "breast_cancer",     labelAr: "سرطان الثدي" },
  { key: "lung_cancer",       labelAr: "سرطان الرئة" },
  { key: "prostate_cancer",   labelAr: "سرطان البروستاتا" },
  { key: "colorectal_cancer", labelAr: "سرطان القولون والمستقيم" },
  { key: "leukemia",          labelAr: "سرطان الدم (اللوكيميا)" },
  { key: "lymphoma",          labelAr: "سرطان الغدد الليمفاوية" },
  { key: "liver_cancer",      labelAr: "سرطان الكبد" },
  { key: "cervical_cancer",   labelAr: "سرطان عنق الرحم" },
  { key: "brain_cancer",      labelAr: "سرطان الدماغ" },
  { key: "stomach_cancer",    labelAr: "سرطان المعدة" },
  { key: "pancreatic_cancer", labelAr: "سرطان البنكرياس" },
  { key: "skin_cancer",       labelAr: "سرطان الجلد" },
  { key: "kidney_cancer",     labelAr: "سرطان الكلى" },
  { key: "thyroid_cancer",    labelAr: "سرطان الغدة الدرقية" },
  { key: "bladder_cancer",    labelAr: "سرطان المثانة" },
  { key: "bone_cancer",       labelAr: "سرطان العظام" },
  { key: "ovarian_cancer",    labelAr: "سرطان المبيض" },
  { key: "uterine_cancer",    labelAr: "سرطان الرحم" },
  { key: "other_cancer",      labelAr: "نوع آخر من السرطان" },
];

// Drug interaction pairs (key1 + key2 → warning)
const DRUG_INTERACTIONS: { a: string; b: string; warning: string }[] = [
  { a: "warfarin",    b: "aspirin",     warning: "خطر نزيف شديد — راجع طبيبك" },
  { a: "metformin",   b: "ibuprofen",   warning: "قد يضعف التحكم في السكر" },
  { a: "lisinopril",  b: "potassium",   warning: "خطر ارتفاع البوتاسيوم" },
  { a: "simvastatin", b: "amiodarone",  warning: "خطر آلام العضلات الشديدة" },
];

interface Allergy { id: string; allergenName: string; type: string; severity: string; reaction: string; }
interface Medication { id: string; name: string; type: string; dosage: string; frequency: string; startDate: string; notes?: string; reminderTime?: string; }
interface FamilyHistory { id: string; relation: string; condition: string; detail: string; }
interface SideEffect { id: string; treatmentName: string; symptom: string; occurredAt: string; }
interface Vital { id: string; type: string; value: string; unit: string; notes?: string; recordedAt: string; }
interface PatientDocument { id: string; docType: string; docDate: string; notes: string; url?: string; fileName?: string; fileBase64?: string; fileType?: string; }
interface Vaccination { id: string; vaccineName: string; vaccinedAt: string; nextDoseAt?: string; provider?: string; }
interface MedicalVisit { id: string; doctorName: string; specialty?: string; visitDate: string; diagnosis?: string; treatment?: string; notes?: string; }

type SeverityLevel = "mild" | "moderate" | "severe" | "life_threatening";
const SEVERITY_COLORS: Record<SeverityLevel, { bg: string; color: string }> = {
  mild:             { bg: "#dcfce7", color: "#16a34a" },
  moderate:         { bg: "#fef9c3", color: "#ca8a04" },
  severe:           { bg: "#fed7aa", color: "#ea580c" },
  life_threatening: { bg: "#fecaca", color: "#dc2626" },
};

const VITAL_TABS = [
  { key: "blood_pressure", label: "Blood Pressure", unit: "mmHg" },
  { key: "blood_sugar",    label: "Blood Sugar",    unit: "mg/dL" },
  { key: "weight",         label: "Weight / BMI",   unit: "kg" },
  { key: "heart_rate",     label: "Heart Rate",     unit: "bpm" },
  { key: "sleep",          label: "Sleep",          unit: "hours" },
];

function SectionCard({ title, icon: Icon, iconColor, iconBg, children, addLabel, onAdd, defaultOpen = true }: {
  title: string; icon: any; iconColor: string; iconBg: string;
  children: React.ReactNode; addLabel: string; onAdd: () => void; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, marginBottom: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      <div onClick={() => setOpen(v => !v)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", cursor: "pointer", borderBottom: open ? "1px solid #f3f4f6" : "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: iconBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon size={15} style={{ color: iconColor }} />
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{title}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {addLabel && (
            <button onClick={e => { e.stopPropagation(); onAdd(); }}
              style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, color: "#2563eb", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>
              <Plus size={12} /> {addLabel}
            </button>
          )}
          {open ? <ChevronUp size={16} style={{ color: "#9ca3af" }} /> : <ChevronDown size={16} style={{ color: "#9ca3af" }} />}
        </div>
      </div>
      {open && <div style={{ padding: "12px 16px" }}>{children}</div>}
    </div>
  );
}

export function HealthProfileContent({ patientId: patientIdProp, readOnly = false, hideDocumentsAndIncidents = false, hideVitals = false }: { patientId?: string; readOnly?: boolean; hideDocumentsAndIncidents?: boolean; hideVitals?: boolean } = {}) {
  const { t } = useTranslation();
  const { user } = useAuth();

  // ── existing state ──
  const [allergies,      setAllergies]      = useState<Allergy[]>([]);
  const [medications,    setMedications]    = useState<Medication[]>([]);
  const [familyHistory,  setFamilyHistory]  = useState<FamilyHistory[]>([]);
  const [sideEffects,    setSideEffects]    = useState<SideEffect[]>([]);
  const [vitals,         setVitals]         = useState<Vital[]>([]);
  const [documents,      setDocuments]      = useState<PatientDocument[]>([]);
  const [activeVitalTab, setActiveVitalTab] = useState("blood_pressure");
  const [loading,        setLoading]        = useState(true);
  const [userProfileData,setUserProfileData]= useState<Record<string, any>>({});
  const [chronicConditions, setChronicConditions] = useState<ChronicCondition[]>([]);
  const [cancerTypes,    setCancerTypes]    = useState<string[]>([]);
  const [savingConditions, setSavingConditions] = useState(false);
  const [conditionsOpen, setConditionsOpen] = useState(false);
  const conditionsRef = useRef<HTMLDivElement>(null);

  // ── new state ──
  const [vaccinations,   setVaccinations]   = useState<Vaccination[]>([]);
  const [visits,         setVisits]         = useState<MedicalVisit[]>([]);
  const [showSosModal,   setShowSosModal]   = useState(false);
  const [shareLink,      setShareLink]      = useState<string | null>(null);
  const [linkCopied,     setLinkCopied]     = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [showSharePanel, setShowSharePanel] = useState(false);
  const [showVaccDialog, setShowVaccDialog] = useState(false);
  const [showVisitDialog,setShowVisitDialog]= useState(false);
  const [vaccForm,       setVaccForm]       = useState({ vaccineName: "", vaccinedAt: "", nextDoseAt: "", provider: "" });
  const [visitForm,      setVisitForm]      = useState({ doctorName: "", specialty: "", visitDate: new Date().toISOString().split("T")[0], diagnosis: "", treatment: "", notes: "" });
  const [medReminders,   setMedReminders]   = useState<Record<string, string>>({}); // medId → time "HH:MM"

  // ── dialog state ──
  const [showAllergyDialog,    setShowAllergyDialog]    = useState(false);
  const [showMedDialog,        setShowMedDialog]        = useState(false);
  const [showFamilyDialog,     setShowFamilyDialog]     = useState(false);
  const [showSideEffectDialog, setShowSideEffectDialog] = useState(false);
  const [showVitalDialog,      setShowVitalDialog]      = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [saving2, setSaving2] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [allergyForm,    setAllergyForm]    = useState({ allergenName: "", type: "medication", severity: "mild", reaction: "" });
  const [medForm,        setMedForm]        = useState({ name: "", type: "prescription_med", dosage: "", frequency: "", startDate: "", notes: "" });
  const [familyForm,     setFamilyForm]     = useState({ relation: "parent", condition: "diabetes", detail: "" });
  const [sideEffectForm, setSideEffectForm] = useState({ treatmentName: "", symptom: "", occurredAt: "" });
  const [vitalForm,      setVitalForm]      = useState({ type: "blood_pressure", value: "", unit: "mmHg", notes: "", recordedAt: new Date().toISOString().split("T")[0] });
  const [docForm,        setDocForm]        = useState({ docType: "lab_result", docDate: new Date().toISOString().split("T")[0], notes: "" });

  // click-outside for conditions dropdown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (conditionsRef.current && !conditionsRef.current.contains(e.target as Node)) setConditionsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // load reminders from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("med_reminders");
      if (saved) setMedReminders(JSON.parse(saved));
    } catch {}
  }, []);

  // check due reminders every minute
  useEffect(() => {
    if (medications.length === 0) return;
    const check = () => {
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
      medications.forEach(m => {
        const t = medReminders[m.id];
        if (t && t === hhmm && Notification.permission === "granted") {
          new Notification("تذكير: دواء", { body: `حان وقت تناول ${m.name} — ${m.dosage}`, icon: "/favicon.ico" });
        }
      });
    };
    check();
    const interval = setInterval(check, 60_000);
    return () => clearInterval(interval);
  }, [medications, medReminders]);

  // main data load
  useEffect(() => {
    const uid = patientIdProp ?? user?.uid;
    if (!uid) return;
    async function load() {
      setLoading(true);
      try {
        const [aRes, mRes, fRes, seRes, vRes, dRes, uRes, vacRes, visRes] = await Promise.allSettled([
          getDocs(query(collection(db, "patient_allergies"),     where("patientId", "==", uid))),
          getDocs(query(collection(db, "patient_medications"),   where("patientId", "==", uid))),
          getDocs(query(collection(db, "patient_family_history"),where("patientId", "==", uid))),
          getDocs(query(collection(db, "patient_side_effects"),  where("patientId", "==", uid))),
          getDocs(query(collection(db, "patient_vitals"),        where("patientId", "==", uid))),
          getDocs(query(collection(db, "patient_documents"),     where("patientId", "==", uid))),
          getDoc(doc(db, "users", uid!)),
          getDocs(query(collection(db, "patient_vaccinations"),  where("patientId", "==", uid))),
          getDocs(query(collection(db, "patient_visits"),        where("patientId", "==", uid))),
        ]);
        if (aRes.status === "fulfilled") setAllergies(aRes.value.docs.map(d => ({ id: d.id, ...d.data() } as Allergy)));
        if (mRes.status === "fulfilled") setMedications(mRes.value.docs.map(d => ({ id: d.id, ...d.data() } as Medication)));
        if (fRes.status === "fulfilled") setFamilyHistory(fRes.value.docs.map(d => ({ id: d.id, ...d.data() } as FamilyHistory)));
        if (seRes.status === "fulfilled") setSideEffects(seRes.value.docs.map(d => ({ id: d.id, ...d.data() } as SideEffect)));
        if (vRes.status === "fulfilled") setVitals(vRes.value.docs.map(d => ({ id: d.id, ...d.data() } as Vital)).sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)));
        if (dRes.status === "fulfilled") setDocuments(dRes.value.docs.map(d => ({ id: d.id, ...d.data() } as PatientDocument)).sort((a, b) => b.docDate.localeCompare(a.docDate)));
        if (uRes.status === "fulfilled" && uRes.value.exists()) {
          const data = uRes.value.data();
          setUserProfileData(data);
          setChronicConditions((data.chronicConditions ?? []) as ChronicCondition[]);
          setCancerTypes((data.cancerTypes ?? []) as string[]);
        }
        if (vacRes.status === "fulfilled") setVaccinations(vacRes.value.docs.map(d => ({ id: d.id, ...d.data() } as Vaccination)).sort((a, b) => b.vaccinedAt.localeCompare(a.vaccinedAt)));
        if (visRes.status === "fulfilled") setVisits(visRes.value.docs.map(d => ({ id: d.id, ...d.data() } as MedicalVisit)).sort((a, b) => b.visitDate.localeCompare(a.visitDate)));
      } catch (err) {
        console.error("HealthProfile load error:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user, patientIdProp]);

  // ── helpers ──
  const deleteItem = async (col: string, id: string, setter: React.Dispatch<React.SetStateAction<any[]>>) => {
    await deleteDoc(doc(db, col, id));
    setter(p => p.filter(x => x.id !== id));
  };

  const toggleCondition = async (key: ChronicCondition) => {
    const uid = patientIdProp ?? user?.uid;
    if (!uid || readOnly) return;
    setSavingConditions(true);
    const updated = chronicConditions.includes(key) ? chronicConditions.filter(c => c !== key) : [...chronicConditions, key];
    try { await updateDoc(doc(db, "users", uid), { chronicConditions: updated }); setChronicConditions(updated); }
    finally { setSavingConditions(false); }
  };

  const toggleCancerType = async (key: string) => {
    const uid = patientIdProp ?? user?.uid;
    if (!uid || readOnly) return;
    setSavingConditions(true);
    const updated = cancerTypes.includes(key) ? cancerTypes.filter(c => c !== key) : [...cancerTypes, key];
    try { await updateDoc(doc(db, "users", uid), { cancerTypes: updated }); setCancerTypes(updated); }
    finally { setSavingConditions(false); }
  };

  const togglePregnancy = async () => {
    const uid = patientIdProp ?? user?.uid;
    if (!uid || readOnly) return;
    setSavingConditions(true);
    const isPregnant = chronicConditions.includes("pregnancy");
    const updated = isPregnant ? chronicConditions.filter(c => c !== "pregnancy") : [...chronicConditions, "pregnancy"];
    try { await updateDoc(doc(db, "users", uid), { chronicConditions: updated }); setChronicConditions(updated); }
    finally { setSavingConditions(false); }
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

  const addVaccination = async () => {
    const uid = patientIdProp ?? user?.uid;
    if (!uid || !vaccForm.vaccineName) return;
    setSaving(true);
    try {
      const ref2 = await addDoc(collection(db, "patient_vaccinations"), { ...vaccForm, patientId: uid, createdAt: new Date().toISOString() });
      setVaccinations(p => [{ id: ref2.id, ...vaccForm }, ...p]);
      setShowVaccDialog(false);
      setVaccForm({ vaccineName: "", vaccinedAt: "", nextDoseAt: "", provider: "" });
    } finally { setSaving(false); }
  };

  const addVisit = async () => {
    const uid = patientIdProp ?? user?.uid;
    if (!uid || !visitForm.doctorName) return;
    setSaving(true);
    try {
      const ref2 = await addDoc(collection(db, "patient_visits"), { ...visitForm, patientId: uid, createdAt: new Date().toISOString() });
      setVisits(p => [{ id: ref2.id, ...visitForm }, ...p]);
      setShowVisitDialog(false);
      setVisitForm({ doctorName: "", specialty: "", visitDate: new Date().toISOString().split("T")[0], diagnosis: "", treatment: "", notes: "" });
    } finally { setSaving(false); }
  };

  const saveDocument = async (file?: File) => {
    if (!user) return;
    setSaving2(true); setUploadError(null);
    try {
      let fileData: { fileName?: string; url?: string } = {};
      if (file) {
        const cloudName   = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
        const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", uploadPreset);
        formData.append("folder", "spitar_docs");
        const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, { method: "POST", body: formData });
        if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
        const json = await res.json();
        fileData = { fileName: file.name, url: json.secure_url };
      }
      const docData = { ...docForm, ...fileData, patientId: user.uid, createdAt: new Date().toISOString() };
      const docRef  = await addDoc(collection(db, "patient_documents"), docData);
      setDocuments(p => [{ id: docRef.id, ...docData } as PatientDocument, ...p]);
      setDocForm({ docType: "lab_result", docDate: new Date().toISOString().split("T")[0], notes: "" });
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: any) {
      setUploadError(err?.message ?? "Error saving document");
    } finally { setSaving2(false); }
  };

  // ── share link (48h) ──
  const generateShareLink = async () => {
    const uid = patientIdProp ?? user?.uid;
    if (!uid) return;
    setGeneratingLink(true);
    try {
      const expiresAt = Date.now() + 48 * 60 * 60 * 1000;
      const ref2 = await addDoc(collection(db, "emergency_cards"), {
        patientId: uid, expiresAt, createdAt: new Date().toISOString(), type: "doctor_share",
      });
      setShareLink(`${window.location.origin}/emergency/${ref2.id}`);
    } finally { setGeneratingLink(false); }
  };

  const copyLink = async () => {
    if (!shareLink) return;
    await navigator.clipboard.writeText(shareLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  // ── medication reminder toggle ──
  const toggleReminder = async (medId: string) => {
    if (Notification.permission === "default") await Notification.requestPermission();
    if (Notification.permission !== "granted") {
      alert("يرجى السماح بالإشعارات من إعدادات المتصفح");
      return;
    }
    setMedReminders(prev => {
      const updated = { ...prev };
      if (updated[medId]) {
        delete updated[medId];
      } else {
        const time = prompt("أدخل وقت التذكير (مثال: 08:00):", "08:00");
        if (!time) return prev;
        updated[medId] = time;
      }
      localStorage.setItem("med_reminders", JSON.stringify(updated));
      return updated;
    });
  };

  // ── PDF export ──
  const exportPdf = () => window.print();

  // ── drug interaction check ──
  const interactionWarnings = (() => {
    const names = medications.map(m => m.name.toLowerCase());
    return DRUG_INTERACTIONS.filter(i =>
      names.some(n => n.includes(i.a)) && names.some(n => n.includes(i.b))
    );
  })();

  const isFemale = (userProfileData.gender ?? "").toLowerCase() === "female";
  const emergencyContacts: { name: string; phone: string; relation?: string }[] = [
    ...(userProfileData.emergencyContacts ?? []),
    ...(userProfileData.emergencyContactPhone
      ? [{ name: userProfileData.emergencyContactName ?? "", phone: userProfileData.emergencyContactPhone, relation: "Other" }]
      : []),
  ].filter(c => c.phone);

  // ── completion tracking ──
  const u = userProfileData;
  const completionFields = [
    { labelAr: "الاسم الكامل",         done: !!(u.firstName && u.lastName) },
    { labelAr: "البريد الإلكتروني",    done: !!(u.email) },
    { labelAr: "رقم الهاتف",          done: !!(u.phone) },
    { labelAr: "المدينة",              done: !!(u.city) },
    { labelAr: "تاريخ الميلاد",        done: !!(u.dateOfBirth) },
    { labelAr: "فصيلة الدم",          done: !!(u.bloodType) },
    { labelAr: "الجنس",               done: !!(u.gender) },
    { labelAr: "العنوان",              done: !!(u.address) },
    { labelAr: "جهة الاتصال للطوارئ", done: emergencyContacts.length > 0 },
    { labelAr: "الحساسيات",            done: allergies.length > 0 },
    { labelAr: "الأدوية والمكملات",    done: medications.length > 0 },
    { labelAr: "التاريخ العائلي",      done: familyHistory.length > 0 },
    { labelAr: "الآثار الجانبية",      done: sideEffects.length > 0 },
    { labelAr: "الأمراض المزمنة",      done: chronicConditions.filter(c => c !== "pregnancy").length > 0 },
    { labelAr: "التطعيمات",            done: vaccinations.length > 0 },
    { labelAr: "الزيارات الطبية",      done: visits.length > 0 },
    ...(isFemale ? [{ labelAr: "الحمل", done: chronicConditions.includes("pregnancy") }] : []),
  ];
  const completeness = Math.round((completionFields.filter(f => f.done).length / completionFields.length) * 100);
  const hasCritical = allergies.some(a => a.severity === "life_threatening" || a.severity === "severe");
  const vitalsByType = (type: string) => vitals.filter(v => v.type === type);

  if (loading) return <div style={{ textAlign: "center", padding: 40, color: "#9ca3af", fontSize: 13 }}>Loading...</div>;

  return (
    <div>
      {/* ── print styles ── */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { font-size: 12px; }
        }
      `}</style>

      {/* ── SOS Modal ── */}
      {showSosModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 18, maxWidth: 400, width: "100%", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <div style={{ background: "linear-gradient(135deg, #dc2626, #b91c1c)", padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <PhoneCall size={22} style={{ color: "#fff" }} />
                <div>
                  <p style={{ color: "#fff", fontWeight: 800, fontSize: 16, margin: 0 }}>🆘 طوارئ</p>
                  <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, margin: 0 }}>{u.firstName} {u.lastName} · {u.bloodType || "—"}</p>
                </div>
              </div>
              <button onClick={() => setShowSosModal(false)} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 8, padding: 6, cursor: "pointer" }}>
                <X size={18} style={{ color: "#fff" }} />
              </button>
            </div>
            <div style={{ padding: "16px 20px" }}>
              {emergencyContacts.length === 0 ? (
                <p style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", padding: "16px 0" }}>لا توجد جهات طوارئ مسجلة — أضفها في الملف الشخصي</p>
              ) : (
                emergencyContacts.map((c, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: i < emergencyContacts.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", margin: 0 }}>{c.name || "—"}</p>
                      {c.relation && <p style={{ fontSize: 11, color: "#94a3b8", margin: 0 }}>{c.relation}</p>}
                    </div>
                    <a href={`tel:${c.phone}`} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "#fff", background: "#dc2626", textDecoration: "none", padding: "8px 14px", borderRadius: 8 }}>
                      <Phone size={14} /> {c.phone}
                    </a>
                  </div>
                ))
              )}
              {u.phone && (
                <div style={{ marginTop: 12, padding: "10px 14px", background: "#f8fafc", borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>هاتف المريض</p>
                  <a href={`tel:${u.phone}`} style={{ fontSize: 13, fontWeight: 700, color: "#2563eb", textDecoration: "none" }}>{u.phone}</a>
                </div>
              )}
              {/* Chronic conditions summary */}
              {chronicConditions.filter(c => c !== "pregnancy").length > 0 && (
                <div style={{ marginTop: 10, padding: "10px 14px", background: "#fef2f2", borderRadius: 10, border: "1px solid #fecaca" }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#dc2626", margin: "0 0 4px" }}>أمراض مزمنة:</p>
                  <p style={{ fontSize: 13, color: "#0f172a", margin: 0 }}>
                    {chronicConditions.filter(c => c !== "pregnancy").map(k => {
                      const c = CHRONIC_CONDITIONS.find(x => x.key === k);
                      return c ? c.labelAr : k;
                    }).join("، ")}
                  </p>
                </div>
              )}
              {/* Life-threatening allergies */}
              {allergies.filter(a => a.severity === "life_threatening").length > 0 && (
                <div style={{ marginTop: 10, padding: "10px 14px", background: "#fef2f2", borderRadius: 10, border: "1px solid #fca5a5" }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#dc2626", margin: "0 0 4px" }}>⚠️ حساسية خطيرة:</p>
                  {allergies.filter(a => a.severity === "life_threatening").map(a => (
                    <p key={a.id} style={{ fontSize: 13, color: "#0f172a", margin: "2px 0 0", fontWeight: 600 }}>{a.allergenName}</p>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Critical allergy alert ── */}
      {hasCritical && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={15} style={{ color: "#dc2626", flexShrink: 0 }} />
          <p style={{ fontSize: 12, fontWeight: 600, color: "#dc2626", margin: 0 }}>{t("hp.high_alert_warning")}</p>
        </div>
      )}

      {/* ── Drug interaction warnings ── */}
      {interactionWarnings.length > 0 && (
        <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, padding: "10px 14px", marginBottom: 12 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#92400e", margin: "0 0 4px" }}>⚠️ تفاعل محتمل بين الأدوية</p>
          {interactionWarnings.map((w, i) => (
            <p key={i} style={{ fontSize: 12, color: "#78350f", margin: "2px 0 0" }}>• {w.warning}</p>
          ))}
        </div>
      )}

      {/* ── Profile Completeness ── */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "14px 16px", marginBottom: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>اكتمال البروفايل</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: completeness === 100 ? "#16a34a" : "#dc2626" }}>{completeness}%</span>
        </div>
        <div style={{ height: 7, background: "#f3f4f6", borderRadius: 99, overflow: "hidden", marginBottom: 12 }}>
          <div style={{ height: "100%", width: `${completeness}%`, background: completeness === 100 ? "#16a34a" : "#ef4444", borderRadius: 99, transition: "width 0.5s" }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px 16px" }}>
          {completionFields.map(({ labelAr, done }) => (
            <div key={labelAr} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: done ? "#16a34a" : "#9ca3af" }}>
              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 16, height: 16, borderRadius: "50%", background: done ? "#dcfce7" : "#f3f4f6", color: done ? "#16a34a" : "#9ca3af", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{done ? "✓" : "○"}</span>
              <span style={{ direction: "rtl", textAlign: "right" }}>{labelAr}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Action bar: SOS / Share / PDF ── */}
      {!readOnly && (
        <div className="no-print" style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {/* SOS */}
          <button onClick={() => setShowSosModal(true)}
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, height: 42, borderRadius: 10, border: "2px solid #fca5a5", background: "#fef2f2", color: "#dc2626", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            <PhoneCall size={16} /> SOS
          </button>
          {/* Share link */}
          <button onClick={() => setShowSharePanel(v => !v)}
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, height: 42, borderRadius: 10, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#2563eb", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            <Link2 size={16} /> مشاركة
          </button>
          {/* PDF */}
          <button onClick={exportPdf}
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, height: 42, borderRadius: 10, border: "1px solid #d1d5db", background: "#f9fafb", color: "#374151", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            <FileDown size={16} /> PDF
          </button>
        </div>
      )}

      {/* ── Share panel ── */}
      {showSharePanel && !readOnly && (
        <div className="no-print" style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 10, padding: "14px 16px", marginBottom: 12 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#0369a1", margin: "0 0 10px" }}>🔗 رابط مؤقت للطبيب (صالح 48 ساعة)</p>
          {shareLink ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input readOnly value={shareLink} style={{ flex: 1, fontSize: 11, padding: "6px 10px", border: "1px solid #bae6fd", borderRadius: 6, background: "#fff", color: "#0369a1", direction: "ltr" }} />
              <button onClick={copyLink} style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 12px", background: linkCopied ? "#dcfce7" : "#2563eb", color: linkCopied ? "#16a34a" : "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                {linkCopied ? <Check size={14} /> : <Copy size={14} />} {linkCopied ? "تم" : "نسخ"}
              </button>
            </div>
          ) : (
            <button onClick={generateShareLink} disabled={generatingLink}
              style={{ width: "100%", padding: "8px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, cursor: generatingLink ? "wait" : "pointer", fontSize: 13, fontWeight: 600, opacity: generatingLink ? 0.7 : 1 }}>
              {generatingLink ? "جارٍ الإنشاء..." : "إنشاء رابط"}
            </button>
          )}
          <p style={{ fontSize: 11, color: "#64748b", margin: "8px 0 0" }}>أرسل هذا الرابط للطبيب — يفتح ملفك الطبي كاملاً للقراءة فقط ولمدة 48 ساعة</p>
        </div>
      )}

      {/* ── Chronic Conditions ── */}
      {!readOnly && (
        <div ref={conditionsRef} style={{ marginBottom: 12, position: "relative" }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: "#374151", display: "block", marginBottom: 6 }}>الأمراض المزمنة</label>
          <button type="button" onClick={() => setConditionsOpen(o => !o)}
            style={{ width: "100%", height: 40, padding: "0 12px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, cursor: "pointer", fontSize: 14, color: chronicConditions.length === 0 ? "#9ca3af" : "#0f172a", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
            <ChevronDown size={16} style={{ color: "#64748b", flexShrink: 0, transform: conditionsOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, textAlign: "right", direction: "rtl" }}>
              {chronicConditions.length === 0 ? "اختر..." : chronicConditions.map(k => {
                const c = CHRONIC_CONDITIONS.find(x => x.key === k);
                return c ? c.labelAr : k === "pregnancy" ? "الحمل" : k;
              }).join("، ")}
            </span>
          </button>

          {conditionsOpen && (
            <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 50, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", maxHeight: 320, overflowY: "auto" }}>
              <button type="button"
                onClick={async () => {
                  const uid = patientIdProp ?? user?.uid;
                  if (!uid || savingConditions) return;
                  setSavingConditions(true);
                  try { await updateDoc(doc(db, "users", uid), { chronicConditions: [], cancerTypes: [] }); setChronicConditions([]); setCancerTypes([]); }
                  finally { setSavingConditions(false); }
                }}
                style={{ width: "100%", padding: "8px 32px 8px 8px", display: "flex", alignItems: "center", justifyContent: "flex-end", background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#0f172a", position: "relative", borderRadius: 4 }}
                onMouseEnter={e => (e.currentTarget.style.background = "#f1f5f9")}
                onMouseLeave={e => (e.currentTarget.style.background = "none")}>
                {chronicConditions.length === 0 && <span style={{ position: "absolute", left: 8, color: "#2563eb", fontSize: 14, fontWeight: 700 }}>✓</span>}
                لا أعاني من أي أمراض مزمنة
              </button>
              {CHRONIC_CONDITIONS.map(({ key, labelAr }) => {
                const active = chronicConditions.includes(key);
                return (
                  <div key={key}>
                    <button type="button" onClick={() => toggleCondition(key)} disabled={savingConditions}
                      style={{ width: "100%", padding: "8px 32px 8px 8px", display: "flex", alignItems: "center", justifyContent: "flex-end", background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#0f172a", position: "relative", borderRadius: 4 }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#f1f5f9")}
                      onMouseLeave={e => (e.currentTarget.style.background = "none")}>
                      {active && <span style={{ position: "absolute", left: 8, color: "#2563eb", fontSize: 14, fontWeight: 700 }}>✓</span>}
                      {labelAr}
                    </button>
                    {key === "cancer" && active && (
                      <div style={{ background: "#fafafa", borderTop: "1px solid #f1f5f9", borderBottom: "1px solid #f1f5f9" }}>
                        <p style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", margin: 0, padding: "6px 32px 4px 8px", textAlign: "right" }}>نوع السرطان:</p>
                        {CANCER_TYPES.map(({ key: ck, labelAr: cAr }) => {
                          const cActive = cancerTypes.includes(ck);
                          return (
                            <button key={ck} type="button" onClick={() => toggleCancerType(ck)} disabled={savingConditions}
                              style={{ width: "100%", padding: "6px 48px 6px 8px", display: "flex", justifyContent: "flex-end", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#374151", position: "relative", borderRadius: 4 }}
                              onMouseEnter={e => (e.currentTarget.style.background = "#f1f5f9")}
                              onMouseLeave={e => (e.currentTarget.style.background = "none")}>
                              {cActive && <span style={{ position: "absolute", left: 8, color: "#2563eb", fontSize: 13, fontWeight: 700 }}>✓</span>}
                              {cAr}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
              {isFemale && (
                <button type="button" onClick={togglePregnancy} disabled={savingConditions}
                  style={{ width: "100%", padding: "8px 32px 8px 8px", display: "flex", alignItems: "center", justifyContent: "flex-end", background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#0f172a", position: "relative", borderRadius: 4 }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#f1f5f9")}
                  onMouseLeave={e => (e.currentTarget.style.background = "none")}>
                  {chronicConditions.includes("pregnancy") && <span style={{ position: "absolute", left: 8, color: "#2563eb", fontSize: 14, fontWeight: 700 }}>✓</span>}
                  الحمل
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Allergies ── */}
      <SectionCard title={t("hp.allergies")} icon={AlertTriangle} iconColor="#dc2626" iconBg="#fef2f2" addLabel={readOnly ? "" : t("hp.add_allergy")} onAdd={() => !readOnly && setShowAllergyDialog(true)}>
        {allergies.length === 0 ? (
          <p style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", padding: "16px 0" }}>{t("hp.no_allergies")}</p>
        ) : allergies.map(a => {
          const sev = SEVERITY_COLORS[a.severity as SeverityLevel] || { bg: "#f3f4f6", color: "#6b7280" };
          return (
            <div key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f3f4f6" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: sev.bg, color: sev.color }}>{t(`hp.${a.severity}`)}</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{a.allergenName}</span>
                {a.reaction && <span style={{ fontSize: 12, color: "#6b7280" }}>· {a.reaction}</span>}
              </div>
              {!readOnly && <button onClick={() => deleteItem("patient_allergies", a.id, setAllergies)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", padding: 4 }}><Trash2 size={14} /></button>}
            </div>
          );
        })}
      </SectionCard>

      {/* ── Medications ── */}
      <SectionCard title={t("hp.medications")} icon={Pill} iconColor="#7c3aed" iconBg="#f5f3ff" addLabel={readOnly ? "" : t("hp.add_medication")} onAdd={() => !readOnly && setShowMedDialog(true)}>
        {medications.length === 0 ? (
          <p style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", padding: "16px 0" }}>{t("hp.no_medications")}</p>
        ) : medications.map(m => (
          <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f3f4f6" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, background: "#f3f4f6", color: "#6b7280", padding: "2px 8px", borderRadius: 20 }}>{m.type.replace(/_/g, " ")}</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{m.name}</span>
              </div>
              <p style={{ fontSize: 11, color: "#9ca3af", margin: "2px 0 0" }}>{m.dosage} · {m.frequency}</p>
              {medReminders[m.id] && <p style={{ fontSize: 10, color: "#2563eb", margin: "2px 0 0" }}>🔔 {medReminders[m.id]}</p>}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {!readOnly && (
                <button onClick={() => toggleReminder(m.id)}
                  title={medReminders[m.id] ? "إلغاء التذكير" : "تفعيل التذكير"}
                  style={{ background: "none", border: "none", cursor: "pointer", color: medReminders[m.id] ? "#2563eb" : "#9ca3af", padding: 4 }}>
                  {medReminders[m.id] ? <Bell size={14} /> : <BellOff size={14} />}
                </button>
              )}
              {!readOnly && <button onClick={() => deleteItem("patient_medications", m.id, setMedications)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", padding: 4 }}><Trash2 size={14} /></button>}
            </div>
          </div>
        ))}
      </SectionCard>

      {/* ── Family History ── */}
      <SectionCard title={t("hp.family_history")} icon={Users} iconColor="#0891b2" iconBg="#ecfeff" addLabel={readOnly ? "" : t("hp.add_family_entry")} onAdd={() => !readOnly && setShowFamilyDialog(true)}>
        {familyHistory.length === 0 ? (
          <p style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", padding: "16px 0" }}>{t("hp.no_family_history")}</p>
        ) : familyHistory.map(f => (
          <div key={f.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f3f4f6" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, background: "#f3f4f6", color: "#6b7280", padding: "2px 8px", borderRadius: 20 }}>{t(`hp.${f.relation}`)}</span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{t(`hp.${f.condition}`) || f.condition}</span>
              {f.detail && <span style={{ fontSize: 12, color: "#6b7280" }}>· {f.detail}</span>}
            </div>
            {!readOnly && <button onClick={() => deleteItem("patient_family_history", f.id, setFamilyHistory)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", padding: 4 }}><Trash2 size={14} /></button>}
          </div>
        ))}
      </SectionCard>

      {/* ── Side Effects ── */}
      <SectionCard title={t("hp.side_effects_journal")} icon={Zap} iconColor="#d97706" iconBg="#fffbeb" addLabel={readOnly ? "" : t("hp.log_side_effect")} onAdd={() => !readOnly && setShowSideEffectDialog(true)}>
        {sideEffects.length === 0 ? (
          <p style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", padding: "16px 0" }}>{t("hp.no_side_effects")}</p>
        ) : sideEffects.map(s => (
          <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f3f4f6" }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{s.treatmentName}</p>
              <p style={{ fontSize: 12, color: "#6b7280", margin: "2px 0 0" }}>{s.symptom} · {s.occurredAt}</p>
            </div>
            {!readOnly && <button onClick={() => deleteItem("patient_side_effects", s.id, setSideEffects)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", padding: 4 }}><Trash2 size={14} /></button>}
          </div>
        ))}
      </SectionCard>

      {/* ── Vaccinations ── */}
      <SectionCard title="التطعيمات" icon={Syringe} iconColor="#0d9488" iconBg="#f0fdfa" addLabel={readOnly ? "" : "إضافة تطعيم"} onAdd={() => !readOnly && setShowVaccDialog(true)}>
        {vaccinations.length === 0 ? (
          <p style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", padding: "16px 0" }}>لا توجد تطعيمات مسجلة</p>
        ) : vaccinations.map(v => (
          <div key={v.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f3f4f6" }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{v.vaccineName}</p>
              <p style={{ fontSize: 11, color: "#9ca3af", margin: "2px 0 0" }}>
                {v.vaccinedAt} {v.provider && `· ${v.provider}`}
                {v.nextDoseAt && <span style={{ color: "#d97706", fontWeight: 600 }}> · جرعة تالية: {v.nextDoseAt}</span>}
              </p>
            </div>
            {!readOnly && <button onClick={() => deleteItem("patient_vaccinations", v.id, setVaccinations)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", padding: 4 }}><Trash2 size={14} /></button>}
          </div>
        ))}
      </SectionCard>

      {/* ── Medical Visits ── */}
      <SectionCard title="تاريخ الزيارات الطبية" icon={CalendarCheck} iconColor="#7c3aed" iconBg="#f5f3ff" addLabel={readOnly ? "" : "إضافة زيارة"} onAdd={() => !readOnly && setShowVisitDialog(true)} defaultOpen={false}>
        {visits.length === 0 ? (
          <p style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", padding: "16px 0" }}>لا توجد زيارات مسجلة</p>
        ) : visits.map(v => (
          <div key={v.id} style={{ padding: "10px 0", borderBottom: "1px solid #f3f4f6" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Stethoscope size={14} style={{ color: "#7c3aed", flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 700 }}>{v.doctorName}</span>
                {v.specialty && <span style={{ fontSize: 11, background: "#f3f4f6", color: "#6b7280", padding: "2px 7px", borderRadius: 20 }}>{v.specialty}</span>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: "#94a3b8" }}>{v.visitDate}</span>
                {!readOnly && <button onClick={() => deleteItem("patient_visits", v.id, setVisits)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", padding: 4 }}><Trash2 size={13} /></button>}
              </div>
            </div>
            {v.diagnosis && <p style={{ fontSize: 12, color: "#374151", margin: "4px 0 0 22px", fontWeight: 500 }}>التشخيص: {v.diagnosis}</p>}
            {v.treatment && <p style={{ fontSize: 12, color: "#6b7280", margin: "2px 0 0 22px" }}>العلاج: {v.treatment}</p>}
            {v.notes && <p style={{ fontSize: 11, color: "#9ca3af", margin: "2px 0 0 22px", fontStyle: "italic" }}>{v.notes}</p>}
          </div>
        ))}
      </SectionCard>

      {/* ── Chronic Disease Tracker ── */}
      {vitals.length > 0 && <ChronicTracker vitals={vitals} />}
      {vitals.length >= 2 && <VitalsChart vitals={vitals} />}

      {/* ── Vitals ── */}
      {!hideVitals && (
        <SectionCard title={t("hp.vitals_biometrics")} icon={Activity} iconColor="#16a34a" iconBg="#dcfce7"
          addLabel={readOnly ? "" : `Log ${VITAL_TABS.find(v => v.key === activeVitalTab)?.label ?? "Vital"}`}
          onAdd={() => { if (readOnly) return; setVitalForm(f => ({ ...f, type: activeVitalTab, unit: VITAL_TABS.find(v => v.key === activeVitalTab)?.unit ?? "" })); setShowVitalDialog(true); }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 12, overflowX: "auto", flexWrap: "wrap" }}>
            {VITAL_TABS.map(vt => (
              <button key={vt.key} onClick={() => setActiveVitalTab(vt.key)}
                style={{ fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 20, cursor: "pointer", border: "none", background: activeVitalTab === vt.key ? "#2563eb" : "#f3f4f6", color: activeVitalTab === vt.key ? "#fff" : "#6b7280", transition: "all 0.15s" }}>
                {vt.label}
              </button>
            ))}
          </div>
          {vitalsByType(activeVitalTab).length === 0 ? (
            <p style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", padding: "16px 0" }}>
              {t("hp.no_vitals", { type: VITAL_TABS.find(v => v.key === activeVitalTab)?.label })}
            </p>
          ) : vitalsByType(activeVitalTab).slice(0, 5).map(v => (
            <div key={v.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f3f4f6" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>{v.value}</span>
                <span style={{ fontSize: 12, color: "#6b7280" }}>{v.unit}</span>
                {v.notes && <span style={{ fontSize: 11, color: "#9ca3af" }}>· {v.notes}</span>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: "#9ca3af" }}>{v.recordedAt}</span>
                {!readOnly && <button onClick={() => deleteItem("patient_vitals", v.id, setVitals)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", padding: 4 }}><Trash2 size={13} /></button>}
              </div>
            </div>
          ))}
        </SectionCard>
      )}

      {/* ── Documents Vault ── */}
      {!hideDocumentsAndIncidents && (
        <SectionCard title={t("hp.documents_vault")} icon={FileText} iconColor="#2563eb" iconBg="#eff6ff" addLabel={readOnly ? "" : t("hp.document_uploaded")} onAdd={() => !readOnly && fileInputRef.current?.click()}>
          {!readOnly && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>{t("hp.doc_type")}</label>
                  <select value={docForm.docType} onChange={e => setDocForm(f => ({ ...f, docType: e.target.value }))} style={{ width: "100%", height: 36, padding: "0 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, background: "#fff" }}>
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
              <div onClick={() => !saving2 && fileInputRef.current?.click()} style={{ border: "2px dashed #d1d5db", borderRadius: 8, padding: "20px 16px", textAlign: "center", cursor: saving2 ? "wait" : "pointer", background: "#f9fafb", marginBottom: 8 }}>
                <Upload size={22} style={{ color: "#9ca3af", margin: "0 auto 6px", display: "block" }} />
                <p style={{ fontSize: 13, color: "#374151", margin: "0 0 2px", fontWeight: 500 }}>{saving2 ? t("hp.uploading") : t("hp.drop_or_click")}</p>
                <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>{t("hp.supported_formats")} — {t("hp.max_size")}</p>
              </div>
              <button onClick={() => saveDocument()} disabled={saving2} style={{ width: "100%", padding: "8px", background: "#f8fafc", color: "#374151", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: saving2 ? "not-allowed" : "pointer", opacity: saving2 ? 0.7 : 1, marginBottom: 8 }}>
                {saving2 ? "..." : t("hp.save_document")}
              </button>
              <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) saveDocument(f); }} />
              {uploadError && <p style={{ fontSize: 12, color: "#dc2626", padding: "6px 10px", background: "#fef2f2", borderRadius: 6, margin: "4px 0" }}>{uploadError}</p>}
            </>
          )}
          {documents.length === 0 ? (
            <p style={{ fontSize: 12, color: "#9ca3af", textAlign: "center", marginTop: 12 }}>{t("hp.no_documents")}</p>
          ) : (
            <div style={{ marginTop: 12 }}>
              {documents.map(d => (
                <div key={d.id} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #f3f4f6", gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {d.fileName && <p style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", margin: "0 0 4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.fileName}</p>}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: d.notes ? 3 : 0 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: "#eff6ff", color: "#2563eb" }}>{t(`hp.${d.docType}`) || d.docType}</span>
                      <span style={{ fontSize: 11, color: "#6b7280" }}>📅 {d.docDate}</span>
                    </div>
                    {d.notes && <p style={{ fontSize: 12, color: "#6b7280", margin: "2px 0 0", fontStyle: "italic" }}>{d.notes}</p>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    {(d.url || d.fileBase64) && (
                      <>
                        <a href={d.url ?? `data:${d.fileType ?? "application/octet-stream"};base64,${d.fileBase64}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#7c3aed", textDecoration: "none", fontWeight: 600, padding: "3px 8px", borderRadius: 6, border: "1px solid #ede9fe", background: "#f5f3ff" }}>{t("common.view") || "View"}</a>
                        <a href={d.url ?? `data:${d.fileType ?? "application/octet-stream"};base64,${d.fileBase64}`} download={d.fileName ?? "document"} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#2563eb", textDecoration: "none", fontWeight: 600, padding: "3px 8px", borderRadius: 6, border: "1px solid #dbeafe", background: "#eff6ff" }}>{t("common.download")}</a>
                      </>
                    )}
                    {!readOnly && <button onClick={() => deleteItem("patient_documents", d.id, setDocuments)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", padding: 4 }}><Trash2 size={13} /></button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {/* ── Medical Incident Log ── */}
      {!hideDocumentsAndIncidents && <IncidentLog patientId={patientIdProp ?? undefined} readOnly={readOnly} />}

      {/* ══════════════ DIALOGS ══════════════ */}

      {/* Allergy */}
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

      {/* Medication */}
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

      {/* Family History */}
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

      {/* Side Effects */}
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

      {/* Vital */}
      <Dialog open={showVitalDialog} onOpenChange={setShowVitalDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("hp.log_vital")}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>{t("hp.vitals_biometrics")}</Label>
              <Select value={vitalForm.type} onValueChange={v => { const u = VITAL_TABS.find(vt => vt.key === v)?.unit ?? ""; setVitalForm(f => ({ ...f, type: v, unit: u })); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{VITAL_TABS.map(vt => <SelectItem key={vt.key} value={vt.key}>{vt.label}</SelectItem>)}</SelectContent>
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

      {/* Vaccination */}
      <Dialog open={showVaccDialog} onOpenChange={setShowVaccDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>إضافة تطعيم</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2"><Label>اسم التطعيم / اللقاح</Label><Input value={vaccForm.vaccineName} onChange={e => setVaccForm(f => ({ ...f, vaccineName: e.target.value }))} placeholder="مثال: كوفيد-19، حصبة..." /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>تاريخ التطعيم</Label><Input type="date" value={vaccForm.vaccinedAt} onChange={e => setVaccForm(f => ({ ...f, vaccinedAt: e.target.value }))} /></div>
              <div className="space-y-2"><Label>الجرعة التالية (اختياري)</Label><Input type="date" value={vaccForm.nextDoseAt} onChange={e => setVaccForm(f => ({ ...f, nextDoseAt: e.target.value }))} /></div>
            </div>
            <div className="space-y-2"><Label>المركز الصحي / المستشفى</Label><Input value={vaccForm.provider} onChange={e => setVaccForm(f => ({ ...f, provider: e.target.value }))} placeholder="اختياري" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowVaccDialog(false)}>إلغاء</Button><Button onClick={addVaccination} disabled={saving}>حفظ</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Medical Visit */}
      <Dialog open={showVisitDialog} onOpenChange={setShowVisitDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>تسجيل زيارة طبية</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>اسم الطبيب</Label><Input value={visitForm.doctorName} onChange={e => setVisitForm(f => ({ ...f, doctorName: e.target.value }))} placeholder="د. محمد..." /></div>
              <div className="space-y-2"><Label>التخصص</Label><Input value={visitForm.specialty} onChange={e => setVisitForm(f => ({ ...f, specialty: e.target.value }))} placeholder="قلبية، عامة..." /></div>
            </div>
            <div className="space-y-2"><Label>تاريخ الزيارة</Label><Input type="date" value={visitForm.visitDate} onChange={e => setVisitForm(f => ({ ...f, visitDate: e.target.value }))} /></div>
            <div className="space-y-2"><Label>التشخيص</Label><Input value={visitForm.diagnosis} onChange={e => setVisitForm(f => ({ ...f, diagnosis: e.target.value }))} placeholder="مثال: التهاب رئوي..." /></div>
            <div className="space-y-2"><Label>العلاج المقرر</Label><Input value={visitForm.treatment} onChange={e => setVisitForm(f => ({ ...f, treatment: e.target.value }))} placeholder="مثال: أموكسيسيلين 500mg..." /></div>
            <div className="space-y-2"><Label>ملاحظات (اختياري)</Label><Textarea value={visitForm.notes} onChange={e => setVisitForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowVisitDialog(false)}>إلغاء</Button><Button onClick={addVisit} disabled={saving}>حفظ</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
