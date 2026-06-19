import { useState, useEffect } from "react";
import { collection, query, where, getDocs, addDoc, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ArrowRight, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";

interface Referral {
  id: string;
  fromDoctorId: string;
  fromDoctorName: string;
  toDoctorId: string;
  toDoctorName: string;
  toDoctorSpecialty: string;
  patientId: string;
  patientName: string;
  reason: string;
  notes: string;
  status: "pending" | "accepted" | "completed";
  createdAt: string;
}

// Doctor view: send referrals
export function DoctorReferrals({ patients }: { patients: { id: string; name: string }[] }) {
  const { user } = useAuth();
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [dialog, setDialog] = useState(false);
  const [spitarIdInput, setSpitarIdInput] = useState("");
  const [foundDoctor, setFoundDoctor] = useState<{ uid: string; name: string; specialty?: string } | null>(null);
  const [searching, setSearching] = useState(false);
  const [form, setForm] = useState({ patientId: "", reason: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getDocs(query(collection(db, "referrals"), where("fromDoctorId", "==", user.uid), orderBy("createdAt", "desc")))
      .then(snap => setReferrals(snap.docs.map(d => ({ id: d.id, ...d.data() } as Referral))))
      .finally(() => setLoading(false));
  }, [user]);

  const searchDoctor = async () => {
    if (!spitarIdInput.trim()) return;
    setSearching(true); setFoundDoctor(null);
    try {
      const snap = await getDocs(query(collection(db, "users"), where("spitarId", "==", spitarIdInput.trim().toUpperCase()), where("role", "==", "doctor")));
      if (!snap.empty) {
        const d = snap.docs[0].data();
        setFoundDoctor({ uid: snap.docs[0].id, name: `${d.firstName} ${d.lastName}`, specialty: d.specialty });
      }
    } finally { setSearching(false); }
  };

  const submit = async () => {
    if (!user || !foundDoctor || !form.patientId || !form.reason) return;
    const patient = patients.find(p => p.id === form.patientId);
    if (!patient) return;
    setSaving(true);
    try {
      const data = {
        fromDoctorId: user.uid,
        fromDoctorName: `${user.firstName} ${user.lastName}`,
        toDoctorId: foundDoctor.uid,
        toDoctorName: foundDoctor.name,
        toDoctorSpecialty: foundDoctor.specialty ?? "",
        patientId: form.patientId,
        patientName: patient.name,
        reason: form.reason,
        notes: form.notes,
        status: "pending",
        createdAt: new Date().toISOString(),
      };
      const ref = await addDoc(collection(db, "referrals"), data);
      setReferrals(prev => [{ id: ref.id, ...data } as Referral, ...prev]);
      setDialog(false);
      setFoundDoctor(null); setSpitarIdInput(""); setForm({ patientId: "", reason: "", notes: "" });
    } finally { setSaving(false); }
  };

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <Button onClick={() => setDialog(true)}>
          <UserPlus size={14} style={{ marginRight: 6 }} /> New Referral
        </Button>
      </div>

      {loading ? (
        <p style={{ fontSize: 13, color: "#94a3b8", textAlign: "center" }}>Loading...</p>
      ) : referrals.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 24px", color: "#94a3b8", fontSize: 13 }}>No referrals sent yet</div>
      ) : referrals.map(r => <ReferralCard key={r.id} r={r} perspective="from" />)}

      <Dialog open={dialog} onOpenChange={v => { if (!v) { setDialog(false); setFoundDoctor(null); setSpitarIdInput(""); } }}>
        <DialogContent style={{ maxWidth: 480 }}>
          <DialogHeader><DialogTitle>Refer Patient to Specialist</DialogTitle></DialogHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <Label>Patient</Label>
              <select
                value={form.patientId}
                onChange={e => setForm(f => ({ ...f, patientId: e.target.value }))}
                style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, marginTop: 6 }}
              >
                <option value="">Select patient...</option>
                {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Refer to Doctor (SPITAR ID)</Label>
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <Input
                  placeholder="e.g. DOC-XXXX"
                  value={spitarIdInput}
                  onChange={e => setSpitarIdInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && searchDoctor()}
                />
                <Button variant="outline" onClick={searchDoctor} disabled={searching}>
                  {searching ? "..." : "Search"}
                </Button>
              </div>
              {foundDoctor && (
                <div style={{ marginTop: 8, padding: "8px 12px", background: "#f0fdf4", borderRadius: 8, border: "1px solid #bbf7d0" }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#16a34a", margin: 0 }}>✓ {foundDoctor.name}</p>
                  {foundDoctor.specialty && <p style={{ fontSize: 12, color: "#16a34a", margin: 0 }}>{foundDoctor.specialty}</p>}
                </div>
              )}
            </div>
            <div>
              <Label>Reason for Referral</Label>
              <Input
                placeholder="e.g. Suspected cardiac arrhythmia"
                value={form.reason}
                onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                style={{ marginTop: 6 }}
              />
            </div>
            <div>
              <Label>Clinical Notes (optional)</Label>
              <Textarea
                placeholder="Any relevant history, findings, or instructions..."
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={3}
                style={{ marginTop: 6 }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialog(false); setFoundDoctor(null); setSpitarIdInput(""); }}>Cancel</Button>
            <Button onClick={submit} disabled={!foundDoctor || !form.patientId || !form.reason || saving}>
              {saving ? "Sending..." : "Send Referral"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Patient view: see referrals made for them
export function PatientReferrals({ patientId }: { patientId: string }) {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDocs(query(collection(db, "referrals"), where("patientId", "==", patientId), orderBy("createdAt", "desc")))
      .then(snap => setReferrals(snap.docs.map(d => ({ id: d.id, ...d.data() } as Referral))))
      .finally(() => setLoading(false));
  }, [patientId]);

  if (loading) return <p style={{ fontSize: 13, color: "#94a3b8", textAlign: "center", padding: 32 }}>Loading...</p>;
  if (referrals.length === 0) return (
    <div style={{ textAlign: "center", padding: "52px 24px", color: "#94a3b8", fontSize: 13 }}>
      No referrals yet
    </div>
  );

  return (
    <div style={{ maxWidth: 700 }}>
      {referrals.map(r => <ReferralCard key={r.id} r={r} perspective="to" />)}
    </div>
  );
}

function ReferralCard({ r, perspective }: { r: Referral; perspective: "from" | "to" }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: 18, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "#0f172a" }}>
          <span style={{ color: "#64748b" }}>Dr. {r.fromDoctorName}</span>
          <ArrowRight size={14} style={{ color: "#94a3b8" }} />
          <span>Dr. {r.toDoctorName}</span>
          {r.toDoctorSpecialty && <span style={{ fontSize: 11, color: "#7c3aed", background: "#ede9fe", padding: "2px 8px", borderRadius: 20, fontWeight: 600 }}>{r.toDoctorSpecialty}</span>}
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: r.status === "completed" ? "#dcfce7" : "#fef3c7", color: r.status === "completed" ? "#16a34a" : "#d97706" }}>
          {r.status}
        </span>
      </div>
      <p style={{ fontSize: 13, color: "#0f172a", margin: "0 0 4px" }}>
        <strong>Patient:</strong> {r.patientName}
      </p>
      <p style={{ fontSize: 13, color: "#0f172a", margin: "0 0 4px" }}>
        <strong>Reason:</strong> {r.reason}
      </p>
      {r.notes && <p style={{ fontSize: 12, color: "#64748b", margin: "4px 0 0", padding: "8px 10px", background: "#f8fafc", borderRadius: 8 }}>{r.notes}</p>}
      <p style={{ fontSize: 11, color: "#94a3b8", margin: "8px 0 0" }}>{new Date(r.createdAt).toLocaleDateString()}</p>
    </div>
  );
}
