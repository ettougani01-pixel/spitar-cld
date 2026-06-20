import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  collection, query, where, getDocs, addDoc, deleteDoc, doc, orderBy,
  getDoc, updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertTriangle, Heart, Pill, Users, Activity, Plus, Trash2,
  Droplets, Scale, Wind, Zap, ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChronicCondition } from "@/lib/types";

interface Allergy { id: string; allergenName: string; type: string; severity: string; reaction: string; }
interface Medication { id: string; name: string; type: string; dosage: string; frequency: string; startDate: string; notes?: string; }
interface FamilyHistory { id: string; relation: string; condition: string; detail: string; }
interface SideEffect { id: string; treatmentName: string; symptom: string; occurredAt: string; }
interface Vital { id: string; type: string; value: string; unit: string; notes?: string; recordedAt: string; }

type SeverityLevel = "mild" | "moderate" | "severe" | "life_threatening";
const SEVERITY_COLORS: Record<SeverityLevel, string> = {
  mild: "bg-green-100 text-green-700 border-green-200",
  moderate: "bg-amber-100 text-amber-700 border-amber-200",
  severe: "bg-orange-100 text-orange-700 border-orange-200",
  life_threatening: "bg-red-100 text-red-700 border-red-200",
};

export default function HealthProfile() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [allergies, setAllergies] = useState<Allergy[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [familyHistory, setFamilyHistory] = useState<FamilyHistory[]>([]);
  const [sideEffects, setSideEffects] = useState<SideEffect[]>([]);
  const [vitals, setVitals] = useState<Vital[]>([]);
  const [chronicConditions, setChronicConditions] = useState<ChronicCondition[]>([]);
  const [activeSection, setActiveSection] = useState("allergies");
  const [loading, setLoading] = useState(true);
  const [savingConditions, setSavingConditions] = useState(false);

  // Dialog states
  const [showAllergyDialog, setShowAllergyDialog] = useState(false);
  const [showMedDialog, setShowMedDialog] = useState(false);
  const [showFamilyDialog, setShowFamilyDialog] = useState(false);
  const [showSideEffectDialog, setShowSideEffectDialog] = useState(false);
  const [showVitalDialog, setShowVitalDialog] = useState(false);

  // Forms
  const [allergyForm, setAllergyForm] = useState({ allergenName: "", type: "medication", severity: "mild", reaction: "" });
  const [medForm, setMedForm] = useState({ name: "", type: "prescription_med", dosage: "", frequency: "", startDate: "", notes: "" });
  const [familyForm, setFamilyForm] = useState({ relation: "parent", condition: "diabetes", detail: "" });
  const [sideEffectForm, setSideEffectForm] = useState({ treatmentName: "", symptom: "", occurredAt: "" });
  const [vitalForm, setVitalForm] = useState({ type: "blood_pressure", value: "", unit: "", notes: "", recordedAt: new Date().toISOString().split("T")[0] });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const uid = user.uid;
    async function load() {
      setLoading(true);
      const [aSnap, mSnap, fSnap, seSnap, vSnap, userDoc] = await Promise.all([
        getDocs(query(collection(db, "patient_allergies"), where("patientId", "==", uid))),
        getDocs(query(collection(db, "patient_medications"), where("patientId", "==", uid))),
        getDocs(query(collection(db, "patient_family_history"), where("patientId", "==", uid))),
        getDocs(query(collection(db, "patient_side_effects"), where("patientId", "==", uid))),
        getDocs(query(collection(db, "patient_vitals"), where("patientId", "==", uid), orderBy("recordedAt", "desc"))),
        getDoc(doc(db, "users", uid)),
      ]);
      setAllergies(aSnap.docs.map(d => ({ id: d.id, ...d.data() } as Allergy)));
      setMedications(mSnap.docs.map(d => ({ id: d.id, ...d.data() } as Medication)));
      setFamilyHistory(fSnap.docs.map(d => ({ id: d.id, ...d.data() } as FamilyHistory)));
      setSideEffects(seSnap.docs.map(d => ({ id: d.id, ...d.data() } as SideEffect)));
      setVitals(vSnap.docs.map(d => ({ id: d.id, ...d.data() } as Vital)));
      if (userDoc.exists()) setChronicConditions((userDoc.data().chronicConditions ?? []) as ChronicCondition[]);
      setLoading(false);
    }
    load();
  }, [user]);

  const addAllergy = async () => {
    if (!user || !allergyForm.allergenName) return;
    setSaving(true);
    try {
      const ref = await addDoc(collection(db, "patient_allergies"), { ...allergyForm, patientId: user.uid, createdAt: new Date().toISOString() });
      setAllergies(p => [{ id: ref.id, ...allergyForm }, ...p]);
      setShowAllergyDialog(false);
      setAllergyForm({ allergenName: "", type: "medication", severity: "mild", reaction: "" });
    } finally { setSaving(false); }
  };

  const addMedication = async () => {
    if (!user || !medForm.name) return;
    setSaving(true);
    try {
      const ref = await addDoc(collection(db, "patient_medications"), { ...medForm, patientId: user.uid, createdAt: new Date().toISOString() });
      setMedications(p => [{ id: ref.id, ...medForm }, ...p]);
      setShowMedDialog(false);
      setMedForm({ name: "", type: "prescription_med", dosage: "", frequency: "", startDate: "", notes: "" });
    } finally { setSaving(false); }
  };

  const addFamilyHistory = async () => {
    if (!user || !familyForm.condition) return;
    setSaving(true);
    try {
      const ref = await addDoc(collection(db, "patient_family_history"), { ...familyForm, patientId: user.uid, createdAt: new Date().toISOString() });
      setFamilyHistory(p => [{ id: ref.id, ...familyForm }, ...p]);
      setShowFamilyDialog(false);
      setFamilyForm({ relation: "parent", condition: "diabetes", detail: "" });
    } finally { setSaving(false); }
  };

  const addSideEffect = async () => {
    if (!user || !sideEffectForm.treatmentName) return;
    setSaving(true);
    try {
      const ref = await addDoc(collection(db, "patient_side_effects"), { ...sideEffectForm, patientId: user.uid, createdAt: new Date().toISOString() });
      setSideEffects(p => [{ id: ref.id, ...sideEffectForm }, ...p]);
      setShowSideEffectDialog(false);
      setSideEffectForm({ treatmentName: "", symptom: "", occurredAt: "" });
    } finally { setSaving(false); }
  };

  const addVital = async () => {
    if (!user || !vitalForm.value) return;
    setSaving(true);
    try {
      const ref = await addDoc(collection(db, "patient_vitals"), { ...vitalForm, patientId: user.uid, createdAt: new Date().toISOString() });
      setVitals(p => [{ id: ref.id, ...vitalForm }, ...p]);
      setShowVitalDialog(false);
      setVitalForm({ type: "blood_pressure", value: "", unit: "", notes: "", recordedAt: new Date().toISOString().split("T")[0] });
    } finally { setSaving(false); }
  };

  const deleteItem = async (collectionName: string, id: string, setter: React.Dispatch<React.SetStateAction<any[]>>) => {
    await deleteDoc(doc(db, collectionName, id));
    setter((p: any[]) => p.filter((x: any) => x.id !== id));
  };

  const hasCriticalAllergy = allergies.some(a => a.severity === "life_threatening" || a.severity === "severe");

  const ALL_CONDITIONS: { key: ChronicCondition; label: string; labelAr: string; color: string; bg: string }[] = [
    { key: "cancer",         label: "Cancer",            labelAr: "السرطان",       color: "#dc2626", bg: "#fee2e2" },
    { key: "pregnancy",      label: "Pregnancy",         labelAr: "الحمل",         color: "#a855f7", bg: "#fdf4ff" },
    { key: "diabetes",       label: "Diabetes",          labelAr: "السكري",        color: "#ea580c", bg: "#fff7ed" },
    { key: "hypertension",   label: "Hypertension",      labelAr: "ضغط الدم",      color: "#2563eb", bg: "#eff6ff" },
    { key: "asthma",         label: "Asthma",            labelAr: "الربو",         color: "#ca8a04", bg: "#fefce8" },
    { key: "heart_disease",  label: "Heart Disease",     labelAr: "أمراض القلب",  color: "#e11d48", bg: "#ffe4e6" },
    { key: "kidney_disease", label: "Kidney Disease",    labelAr: "أمراض الكلى",  color: "#c2410c", bg: "#fff7ed" },
    { key: "liver_disease",  label: "Liver Disease",     labelAr: "أمراض الكبد",  color: "#b45309", bg: "#fef9c3" },
    { key: "epilepsy",       label: "Epilepsy",          labelAr: "الصرع",         color: "#7c3aed", bg: "#ede9fe" },
    { key: "thyroid",        label: "Thyroid Disorder",  labelAr: "الغدة الدرقية", color: "#16a34a", bg: "#f0fdf4" },
    { key: "hiv",            label: "HIV/AIDS",          labelAr: "فيروس نقص المناعة", color: "#db2777", bg: "#fce7f3" },
    { key: "tuberculosis",   label: "Tuberculosis",      labelAr: "السل",          color: "#ea580c", bg: "#ffedd5" },
    { key: "mental_health",  label: "Mental Health",     labelAr: "الصحة النفسية", color: "#0284c7", bg: "#f0f9ff" },
  ];

  const toggleCondition = async (key: ChronicCondition) => {
    if (!user) return;
    setSavingConditions(true);
    const updated = chronicConditions.includes(key)
      ? chronicConditions.filter(c => c !== key)
      : [...chronicConditions, key];
    try {
      await updateDoc(doc(db, "users", user.uid), { chronicConditions: updated });
      setChronicConditions(updated);
    } finally { setSavingConditions(false); }
  };

  const sections = [
    { key: "conditions", label: "Chronic Conditions", icon: ShieldAlert, count: chronicConditions.length },
    { key: "allergies", label: t("hp.allergies"), icon: AlertTriangle, count: allergies.length },
    { key: "medications", label: t("hp.medications"), icon: Pill, count: medications.length },
    { key: "family", label: t("hp.family_history"), icon: Users, count: familyHistory.length },
    { key: "side_effects", label: t("hp.side_effects_journal"), icon: Zap, count: sideEffects.length },
    { key: "vitals", label: t("hp.vitals_biometrics"), icon: Activity, count: vitals.length },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">{t("hp.health_profile")}</h1>
          <p className="text-sm text-muted-foreground mt-1">Your personal health information, accessible by your doctors</p>
        </div>

        {hasCriticalAllergy && (
          <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            <p className="text-sm font-medium text-red-700">{t("hp.high_alert_warning")}</p>
          </div>
        )}

        {/* Section nav */}
        <div className="flex gap-1 overflow-x-auto mb-6 bg-muted rounded-lg p-1">
          {sections.map(({ key, label, icon: Icon, count }) => (
            <button
              key={key}
              onClick={() => setActiveSection(key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors shrink-0",
                activeSection === key ? "bg-white shadow text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
              {count > 0 && (
                <span className={cn("text-xs rounded-full px-1.5 py-0.5", activeSection === key ? "bg-primary/10 text-primary" : "bg-muted-foreground/20")}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Chronic Conditions ───────────────────────────────────────── */}
        {activeSection === "conditions" && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-foreground">Chronic Conditions</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Select all conditions that apply. Your doctor will see color-coded indicators based on these.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {ALL_CONDITIONS.map(({ key, label, labelAr, color, bg }) => {
                const active = chronicConditions.includes(key);
                return (
                  <button
                    key={key}
                    onClick={() => toggleCondition(key)}
                    disabled={savingConditions}
                    style={{
                      background: active ? bg : "#f8fafc",
                      border: `2px solid ${active ? color : "#e2e8f0"}`,
                      borderRadius: 12,
                      padding: "12px 14px",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.15s",
                    }}
                  >
                    <div style={{
                      width: 10, height: 10, borderRadius: "50%",
                      background: active ? color : "#cbd5e1",
                      flexShrink: 0,
                      boxShadow: active ? `0 0 0 3px ${color}33` : "none",
                    }} />
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: active ? color : "#374151", margin: 0 }}>{label}</p>
                      <p style={{ fontSize: 11, color: active ? color + "bb" : "#9ca3af", margin: 0 }}>{labelAr}</p>
                    </div>
                  </button>
                );
              })}
            </div>
            {chronicConditions.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-sm font-medium text-amber-800">
                  {chronicConditions.length} condition{chronicConditions.length > 1 ? "s" : ""} selected — visible to your authorized doctors
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Allergies ─────────────────────────────────────────────────── */}
        {activeSection === "allergies" && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">{t("hp.allergies")}</p>
              <Button size="sm" onClick={() => setShowAllergyDialog(true)}>
                <Plus className="w-4 h-4 me-1" />{t("hp.add_allergy")}
              </Button>
            </div>
            {allergies.length === 0
              ? <Card><CardContent className="py-10 text-center text-muted-foreground">{t("hp.no_allergies")}</CardContent></Card>
              : allergies.map(a => (
                <Card key={a.id}>
                  <CardContent className="p-4 flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className={cn("text-xs capitalize", SEVERITY_COLORS[a.severity as SeverityLevel])}>
                          {t(`hp.${a.severity}`)}
                        </Badge>
                        <span className="font-semibold text-sm">{a.allergenName}</span>
                      </div>
                      <p className="text-xs text-muted-foreground capitalize">{a.type}</p>
                      {a.reaction && <p className="text-xs mt-1 text-foreground/70">{a.reaction}</p>}
                    </div>
                    <Button size="sm" variant="ghost" className="text-destructive shrink-0" onClick={() => deleteItem("patient_allergies", a.id, setAllergies)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
          </div>
        )}

        {/* ── Medications ───────────────────────────────────────────────── */}
        {activeSection === "medications" && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">{t("hp.medications")}</p>
              <Button size="sm" onClick={() => setShowMedDialog(true)}>
                <Plus className="w-4 h-4 me-1" />{t("hp.add_medication")}
              </Button>
            </div>
            {medications.length === 0
              ? <Card><CardContent className="py-10 text-center text-muted-foreground">{t("hp.no_medications")}</CardContent></Card>
              : medications.map(m => (
                <Card key={m.id}>
                  <CardContent className="p-4 flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs capitalize">{m.type.replace("_", " ")}</Badge>
                        <span className="font-semibold text-sm">{m.name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{m.dosage} · {m.frequency}</p>
                      {m.startDate && <p className="text-xs text-muted-foreground mt-0.5">Started: {m.startDate}</p>}
                      {m.notes && <p className="text-xs mt-1 text-foreground/70">{m.notes}</p>}
                    </div>
                    <Button size="sm" variant="ghost" className="text-destructive shrink-0" onClick={() => deleteItem("patient_medications", m.id, setMedications)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
          </div>
        )}

        {/* ── Family History ─────────────────────────────────────────────── */}
        {activeSection === "family" && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">{t("hp.family_history")}</p>
              <Button size="sm" onClick={() => setShowFamilyDialog(true)}>
                <Plus className="w-4 h-4 me-1" />{t("hp.add_family_entry")}
              </Button>
            </div>
            {familyHistory.length === 0
              ? <Card><CardContent className="py-10 text-center text-muted-foreground">{t("hp.no_family_history")}</CardContent></Card>
              : familyHistory.map(f => (
                <Card key={f.id}>
                  <CardContent className="p-4 flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs capitalize">{t(`hp.${f.relation}`)}</Badge>
                        <span className="font-semibold text-sm capitalize">{t(`hp.${f.condition}`) || f.condition}</span>
                      </div>
                      {f.detail && <p className="text-xs text-foreground/70 mt-1">{f.detail}</p>}
                    </div>
                    <Button size="sm" variant="ghost" className="text-destructive shrink-0" onClick={() => deleteItem("patient_family_history", f.id, setFamilyHistory)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
          </div>
        )}

        {/* ── Side Effects ───────────────────────────────────────────────── */}
        {activeSection === "side_effects" && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">{t("hp.side_effects_journal")}</p>
              <Button size="sm" onClick={() => setShowSideEffectDialog(true)}>
                <Plus className="w-4 h-4 me-1" />{t("hp.log_side_effect")}
              </Button>
            </div>
            {sideEffects.length === 0
              ? <Card><CardContent className="py-10 text-center text-muted-foreground">{t("hp.no_side_effects")}</CardContent></Card>
              : sideEffects.map(s => (
                <Card key={s.id}>
                  <CardContent className="p-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-sm">{s.treatmentName}</p>
                      <p className="text-xs text-muted-foreground">{s.occurredAt}</p>
                      <p className="text-sm mt-1 text-foreground/70">{s.symptom}</p>
                    </div>
                    <Button size="sm" variant="ghost" className="text-destructive shrink-0" onClick={() => deleteItem("patient_side_effects", s.id, setSideEffects)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
          </div>
        )}

        {/* ── Vitals ─────────────────────────────────────────────────────── */}
        {activeSection === "vitals" && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">{t("hp.vitals_biometrics")}</p>
              <Button size="sm" onClick={() => setShowVitalDialog(true)}>
                <Plus className="w-4 h-4 me-1" />Log Vital
              </Button>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {[
                { type: "blood_pressure", label: t("hp.blood_pressure"), icon: Heart, color: "text-red-500", bg: "bg-red-50" },
                { type: "blood_sugar", label: t("hp.blood_sugar"), icon: Droplets, color: "text-amber-500", bg: "bg-amber-50" },
                { type: "weight", label: t("hp.weight"), icon: Scale, color: "text-blue-500", bg: "bg-blue-50" },
                { type: "heart_rate", label: t("hp.heart_rate"), icon: Activity, color: "text-purple-500", bg: "bg-purple-50" },
              ].map(({ type, label, icon: Icon, color, bg }) => {
                const latest = vitals.find(v => v.type === type);
                return (
                  <div key={type} className={cn("rounded-xl p-3 text-center", bg)}>
                    <Icon className={cn("w-5 h-5 mx-auto mb-1", color)} />
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className={cn("text-lg font-bold", color)}>{latest?.value ?? "—"}</p>
                    {latest?.unit && <p className="text-xs text-muted-foreground">{latest.unit}</p>}
                  </div>
                );
              })}
            </div>

            {vitals.length === 0
              ? <Card><CardContent className="py-10 text-center text-muted-foreground">{t("hp.no_vitals", { type: "" })}</CardContent></Card>
              : vitals.slice(0, 20).map(v => (
                <Card key={v.id}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <Badge variant="outline" className="text-xs capitalize shrink-0">{v.type.replace(/_/g, " ")}</Badge>
                    <span className="font-semibold text-sm">{v.value} {v.unit}</span>
                    <span className="text-xs text-muted-foreground ms-auto">{v.recordedAt}</span>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteItem("patient_vitals", v.id, setVitals)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
          </div>
        )}
      </div>

      {/* ── Add Allergy Dialog ───────────────────────────────────────────── */}
      <Dialog open={showAllergyDialog} onOpenChange={setShowAllergyDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("hp.add_allergy")}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>{t("hp.allergen_name")}</Label>
              <Input value={allergyForm.allergenName} onChange={e => setAllergyForm(f => ({ ...f, allergenName: e.target.value }))} />
            </div>
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
            <div className="space-y-2">
              <Label>{t("hp.reaction")}</Label>
              <Input value={allergyForm.reaction} onChange={e => setAllergyForm(f => ({ ...f, reaction: e.target.value }))} placeholder={t("hp.reaction_placeholder")} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAllergyDialog(false)}>{t("common.cancel")}</Button>
            <Button onClick={addAllergy} disabled={saving}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Medication Dialog ────────────────────────────────────────── */}
      <Dialog open={showMedDialog} onOpenChange={setShowMedDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("hp.add_medication")}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>{t("hp.med_name")}</Label>
              <Input value={medForm.name} onChange={e => setMedForm(f => ({ ...f, name: e.target.value }))} />
            </div>
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
              <div className="space-y-2">
                <Label>{t("hp.dosage")}</Label>
                <Input value={medForm.dosage} onChange={e => setMedForm(f => ({ ...f, dosage: e.target.value }))} placeholder="500mg" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("hp.frequency")}</Label>
                <Input value={medForm.frequency} onChange={e => setMedForm(f => ({ ...f, frequency: e.target.value }))} placeholder="Once daily" />
              </div>
              <div className="space-y-2">
                <Label>{t("hp.start_date")}</Label>
                <Input type="date" value={medForm.startDate} onChange={e => setMedForm(f => ({ ...f, startDate: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("common.optional")} {t("records.notes")}</Label>
              <Input value={medForm.notes} onChange={e => setMedForm(f => ({ ...f, notes: e.target.value }))} placeholder={t("hp.med_notes_placeholder")} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMedDialog(false)}>{t("common.cancel")}</Button>
            <Button onClick={addMedication} disabled={saving}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Family History Dialog ────────────────────────────────────── */}
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
            <div className="space-y-2">
              <Label>{t("hp.condition_detail")}</Label>
              <Input value={familyForm.detail} onChange={e => setFamilyForm(f => ({ ...f, detail: e.target.value }))} placeholder={t("hp.condition_detail_placeholder")} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFamilyDialog(false)}>{t("common.cancel")}</Button>
            <Button onClick={addFamilyHistory} disabled={saving}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Side Effect Dialog ───────────────────────────────────────── */}
      <Dialog open={showSideEffectDialog} onOpenChange={setShowSideEffectDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("hp.log_side_effect")}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>{t("hp.treatment_name")}</Label>
              <Input value={sideEffectForm.treatmentName} onChange={e => setSideEffectForm(f => ({ ...f, treatmentName: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>{t("hp.symptom")}</Label>
              <Textarea value={sideEffectForm.symptom} onChange={e => setSideEffectForm(f => ({ ...f, symptom: e.target.value }))} placeholder={t("hp.symptom_placeholder")} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>{t("hp.occurred_at")}</Label>
              <Input type="date" value={sideEffectForm.occurredAt} onChange={e => setSideEffectForm(f => ({ ...f, occurredAt: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSideEffectDialog(false)}>{t("common.cancel")}</Button>
            <Button onClick={addSideEffect} disabled={saving}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Vital Dialog ─────────────────────────────────────────────── */}
      <Dialog open={showVitalDialog} onOpenChange={setShowVitalDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Log Vital Reading</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>Vital Type</Label>
              <Select value={vitalForm.type} onValueChange={v => {
                const units: Record<string, string> = {
                  blood_pressure: "mmHg", blood_sugar: "mg/dL", weight: "kg", heart_rate: "bpm", sleep: "hours",
                };
                setVitalForm(f => ({ ...f, type: v, unit: units[v] || "" }));
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="blood_pressure">{t("hp.blood_pressure")}</SelectItem>
                  <SelectItem value="blood_sugar">{t("hp.blood_sugar")}</SelectItem>
                  <SelectItem value="weight">{t("hp.weight")}</SelectItem>
                  <SelectItem value="heart_rate">{t("hp.heart_rate")}</SelectItem>
                  <SelectItem value="sleep">{t("hp.sleep")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Value</Label>
                <Input value={vitalForm.value} onChange={e => setVitalForm(f => ({ ...f, value: e.target.value }))} placeholder={vitalForm.type === "blood_pressure" ? "120/80" : "0"} />
              </div>
              <div className="space-y-2">
                <Label>Unit</Label>
                <Input value={vitalForm.unit} onChange={e => setVitalForm(f => ({ ...f, unit: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={vitalForm.recordedAt} onChange={e => setVitalForm(f => ({ ...f, recordedAt: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Notes ({t("common.optional")})</Label>
              <Input value={vitalForm.notes} onChange={e => setVitalForm(f => ({ ...f, notes: e.target.value }))} placeholder={t("hp.vital_notes_placeholder")} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVitalDialog(false)}>{t("common.cancel")}</Button>
            <Button onClick={addVital} disabled={saving}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
