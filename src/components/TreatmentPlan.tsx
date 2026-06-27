import { useState, useEffect } from "react";
import { collection, query, where, getDocs, addDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Plus, Trash2, CalendarCheck } from "lucide-react";

interface PlanItem {
  id: string;
  patientId: string;
  doctorId: string;
  doctorName: string;
  day: string;
  time: string;
  activity: string;
  note: string;
  createdAt: string;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_COLORS: Record<string, string> = {
  Monday: "#2563eb", Tuesday: "#7c3aed", Wednesday: "#0891b2",
  Thursday: "#16a34a", Friday: "#d97706", Saturday: "#dc2626", Sunday: "#db2777",
};

/* ─── DOCTOR SIDE ─── */
export function DoctorTreatmentPlan({
  patients,
  doctorId,
  doctorName,
}: {
  patients: { id: string; name: string }[];
  doctorId: string;
  doctorName: string;
}) {
  const [selectedPatient, setSelectedPatient] = useState<string>("");
  const [items, setItems] = useState<PlanItem[]>([]);
  const [form, setForm] = useState({ day: "Monday", time: "08:00", activity: "", note: "" });
  const [saving, setSaving] = useState(false);

  const load = async (patientId: string) => {
    setSelectedPatient(patientId);
    setItems([]);
    if (!patientId) return;
    const snap = await getDocs(query(
      collection(db, "treatment_plans"),
      where("patientId", "==", patientId),
    ));
    setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as PlanItem)));
  };

  const addItem = async () => {
    if (!selectedPatient || !form.activity.trim()) return;
    setSaving(true);
    const item = {
      patientId: selectedPatient,
      doctorId,
      doctorName,
      day: form.day,
      time: form.time,
      activity: form.activity.trim(),
      note: form.note.trim(),
      createdAt: new Date().toISOString(),
    };
    const ref = await addDoc(collection(db, "treatment_plans"), item);
    setItems(prev => [...prev, { id: ref.id, ...item }]);
    setForm(f => ({ ...f, activity: "", note: "" }));
    setSaving(false);
  };

  const remove = async (id: string) => {
    await deleteDoc(doc(db, "treatment_plans", id));
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const byDay = DAYS.reduce<Record<string, PlanItem[]>>((acc, d) => {
    acc[d] = items.filter(i => i.day === d).sort((a, b) => a.time.localeCompare(b.time));
    return acc;
  }, {});

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: 20 }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 12 }}>Visual Treatment Plan</p>
        <select
          value={selectedPatient}
          onChange={e => load(e.target.value)}
          style={{ width: "100%", height: 44, padding: "0 14px", border: "1.5px solid #e2e8f0", borderRadius: 12, fontSize: 14, outline: "none", background: "#f8fafc", color: "#0f172a", marginBottom: 16 }}
        >
          <option value="">— Select a patient —</option>
          {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        {selectedPatient && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              <select value={form.day} onChange={e => setForm(f => ({ ...f, day: e.target.value }))}
                style={{ height: 40, padding: "0 12px", border: "1.5px solid #e2e8f0", borderRadius: 10, fontSize: 14, outline: "none", background: "#f8fafc" }}>
                {DAYS.map(d => <option key={d}>{d}</option>)}
              </select>
              <input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                style={{ height: 40, padding: "0 12px", border: "1.5px solid #e2e8f0", borderRadius: 10, fontSize: 14, outline: "none", background: "#f8fafc" }} />
            </div>
            <input placeholder="Activity (e.g. Blood pressure check, Walk 30 min, Take Metformin)" value={form.activity}
              onChange={e => setForm(f => ({ ...f, activity: e.target.value }))}
              style={{ width: "100%", height: 40, padding: "0 12px", border: "1.5px solid #e2e8f0", borderRadius: 10, fontSize: 14, outline: "none", background: "#f8fafc", boxSizing: "border-box", marginBottom: 8 }} />
            <input placeholder="Note (optional)" value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              style={{ width: "100%", height: 40, padding: "0 12px", border: "1.5px solid #e2e8f0", borderRadius: 10, fontSize: 14, outline: "none", background: "#f8fafc", boxSizing: "border-box", marginBottom: 10 }} />
            <button onClick={addItem} disabled={saving || !form.activity.trim()}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 20px", borderRadius: 10, background: "linear-gradient(135deg, #7c3aed, #2563eb)", color: "#fff", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: !form.activity.trim() ? 0.5 : 1 }}>
              <Plus size={14} /> Add to Plan
            </button>
          </>
        )}
      </div>

      {selectedPatient && items.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
          {DAYS.filter(d => byDay[d].length > 0).map(day => (
            <div key={day} style={{ background: "#fff", borderRadius: 14, border: `1.5px solid ${DAY_COLORS[day]}33`, overflow: "hidden" }}>
              <div style={{ background: DAY_COLORS[day], padding: "10px 14px" }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>{day}</span>
              </div>
              <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                {byDay[day].map(item => (
                  <div key={item.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 10px", borderRadius: 8, background: `${DAY_COLORS[day]}0d`, border: `1px solid ${DAY_COLORS[day]}22` }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: DAY_COLORS[day] }}>{item.time}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{item.activity}</span>
                      </div>
                      {item.note && <p style={{ fontSize: 11, color: "#64748b", margin: "2px 0 0" }}>{item.note}</p>}
                    </div>
                    <button onClick={() => remove(item.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", padding: 2, flexShrink: 0 }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── PATIENT SIDE ─── */
export function PatientTreatmentPlan({ patientId }: { patientId: string }) {
  const [items, setItems] = useState<PlanItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!patientId) { setLoading(false); return; }
    getDocs(query(collection(db, "treatment_plans"), where("patientId", "==", patientId))).then(snap => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as PlanItem)));
    }).catch(() => {}).finally(() => setLoading(false));
  }, [patientId]);

  const byDay = DAYS.reduce<Record<string, PlanItem[]>>((acc, d) => {
    acc[d] = items.filter(i => i.day === d).sort((a, b) => a.time.localeCompare(b.time));
    return acc;
  }, {});

  if (loading) return <div style={{ padding: 32, textAlign: "center", color: "#94a3b8" }}>Loading...</div>;

  if (items.length === 0) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "48px 24px", background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0" }}>
      <div style={{ width: 52, height: 52, borderRadius: 14, background: "linear-gradient(135deg, #ede9fe, #dbeafe)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CalendarCheck size={24} style={{ color: "#7c3aed" }} />
      </div>
      <p style={{ fontSize: 14, color: "#94a3b8", margin: 0 }}>No treatment plan yet. Your doctor will create one for you.</p>
    </div>
  );

  return (
    <div>
      <div style={{ padding: "14px 18px", background: "linear-gradient(135deg, #ede9fe, #dbeafe)", borderRadius: 14, border: "1.5px solid #c4b5fd", marginBottom: 16 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: "#5b21b6", margin: "0 0 2px" }}>Your Weekly Treatment Plan</p>
        <p style={{ fontSize: 12, color: "#6d28d9", margin: 0 }}>Follow this plan prepared by your doctor to stay on track.</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
        {DAYS.filter(d => byDay[d].length > 0).map(day => (
          <div key={day} style={{ background: "#fff", borderRadius: 14, border: `1.5px solid ${DAY_COLORS[day]}33`, overflow: "hidden" }}>
            <div style={{ background: DAY_COLORS[day], padding: "10px 14px" }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>{day}</span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", marginLeft: 8 }}>{byDay[day].length} task{byDay[day].length > 1 ? "s" : ""}</span>
            </div>
            <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
              {byDay[day].map(item => (
                <div key={item.id} style={{ padding: "8px 10px", borderRadius: 8, background: `${DAY_COLORS[day]}0d`, border: `1px solid ${DAY_COLORS[day]}22` }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: DAY_COLORS[day], flexShrink: 0 }}>{item.time}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{item.activity}</span>
                  </div>
                  {item.note && <p style={{ fontSize: 11, color: "#64748b", margin: "3px 0 0" }}>{item.note}</p>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
