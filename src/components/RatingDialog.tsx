import { useState } from "react";
import { addDoc, collection, query, where, getDocs, updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Star } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  open: boolean;
  onClose: () => void;
  appointmentId: string;
  doctorId: string;
  doctorName: string;
  patientId: string;
  patientName: string;
}

export function RatingDialog({ open, onClose, appointmentId, doctorId, doctorName, patientId, patientName }: Props) {
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (stars === 0) return;
    setSaving(true);
    try {
      await addDoc(collection(db, "doctor_ratings"), {
        doctorId, doctorName, patientId, patientName,
        appointmentId, stars, comment,
        createdAt: new Date().toISOString(),
      });
      // Recalculate average
      const snap = await getDocs(query(collection(db, "doctor_ratings"), where("doctorId", "==", doctorId)));
      const ratings = snap.docs.map(d => d.data().stars as number);
      const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
      await updateDoc(doc(db, "users", doctorId), { ratingAvg: Math.round(avg * 10) / 10, ratingCount: ratings.length });
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent style={{ maxWidth: 420 }}>
        <DialogHeader>
          <DialogTitle>Rate Dr. {doctorName}</DialogTitle>
        </DialogHeader>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "8px 0" }}>
          <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>How was your appointment experience?</p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            {[1, 2, 3, 4, 5].map(s => (
              <button
                key={s}
                onMouseEnter={() => setHover(s)}
                onMouseLeave={() => setHover(0)}
                onClick={() => setStars(s)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
              >
                <Star
                  size={36}
                  fill={(hover || stars) >= s ? "#f59e0b" : "none"}
                  style={{ color: (hover || stars) >= s ? "#f59e0b" : "#d1d5db", transition: "all 0.1s" }}
                />
              </button>
            ))}
          </div>
          {stars > 0 && (
            <p style={{ fontSize: 13, fontWeight: 600, textAlign: "center", color: "#0f172a", margin: 0 }}>
              {["", "Poor", "Fair", "Good", "Very Good", "Excellent"][stars]}
            </p>
          )}
          <Textarea
            placeholder="Leave a comment (optional)"
            value={comment}
            onChange={e => setComment(e.target.value)}
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Skip</Button>
          <Button onClick={submit} disabled={stars === 0 || saving}>
            {saving ? "Submitting..." : "Submit Rating"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function StarDisplay({ avg, count }: { avg: number; count: number }) {
  if (!avg || !count) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <Star size={12} fill="#f59e0b" style={{ color: "#f59e0b" }} />
      <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{avg.toFixed(1)}</span>
      <span style={{ fontSize: 11, color: "#94a3b8" }}>({count})</span>
    </div>
  );
}
