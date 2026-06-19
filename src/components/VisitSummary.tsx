import { useState, useEffect } from "react";
import { collection, query, where, getDocs, addDoc, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ClipboardList, Send, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface Summary {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  visitDate: string;
  diagnosis: string;
  instructions: string;
  medications: string;
  followUpDate?: string;
  createdAt: string;
}

// Doctor: send summary after visit
export function SendSummaryButton({
  patientId, patientName, doctorId, doctorName,
}: { patientId: string; patientName: string; doctorId: string; doctorName: string }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ visitDate: new Date().toISOString().split("T")[0], diagnosis: "", instructions: "", medications: "", followUpDate: "" });
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (!form.diagnosis || !form.instructions) return;
    setSaving(true);
    try {
      await addDoc(collection(db, "visit_summaries"), {
        patientId, patientName, doctorId, doctorName,
        ...form,
        createdAt: new Date().toISOString(),
      });
      setSent(true);
      setTimeout(() => { setOpen(false); setSent(false); setForm({ visitDate: new Date().toISOString().split("T")[0], diagnosis: "", instructions: "", medications: "", followUpDate: "" }); }, 1500);
    } finally { setSaving(false); }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", borderRadius: 10, background: "linear-gradient(135deg, #7c3aed, #2563eb)", color: "#fff", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
      >
        <ClipboardList size={13} /> Send Summary
      </button>

      <Dialog open={open} onOpenChange={v => { if (!v) setOpen(false); }}>
        <DialogContent style={{ maxWidth: 500 }}>
          <DialogHeader>
            <DialogTitle>Visit Summary — {patientName}</DialogTitle>
          </DialogHeader>
          {sent ? (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#16a34a" }}>Summary sent to patient!</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <Label>Visit Date</Label>
                <Input type="date" value={form.visitDate} onChange={e => setForm(f => ({ ...f, visitDate: e.target.value }))} style={{ marginTop: 6 }} />
              </div>
              <div>
                <Label>Diagnosis / Findings *</Label>
                <Textarea placeholder="e.g. Upper respiratory tract infection" value={form.diagnosis} onChange={e => setForm(f => ({ ...f, diagnosis: e.target.value }))} rows={2} style={{ marginTop: 6 }} />
              </div>
              <div>
                <Label>Patient Instructions *</Label>
                <Textarea placeholder="Rest, drink fluids, avoid cold..." value={form.instructions} onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))} rows={3} style={{ marginTop: 6 }} />
              </div>
              <div>
                <Label>Prescribed Medications</Label>
                <Textarea placeholder="Amoxicillin 500mg 3x/day for 7 days..." value={form.medications} onChange={e => setForm(f => ({ ...f, medications: e.target.value }))} rows={2} style={{ marginTop: 6 }} />
              </div>
              <div>
                <Label>Follow-up Date (optional)</Label>
                <Input type="date" value={form.followUpDate} onChange={e => setForm(f => ({ ...f, followUpDate: e.target.value }))} style={{ marginTop: 6 }} min={new Date().toISOString().split("T")[0]} />
              </div>
            </div>
          )}
          {!sent && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={submit} disabled={saving || !form.diagnosis || !form.instructions}>
                <Send size={13} style={{ marginRight: 6 }} />
                {saving ? "Sending..." : "Send to Patient"}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// Patient: view summaries
export function PatientVisitSummaries({ patientId }: { patientId: string }) {
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    getDocs(query(collection(db, "visit_summaries"), where("patientId", "==", patientId), orderBy("createdAt", "desc")))
      .then(snap => setSummaries(snap.docs.map(d => ({ id: d.id, ...d.data() } as Summary))))
      .finally(() => setLoading(false));
  }, [patientId]);

  if (loading) return <p style={{ fontSize: 13, color: "#94a3b8", textAlign: "center", padding: 32 }}>Loading...</p>;
  if (summaries.length === 0) return (
    <div style={{ textAlign: "center", padding: "52px 24px" }}>
      <ClipboardList size={40} style={{ color: "#cbd5e1", margin: "0 auto 12px" }} />
      <p style={{ fontSize: 14, color: "#94a3b8", margin: 0 }}>No visit summaries yet</p>
      <p style={{ fontSize: 12, color: "#cbd5e1", marginTop: 4 }}>Your doctor will send a summary after each visit</p>
    </div>
  );

  return (
    <div style={{ maxWidth: 700, display: "flex", flexDirection: "column", gap: 12 }}>
      {summaries.map(s => (
        <div key={s.id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, overflow: "hidden" }}>
          <div
            onClick={() => setExpanded(expanded === s.id ? null : s.id)}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", cursor: "pointer" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #ede9fe, #dbeafe)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ClipboardList size={16} style={{ color: "#7c3aed" }} />
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", margin: 0 }}>Dr. {s.doctorName}</p>
                <p style={{ fontSize: 11, color: "#94a3b8", margin: 0 }}>{s.visitDate}</p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.diagnosis}</span>
              {expanded === s.id ? <ChevronUp size={16} style={{ color: "#94a3b8" }} /> : <ChevronDown size={16} style={{ color: "#94a3b8" }} />}
            </div>
          </div>
          {expanded === s.id && (
            <div style={{ padding: "0 18px 16px", borderTop: "1px solid #f1f5f9", display: "flex", flexDirection: "column", gap: 12 }}>
              <SummarySection label="Diagnosis / Findings" value={s.diagnosis} color="#dc2626" />
              <SummarySection label="Instructions" value={s.instructions} color="#d97706" />
              {s.medications && <SummarySection label="Medications" value={s.medications} color="#2563eb" />}
              {s.followUpDate && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 10, background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#16a34a" }}>📅 Follow-up: {s.followUpDate}</span>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function SummarySection({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ paddingTop: 12 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
      <p style={{ fontSize: 13, color: "#0f172a", margin: 0, lineHeight: 1.6, whiteSpace: "pre-line" }}>{value}</p>
    </div>
  );
}
