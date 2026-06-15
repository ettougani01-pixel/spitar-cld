import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/Navbar";
import { Loader2, CheckCircle2, Mail, ArrowLeft } from "lucide-react";
import { SpitarLogoMark } from "@/components/SpitarLogoMark";

export default function ForgotPassword() {
  const { t } = useTranslation();
  const { forgotPassword } = useAuth();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await forgotPassword(email);
      setSent(true);
    } catch (err: any) {
      setError(err.message ?? "Failed to send reset email");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <Navbar />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 64px)", padding: "32px 16px" }}>
        <div style={{ width: "100%", maxWidth: 420, background: "#fff", borderRadius: 20, border: "1px solid #e2e8f0", boxShadow: "0 4px 24px rgba(0,0,0,0.07)", overflow: "hidden" }}>
          {/* Top gradient accent */}
          <div style={{ height: 5, background: "linear-gradient(135deg, #1e3a8a, #2563eb, #06b6d4)" }} />

          <div style={{ padding: "36px 32px" }}>
            {/* Logo + title */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 28 }}>
              <SpitarLogoMark size={48} />
              <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: "16px 0 4px" }}>{t("auth.reset_password")}</h1>
              <p style={{ fontSize: 14, color: "#64748b", textAlign: "center" }}>Enter your email to receive a reset link</p>
            </div>

            {sent ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "12px 0" }}>
                <div style={{ width: 64, height: 64, borderRadius: 20, background: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <CheckCircle2 size={32} style={{ color: "#16a34a" }} />
                </div>
                <p style={{ fontSize: 14, color: "#64748b", textAlign: "center", lineHeight: 1.6 }}>
                  Password reset link sent to <strong style={{ color: "#0f172a" }}>{email}</strong>. Check your inbox.
                </p>
                <Link to="/login" style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", height: 48, borderRadius: 14, background: "linear-gradient(135deg, #1e3a8a, #2563eb)", color: "#fff", textDecoration: "none", fontSize: 15, fontWeight: 700, justifyContent: "center", boxShadow: "0 4px 14px rgba(37,99,235,0.3)" }}>
                  <ArrowLeft size={16} /> {t("auth.back_to_login")}
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {error && (
                  <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#dc2626", display: "flex", gap: 8, alignItems: "center" }}>
                    ⚠️ {error}
                  </div>
                )}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "flex", alignItems: "center", gap: 4, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                    <Mail size={11} /> {t("auth.email")}
                  </label>
                  <div style={{ position: "relative" }}>
                    <Mail size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                    <input
                      type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email"
                      style={{ width: "100%", height: 48, paddingLeft: 42, paddingRight: 14, border: "1.5px solid #e2e8f0", borderRadius: 12, fontSize: 14, outline: "none", background: "#f8fafc", color: "#0f172a", boxSizing: "border-box", transition: "border-color 0.15s" }}
                      onFocus={e => (e.target.style.borderColor = "#2563eb")} onBlur={e => (e.target.style.borderColor = "#e2e8f0")}
                    />
                  </div>
                </div>

                <button type="submit" disabled={loading || !email} style={{
                  height: 50, background: "linear-gradient(135deg, #1e3a8a, #2563eb)", color: "#fff", border: "none",
                  borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: (loading || !email) ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  boxShadow: "0 4px 14px rgba(37,99,235,0.35)", opacity: (loading || !email) ? 0.75 : 1,
                }}>
                  {loading ? <><Loader2 size={16} className="animate-spin" /> Sending…</> : t("auth.send_reset")}
                </button>

                <Link to="/login" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, fontSize: 13, color: "#2563eb", fontWeight: 600, textDecoration: "none" }}>
                  <ArrowLeft size={13} /> {t("auth.back_to_login")}
                </Link>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
