import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { SpitarLogoMark } from "@/components/SpitarLogoMark";
import { Eye, EyeOff, Loader2, Mail, Lock, CheckCircle2, Heart, Shield, Zap } from "lucide-react";

const inp: React.CSSProperties = {
  width: "100%", height: 48, padding: "0 14px 0 42px",
  border: "1.5px solid #e2e8f0", borderRadius: 12,
  fontSize: 14, outline: "none", boxSizing: "border-box",
  background: "#f8fafc", color: "#0f172a", transition: "border-color 0.15s",
};

type LoginMode = "password" | "magic";

export default function Login() {
  const { t } = useTranslation();
  const { login, sendMagicLink } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<LoginMode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [magicSent, setMagicSent] = useState(false);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err: any) {
      if (err.message === "SUSPENDED") setError(t("auth.suspended"));
      else if (err.code === "auth/invalid-credential" || err.code === "auth/user-not-found") setError(t("auth.invalid_credential"));
      else setError(err.message ?? t("auth.invalid_credential"));
    } finally { setLoading(false); }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    try { await sendMagicLink(email); setMagicSent(true); }
    catch (err: any) { setError(err.message ?? t("auth.magic_link_failed")); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex" }}>
      {/* Left panel — gradient */}
      <div style={{
        width: "45%", background: "linear-gradient(160deg, #1e3a8a 0%, #2563eb 50%, #06b6d4 100%)",
        display: "flex", flexDirection: "column", justifyContent: "space-between",
        padding: "48px 40px", position: "relative", overflow: "hidden",
      }} className="hidden lg:flex">
        {/* Decorative circles */}
        <div style={{ position: "absolute", top: -80, right: -80, width: 300, height: 300, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
        <div style={{ position: "absolute", bottom: -60, left: -60, width: 240, height: 240, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <SpitarLogoMark size={40} />
          <span style={{ fontSize: 22, fontWeight: 800, color: "#fff", letterSpacing: -0.5 }}>SPITAR</span>
        </div>

        {/* Middle content */}
        <div>
          <h2 style={{ fontSize: 32, fontWeight: 800, color: "#fff", lineHeight: 1.2, marginBottom: 16 }}>
            Your health,<br />in safe hands.
          </h2>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.75)", lineHeight: 1.7, marginBottom: 40 }}>
            Connecting patients, doctors, hospitals, and labs in one secure platform.
          </p>
          {/* Feature pills */}
          {[
            { icon: Shield, text: "Secure & GDPR-compliant" },
            { icon: Heart, text: "Emergency QR access" },
            { icon: Zap, text: "Real-time health records" },
          ].map(({ icon: Icon, text }) => (
            <div key={text} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon size={15} style={{ color: "#fff" }} />
              </div>
              <span style={{ fontSize: 14, color: "rgba(255,255,255,0.85)", fontWeight: 500 }}>{text}</span>
            </div>
          ))}
        </div>

        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>© 2026 SPITAR CLD · Healthcare Platform for Morocco</p>
      </div>

      {/* Right panel — form */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 24px", background: "#f8fafc", overflowY: "auto" }}>
        <div style={{ width: "100%", maxWidth: 420 }}>
          {/* Mobile logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32 }} className="lg:hidden">
            <SpitarLogoMark size={36} />
            <span style={{ fontSize: 20, fontWeight: 800, color: "#0f172a" }}>SPITAR</span>
          </div>

          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", margin: "0 0 6px" }}>{t("auth.login")}</h1>
          <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 28px" }}>{t("auth.login_subtitle")}</p>

          {/* Mode tabs */}
          <div style={{ display: "flex", background: "#e2e8f0", borderRadius: 12, padding: 4, marginBottom: 24, gap: 4 }}>
            {([["password", Lock, t("auth.password_tab")], ["magic", Mail, t("auth.magic_link_tab")]] as const).map(([m, Icon, label]) => (
              <button key={m} type="button"
                onClick={() => { setMode(m as LoginMode); setError(""); setMagicSent(false); }}
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  padding: "9px 0", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none",
                  background: mode === m ? "#fff" : "transparent",
                  color: mode === m ? "#0f172a" : "#64748b",
                  boxShadow: mode === m ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
                  transition: "all 0.15s",
                }}>
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>

          {error && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px", marginBottom: 20, fontSize: 13, color: "#dc2626", display: "flex", gap: 8, alignItems: "center" }}>
              ⚠️ {error}
            </div>
          )}

          {/* Password form */}
          {mode === "password" && (
            <form onSubmit={handlePasswordLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ position: "relative" }}>
                <Mail size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                <input style={inp} type="email" placeholder={t("auth.email")} value={email}
                  onChange={e => setEmail(e.target.value)} required autoComplete="email"
                  onFocus={e => (e.target.style.borderColor = "#2563eb")} onBlur={e => (e.target.style.borderColor = "#e2e8f0")} />
              </div>
              <div style={{ position: "relative" }}>
                <Lock size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                <input style={{ ...inp, paddingRight: 44 }} type={showPw ? "text" : "password"}
                  placeholder={t("auth.password")} value={password}
                  onChange={e => setPassword(e.target.value)} required autoComplete="current-password"
                  onFocus={e => (e.target.style.borderColor = "#2563eb")} onBlur={e => (e.target.style.borderColor = "#e2e8f0")} />
                <button type="button" onClick={() => setShowPw(p => !p)}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 2 }}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div style={{ textAlign: "right", marginTop: -8 }}>
                <Link to="/forgot-password" style={{ fontSize: 13, color: "#2563eb", textDecoration: "none", fontWeight: 500 }}>
                  {t("auth.forgot_password")}
                </Link>
              </div>
              <button type="submit" disabled={loading} style={{
                height: 50, background: "linear-gradient(135deg, #1e3a8a, #2563eb)",
                color: "#fff", border: "none", borderRadius: 14,
                fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                boxShadow: "0 4px 14px rgba(37,99,235,0.35)", opacity: loading ? 0.8 : 1,
              }}>
                {loading ? <><Loader2 size={16} className="animate-spin" /> {t("common.loading")}</> : t("auth.login")}
              </button>
            </form>
          )}

          {/* Magic link form */}
          {mode === "magic" && (
            <form onSubmit={handleMagicLink}>
              {magicSent ? (
                <div style={{ textAlign: "center", padding: "32px 0" }}>
                  <div style={{ width: 64, height: 64, borderRadius: 20, background: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                    <CheckCircle2 size={32} style={{ color: "#16a34a" }} />
                  </div>
                  <p style={{ fontSize: 18, fontWeight: 700, color: "#15803d", marginBottom: 8 }}>{t("auth.magic_link_sent_title")}</p>
                  <p style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>{t("auth.magic_link_sent_desc", { email })}</p>
                  <button type="button" onClick={() => { setMagicSent(false); setEmail(""); }}
                    style={{ fontSize: 13, color: "#2563eb", background: "none", border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "8px 20px", cursor: "pointer", fontWeight: 600 }}>
                    {t("auth.magic_link_different")}
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 12, padding: "12px 16px", fontSize: 13, color: "#1e40af" }}>
                    ✉️ {t("auth.magic_link_desc")}
                  </div>
                  <div style={{ position: "relative" }}>
                    <Mail size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                    <input style={inp} type="email" placeholder="you@example.com" value={email}
                      onChange={e => setEmail(e.target.value)} required autoFocus
                      onFocus={e => (e.target.style.borderColor = "#2563eb")} onBlur={e => (e.target.style.borderColor = "#e2e8f0")} />
                  </div>
                  <button type="submit" disabled={loading || !email} style={{
                    height: 50, background: "linear-gradient(135deg, #1e3a8a, #2563eb)",
                    color: "#fff", border: "none", borderRadius: 14,
                    fontSize: 15, fontWeight: 700, cursor: (loading || !email) ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    boxShadow: "0 4px 14px rgba(37,99,235,0.35)", opacity: (loading || !email) ? 0.7 : 1,
                  }}>
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Mail size={15} />}
                    {t("auth.send_magic_link")}
                  </button>
                </div>
              )}
            </form>
          )}

          <p style={{ textAlign: "center", fontSize: 13, color: "#64748b", marginTop: 24 }}>
            {t("auth.no_account")}{" "}
            <Link to="/register" style={{ color: "#2563eb", fontWeight: 700, textDecoration: "none" }}>
              {t("auth.register")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
