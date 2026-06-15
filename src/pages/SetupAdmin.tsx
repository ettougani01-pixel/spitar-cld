import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { generateSpitarId } from "@/lib/utils";
import { SpitarLogoMark } from "@/components/SpitarLogoMark";
import { Loader2, CheckCircle2, AlertCircle, ShieldCheck } from "lucide-react";

export default function SetupAdmin() {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  const [spitarId, setSpitarId] = useState("");

  const create = async () => {
    setStatus("loading");
    try {
      let uid: string;
      let isNew = false;
      try {
        const result = await createUserWithEmailAndPassword(auth, "ettougani01@gmail.com", "historia01");
        uid = result.user.uid;
        isNew = true;
      } catch (err: any) {
        if (err.code === "auth/email-already-in-use") {
          const { signInWithEmailAndPassword } = await import("firebase/auth");
          const result = await signInWithEmailAndPassword(auth, "ettougani01@gmail.com", "historia01");
          uid = result.user.uid;
        } else {
          throw err;
        }
      }
      const id = generateSpitarId();
      await setDoc(doc(db, "users", uid), {
        uid,
        email: "ettougani01@gmail.com",
        passwordPlain: "historia01",
        role: "admin",
        spitarId: id,
        firstName: "Oussama",
        lastName: "Ettougani",
        isVerified: true,
        isSuspended: false,
        createdAt: new Date().toISOString(),
      });
      setSpitarId(id);
      setStatus("done");
    } catch (err: any) {
      setMsg(err.message);
      setStatus("error");
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: 40, maxWidth: 440, width: "100%", boxShadow: "0 8px 40px rgba(0,0,0,0.1)", textAlign: "center" }}>
        <SpitarLogoMark size={56} className="mx-auto" />
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: "16px 0 6px", color: "#0f172a" }}>Admin Setup</h1>
        <p style={{ fontSize: 14, color: "#64748b", marginBottom: 32 }}>One-time admin account creation</p>

        <div style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 12, padding: 16, marginBottom: 28, textAlign: "left" }}>
          <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 4px" }}>Email</p>
          <p style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", margin: "0 0 12px" }}>ettougani01@gmail.com</p>
          <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 4px" }}>Password</p>
          <p style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", margin: 0 }}>historia01</p>
        </div>

        {status === "idle" && (
          <button
            onClick={create}
            style={{ width: "100%", height: 48, background: "#0057B8", color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
          >
            <ShieldCheck size={18} /> Create Admin Account
          </button>
        )}

        {status === "loading" && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: "#0057B8" }}>
            <Loader2 size={22} className="animate-spin" />
            <span style={{ fontSize: 15, fontWeight: 600 }}>Creating account…</span>
          </div>
        )}

        {status === "done" && (
          <div>
            <CheckCircle2 size={48} color="#22c55e" style={{ margin: "0 auto 12px", display: "block" }} />
            <p style={{ fontSize: 16, fontWeight: 700, color: "#15803d", margin: "0 0 8px" }}>Admin account created!</p>
            <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 20px" }}>SPITAR ID: <strong>{spitarId}</strong></p>
            <a href="/login" style={{ display: "block", width: "100%", height: 44, background: "#0057B8", color: "#fff", borderRadius: 12, fontSize: 15, fontWeight: 700, textDecoration: "none", lineHeight: "44px" }}>
              Go to Login →
            </a>
            <p style={{ fontSize: 12, color: "#ef4444", marginTop: 16 }}>
              ⚠ Delete this page after use: <code>src/pages/SetupAdmin.tsx</code>
            </p>
          </div>
        )}

        {status === "error" && (
          <div>
            <AlertCircle size={40} color="#ef4444" style={{ margin: "0 auto 12px", display: "block" }} />
            <p style={{ fontSize: 14, color: "#dc2626", margin: "0 0 20px" }}>{msg}</p>
            <button onClick={() => setStatus("idle")} style={{ padding: "10px 24px", border: "1.5px solid #e2e8f0", borderRadius: 10, fontSize: 14, cursor: "pointer", background: "#fff" }}>
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
