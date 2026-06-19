import { useState, useEffect } from "react";
import { collection, query, where, getDocs, addDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Hospital, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface Incident {
  id: string;
  type: "surgery" | "hospitalization" | "accident" | "chronic" | "other";
  title: string;
  date: string;
  hospital?: string;
  duration?: string;
  notes: string;
  patientId: string;
}

const TYPE_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  surgery:         { bg: "#fee2e2", color: "#dc2626", label: "Surgery" },
  hospitalization: { bg: "#fef3c7", color: "#d97706", label: "Hospitalization" },
  accident:        { bg: "#fed7aa", color: "#ea580c", label: "Accident / Injury" },
  chronic:         { bg: "#ede9fe", color: "#7c3aed", label: "Chronic Condition" },
  other:           { bg: "#f1f5f9", color: "#64748b", label: "Other" },
};

export function IncidentLog({ patientId: patientIdProp, readOnly = false }: { patientId?: string; readOnly?: boolean }) {
  const { user } = useAuth();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);
  const [dialog, setDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ type: "surgery" as Incident["type"], title: "", date: "", hospital: "", duration: "", notes: "" });

  const patientId = patientIdProp ?? user?.uid;

  useEffect(() => {
    if (!patientId) return;
    getDocs(query(collection(db, "health_incidents"), where("patientId", "==", patientId)))
      .then(snap => setIncidents(snap.docs.map(d => ({ id: d.id, ...d.data() } as Incident)).sort((a, b) => b.date.localeCompare(a.date))))
      .finally(() => setLoading(false));
  }, [patientId]);

  const submit = async () => {
    if (!patientId || !form.title || !form.date) return;
    setSaving(true);
    try {
      const data = { ...form, patientId, createdAt: new Date().toISOString() };
      const ref = await addDoc(collection(db, "health_incidents"), data);
      setIncidents(prev => [{ id: ref.id, ...data } as Incident, ...prev]);
      setDialog(false);
      setForm({ type: "surgery", title: "", date: "", hospital: "", duration: "", notes: "" });
    } finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    await deleteDoc(doc(db, "health_incidents", id));
    setIncidents(prev => prev.filter(i => i.id !== id));
  };

  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, marginBottom: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      <div
        onClick={() => setOpen(v => !v)}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", cursor: "pointer", borderBottom: open ? "1px solid #f3f4f6" : "none" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Hospital size={15} style={{ color: "#dc2626" }} />
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>Medical History & Incidents</span>
          {incidents.length > 0 && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#fee2e2", color: "#dc2626" }}>{incidents.length}</span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {!readOnly && (
            <button
              onClick={e => { e.stopPropagation(); setDialog(true); }}
              style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, color: "#dc2626", background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}
            >
              <Plus size={12} /> Add Event
            </button>
          )}
          {open ? <ChevronUp size={16} style={{ color: "#9ca3af" }} /> : <ChevronDown size={16} style={{ color: "#9ca3af" }} />}
        </div>
      </div>

      {open && (
        <div style={{ padding: "12px 16px" }}>
          {loading ? (
            <p style={{ fontSize: 13, color: "#94a3b8" }}>Loading...</p>
          ) : incidents.length === 0 ? (
            <p style={{ fontSize: 13, color: "#94a3b8", textAlign: "center", padding: "16px 0" }}>No medical events recorded</p>
          ) : incidents.map(i => {
            const c = TYPE_COLORS[i.type] ?? TYPE_COLORS.other;
            return (
              <div key={i.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 0", borderBottom: "1px solid #f3f4f6" }}>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: c.bg, color: c.color, whiteSpace: "nowrap", flexShrink: 0, marginTop: 2 }}>{c.label}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", margin: 0 }}>{i.title}</p>
                  <p style={{ fontSize: 11, color: "#94a3b8", margin: "2px 0 0" }}>
                    {i.date}{i.hospital ? ` · ${i.hospital}` : ""}{i.duration ? ` · ${i.duration}` : ""}
                  </p>
                  {i.notes && <p style={{ fontSize: 12, color: "#64748b", margin: "4px 0 0", lineHeight: 1.5 }}>{i.notes}</p>}
                </div>
                {!readOnly && (
                  <button onClick={() => remove(i.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", padding: 4, flexShrink: 0 }}>
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={dialog} onOpenChange={v => { if (!v) setDialog(false); }}>
        <DialogContent style={{ maxWidth: 460 }}>
          <DialogHeader><DialogTitle>Add Medical Event</DialogTitle></DialogHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <Label>Event Type</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as Incident["type"] }))}>
                <SelectTrigger style={{ marginTop: 6 }}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_COLORS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Title *</Label>
              <Input placeholder="e.g. Appendectomy, Car accident, Diagnosed with Type 2 Diabetes" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={{ marginTop: 6 }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <Label>Date *</Label>
                <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={{ marginTop: 6 }} />
              </div>
              <div>
                <Label>Duration (if applicable)</Label>
                <Input placeholder="e.g. 3 days, 2 weeks" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} style={{ marginTop: 6 }} />
              </div>
            </div>
            <div>
              <Label>Hospital / Location</Label>
              <Input placeholder="Hospital name" value={form.hospital} onChange={e => setForm(f => ({ ...f, hospital: e.target.value }))} style={{ marginTop: 6 }} />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea placeholder="Complications, outcome, follow-up..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} style={{ marginTop: 6 }} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>Cancel</Button>
            <Button onClick={submit} disabled={saving || !form.title || !form.date}>
              {saving ? "Saving..." : "Add Event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
