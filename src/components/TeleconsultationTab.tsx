import { useState, useEffect, useRef } from "react";
import { collection, query, where, getDocs, addDoc, updateDoc, doc, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { MessageCircle, Send, Clock, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";

interface Consultation {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  question: string;
  answer?: string;
  status: "pending" | "answered";
  createdAt: string;
  answeredAt?: string;
}

// Patient view: ask a question to a permitted doctor
export function PatientTeleconsultation({ permissions }: { permissions: { granteeId: string; granteeName: string }[] }) {
  const { user } = useAuth();
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getDocs(query(collection(db, "consultations"), where("patientId", "==", user.uid), orderBy("createdAt", "desc")))
      .then(snap => setConsultations(snap.docs.map(d => ({ id: d.id, ...d.data() } as Consultation))))
      .finally(() => setLoading(false));
  }, [user]);

  const sendQuestion = async () => {
    if (!user || !selectedDoctor || !question.trim()) return;
    const dr = permissions.find(p => p.granteeId === selectedDoctor);
    if (!dr) return;
    setSending(true);
    try {
      const data = {
        patientId: user.uid,
        patientName: `${user.firstName} ${user.lastName}`,
        doctorId: selectedDoctor,
        doctorName: dr.granteeName,
        question: question.trim(),
        status: "pending",
        createdAt: new Date().toISOString(),
      };
      const ref = await addDoc(collection(db, "consultations"), data);
      setConsultations(prev => [{ id: ref.id, ...data } as Consultation, ...prev]);
      setQuestion("");
    } finally { setSending(false); }
  };

  const doctors = permissions.filter(p => p.granteeId);

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: 20, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg, #7c3aed, #2563eb)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <MessageCircle size={15} style={{ color: "#fff" }} />
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>Ask Your Doctor</span>
        </div>
        {doctors.length === 0 ? (
          <p style={{ fontSize: 13, color: "#94a3b8" }}>You need to grant access to a doctor first before sending a teleconsultation.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <select
              value={selectedDoctor}
              onChange={e => setSelectedDoctor(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, color: "#0f172a", background: "#fff" }}
            >
              <option value="">Select a doctor...</option>
              {doctors.map(d => <option key={d.granteeId} value={d.granteeId}>{d.granteeName}</option>)}
            </select>
            <Textarea
              placeholder="Describe your symptoms or question in detail..."
              value={question}
              onChange={e => setQuestion(e.target.value)}
              rows={4}
            />
            <Button onClick={sendQuestion} disabled={!selectedDoctor || !question.trim() || sending} style={{ alignSelf: "flex-end" }}>
              <Send size={14} style={{ marginRight: 6 }} />
              {sending ? "Sending..." : "Send Question"}
            </Button>
          </div>
        )}
      </div>

      {/* History */}
      {loading ? (
        <p style={{ fontSize: 13, color: "#94a3b8", textAlign: "center" }}>Loading...</p>
      ) : consultations.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 24px", color: "#94a3b8", fontSize: 13 }}>No consultations yet</div>
      ) : consultations.map(c => (
        <ConsultationCard key={c.id} c={c} role="patient" />
      ))}
    </div>
  );
}

// Doctor view: see questions from patients and answer them
export function DoctorTeleconsultation() {
  const { user } = useAuth();
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [answering, setAnswering] = useState<{ id: string; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getDocs(query(collection(db, "consultations"), where("doctorId", "==", user.uid), orderBy("createdAt", "desc")))
      .then(snap => setConsultations(snap.docs.map(d => ({ id: d.id, ...d.data() } as Consultation))))
      .finally(() => setLoading(false));
  }, [user]);

  const submitAnswer = async () => {
    if (!answering || !answering.text.trim()) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "consultations", answering.id), {
        answer: answering.text.trim(),
        status: "answered",
        answeredAt: new Date().toISOString(),
      });
      setConsultations(prev => prev.map(c => c.id === answering.id ? { ...c, answer: answering.text.trim(), status: "answered" as const } : c));
      setAnswering(null);
    } finally { setSaving(false); }
  };

  if (loading) return <p style={{ fontSize: 13, color: "#94a3b8", textAlign: "center", padding: 32 }}>Loading...</p>;

  if (consultations.length === 0) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "52px 24px" }}>
      <div style={{ width: 56, height: 56, borderRadius: 16, background: "linear-gradient(135deg, #ede9fe, #dbeafe)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <MessageCircle size={24} style={{ color: "#7c3aed" }} />
      </div>
      <p style={{ fontSize: 14, color: "#94a3b8", margin: 0 }}>No patient consultations yet</p>
    </div>
  );

  return (
    <div style={{ maxWidth: 700 }}>
      {consultations.map(c => (
        <div key={c.id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: 18, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, #ede9fe, #dbeafe)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#7c3aed" }}>
                {c.patientName[0]}
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", margin: 0 }}>{c.patientName}</p>
                <p style={{ fontSize: 11, color: "#94a3b8", margin: 0 }}>{new Date(c.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: c.status === "answered" ? "#dcfce7" : "#fef3c7", color: c.status === "answered" ? "#16a34a" : "#d97706" }}>
              {c.status === "answered" ? "Answered" : "Pending"}
            </span>
          </div>

          <div style={{ background: "#f8fafc", borderRadius: 10, padding: 12, marginBottom: 10 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8", margin: "0 0 4px" }}>QUESTION</p>
            <p style={{ fontSize: 13, color: "#0f172a", margin: 0, lineHeight: 1.5 }}>{c.question}</p>
          </div>

          {c.status === "answered" && c.answer && (
            <div style={{ background: "#f0fdf4", borderRadius: 10, padding: 12, border: "1px solid #bbf7d0" }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#16a34a", margin: "0 0 4px" }}>YOUR ANSWER</p>
              <p style={{ fontSize: 13, color: "#0f172a", margin: 0, lineHeight: 1.5 }}>{c.answer}</p>
            </div>
          )}

          {c.status === "pending" && (
            answering?.id === c.id ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <textarea
                  value={answering.text}
                  onChange={e => setAnswering({ id: c.id, text: e.target.value })}
                  placeholder="Type your medical response..."
                  rows={3}
                  style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, resize: "vertical", fontFamily: "inherit" }}
                />
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <Button variant="outline" onClick={() => setAnswering(null)} size="sm">Cancel</Button>
                  <Button onClick={submitAnswer} disabled={!answering.text.trim() || saving} size="sm">
                    {saving ? "Saving..." : "Send Answer"}
                  </Button>
                </div>
              </div>
            ) : (
              <Button onClick={() => setAnswering({ id: c.id, text: "" })} size="sm" style={{ marginTop: 4 }}>
                Answer
              </Button>
            )
          )}
        </div>
      ))}
    </div>
  );
}

function ConsultationCard({ c, role }: { c: Consultation; role: "patient" | "doctor" }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: 18, marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", margin: 0 }}>
            {role === "patient" ? `Dr. ${c.doctorName}` : c.patientName}
          </p>
          <p style={{ fontSize: 11, color: "#94a3b8", margin: 0 }}>{new Date(c.createdAt).toLocaleDateString()}</p>
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: c.status === "answered" ? "#dcfce7" : "#fef3c7", color: c.status === "answered" ? "#16a34a" : "#d97706" }}>
          {c.status === "answered" ? <><CheckCheck size={10} style={{ display: "inline", marginRight: 3 }} />Answered</> : <><Clock size={10} style={{ display: "inline", marginRight: 3 }} />Pending</>}
        </span>
      </div>
      <div style={{ background: "#f8fafc", borderRadius: 10, padding: 12, marginBottom: c.answer ? 10 : 0 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8", margin: "0 0 4px" }}>YOUR QUESTION</p>
        <p style={{ fontSize: 13, color: "#0f172a", margin: 0, lineHeight: 1.5 }}>{c.question}</p>
      </div>
      {c.answer && (
        <div style={{ background: "#f0fdf4", borderRadius: 10, padding: 12, border: "1px solid #bbf7d0" }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "#16a34a", margin: "0 0 4px" }}>DOCTOR'S ANSWER</p>
          <p style={{ fontSize: 13, color: "#0f172a", margin: 0, lineHeight: 1.5 }}>{c.answer}</p>
        </div>
      )}
    </div>
  );
}
