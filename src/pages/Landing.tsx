import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { collection, query, where, getDocs, limit, getCountFromServer } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import {
  Users, FlaskConical, Stethoscope, Search, MapPin,
  FileText, Phone, Building2, ArrowRight, Lock,
  CheckCircle2, Heart, ShieldCheck, Zap, Star,
} from "lucide-react";
import { SpitarLogoMark } from "@/components/SpitarLogoMark";
import { cn } from "@/lib/utils";
import type { DoctorProfile, LabProfile } from "@/lib/types";

function useCountUp(target: number, duration = 2000, started = false): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!started || target === 0) { setCount(0); return; }
    let startTime: number | null = null;
    let raf: number;
    const step = (ts: number) => {
      if (!startTime) startTime = ts;
      const progress = Math.min((ts - startTime) / duration, 1);
      setCount(Math.round((1 - Math.pow(1 - progress, 3)) * target));
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, started]);
  return count;
}

const CITIES = ["Casablanca","Rabat","Fès","Marrakech","Agadir","Tanger","Meknès","Oujda","Kénitra","Tétouan","Salé"];
type Tab = "doctors" | "labs" | "hospitals";

export default function Landing() {
  const { t } = useTranslation();
  const statsRef = useRef<HTMLDivElement>(null);
  const [statsStarted, setStatsStarted] = useState(false);
  const [tab, setTab] = useState<Tab>("doctors");
  const [specialty, setSpecialty] = useState("");
  const [city, setCity] = useState("");
  const [searching, setSearching] = useState(false);
  const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
  const [labs, setLabs] = useState<LabProfile[]>([]);
  const [searched, setSearched] = useState(false);
  const [stats, setStats] = useState({ p: 10000, d: 500, h: 120, l: 80 });

  const pC = useCountUp(stats.p, 2000, statsStarted);
  const dC = useCountUp(stats.d, 2000, statsStarted);
  const hC = useCountUp(stats.h, 2000, statsStarted);
  const lC = useCountUp(stats.l, 2000, statsStarted);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setStatsStarted(true); }, { threshold: 0.3 });
    if (statsRef.current) obs.observe(statsRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    getCountFromServer(query(collection(db, "users"), where("role", "==", "patient"))).then(s => setStats(prev => ({ ...prev, p: Math.max(s.data().count, 10000) }))).catch(() => {});
    getCountFromServer(query(collection(db, "users"), where("role", "==", "doctor"))).then(s => setStats(prev => ({ ...prev, d: Math.max(s.data().count, 500) }))).catch(() => {});
  }, []);

  const doSearch = async () => {
    setSearching(true); setSearched(true);
    try {
      if (tab === "doctors") {
        let q = query(collection(db, "users"), where("role", "==", "doctor"), where("isVerified", "==", true), limit(12));
        if (city) q = query(q, where("city", "==", city));
        const snap = await getDocs(q);
        let res = snap.docs.map(d => d.data() as DoctorProfile);
        if (specialty) res = res.filter(d => d.specialty?.toLowerCase().includes(specialty.toLowerCase()));
        setDoctors(res); setLabs([]);
      } else {
        let q = query(collection(db, "users"), where("role", "==", "lab"), where("isVerified", "==", true), limit(12));
        if (city) q = query(q, where("city", "==", city));
        const snap = await getDocs(q);
        setLabs(snap.docs.map(d => d.data() as LabProfile)); setDoctors([]);
      }
    } catch { /* ignore */ } finally { setSearching(false); }
  };

  const AVATAR_COLORS = ["#0057B8","#00B4C8","#7c3aed","#d97706","#dc2626"];

  return (
    <div style={{ minHeight: "100vh", background: "#fff" }}>
      <Navbar />

      {/* ─── HERO ──────────────────────────────────────────────────────── */}
      <div style={{ background: "linear-gradient(135deg, #003580 0%, #0057B8 50%, #00B4C8 100%)", padding: "64px 16px 0" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center" }}>

          {/* Badge */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 999, padding: "6px 16px", marginBottom: 24 }}>
            <Heart size={14} color="#fca5a5" fill="#fca5a5" />
            <span style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>{t("landing.badge")}</span>
          </div>

          {/* Title */}
          <h1 style={{ color: "#fff", fontSize: "clamp(36px, 6vw, 64px)", fontWeight: 900, lineHeight: 1.08, letterSpacing: "-1px", marginBottom: 20 }}>
            Your Health. Your Data.<br />
            <span style={{ color: "#7ee8f5" }}>Your Control.</span>
          </h1>

          {/* Subtitle */}
          <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 18, lineHeight: 1.6, maxWidth: 540, margin: "0 auto 40px" }}>
            {t("landing.hero_subtitle")}
          </p>

          {/* ── SEARCH CARD ─────────────────────────────────────────────── */}
          <div style={{ background: "#fff", borderRadius: 24, padding: "20px 24px", boxShadow: "0 8px 40px rgba(0,0,0,0.18)", marginBottom: 28, maxWidth: 760, marginLeft: "auto", marginRight: "auto" }}>
            {/* Tabs — pill style */}
            <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 18 }}>
              {(["doctors","labs","hospitals"] as Tab[]).map(tp => (
                <button key={tp} onClick={() => { setTab(tp); setSearched(false); setDoctors([]); setLabs([]); }} style={{
                  padding: "8px 24px", borderRadius: 999, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600, transition: "all 0.2s",
                  background: tab === tp ? "#0057B8" : "transparent",
                  color: tab === tp ? "#fff" : "#64748b",
                }}>
                  {t(`common.${tp}`)}
                </button>
              ))}
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: "#f1f5f9", marginBottom: 18 }} />

            {/* Search inputs */}
            {tab === "hospitals" ? (
              <div style={{ textAlign: "center", padding: "20px 0", color: "#94a3b8" }}>
                <Building2 size={28} style={{ margin: "0 auto 8px", opacity: 0.4, display: "block" }} />
                <p style={{ fontSize: 14, margin: 0 }}>Hospital search coming soon.</p>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {tab === "doctors" && (
                  <div style={{ flex: 1, minWidth: 200, display: "flex", alignItems: "center", gap: 10, border: "1.5px solid #e2e8f0", borderRadius: 12, padding: "0 14px", background: "#fff" }}>
                    <Stethoscope size={16} color="#0057B8" style={{ flexShrink: 0 }} />
                    <input
                      style={{ flex: 1, height: 46, border: "none", outline: "none", fontSize: 14, color: "#0f172a", background: "transparent" }}
                      placeholder={t("landing.search_specialty_placeholder")}
                      value={specialty}
                      onChange={e => setSpecialty(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && doSearch()}
                    />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 200, display: "flex", alignItems: "center", gap: 10, border: "1.5px solid #e2e8f0", borderRadius: 12, padding: "0 14px", background: "#fff" }}>
                  <MapPin size={16} color="#0057B8" style={{ flexShrink: 0 }} />
                  <select
                    style={{ flex: 1, height: 46, border: "none", outline: "none", fontSize: 14, color: city ? "#0f172a" : "#94a3b8", background: "transparent", cursor: "pointer" }}
                    value={city}
                    onChange={e => setCity(e.target.value)}
                  >
                    <option value="">{t("landing.search_city_placeholder")}</option>
                    {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <button
                  onClick={doSearch}
                  disabled={searching}
                  style={{ height: 46, padding: "0 28px", background: "#0057B8", color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap", flexShrink: 0 }}
                >
                  <Search size={16} />
                  {t("landing.search_btn")}
                </button>
              </div>
            )}
          </div>

          {/* CTA buttons — match Replit style exactly */}
          <div style={{ display: "flex", gap: 14, justifyContent: "center", paddingBottom: 72 }}>
            <Link to="/register">
              <button style={{ height: 46, padding: "0 28px", background: "rgba(255,255,255,0.15)", color: "#fff", border: "1.5px solid rgba(255,255,255,0.5)", borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, backdropFilter: "blur(4px)" }}>
                {t("landing.hero_cta")} <ArrowRight size={15} />
              </button>
            </Link>
            <Link to="/login">
              <button style={{ height: 46, padding: "0 24px", background: "transparent", color: "rgba(255,255,255,0.85)", border: "none", fontSize: 15, fontWeight: 500, cursor: "pointer" }}>
                {t("landing.hero_cta2")}
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* ─── SEARCH RESULTS ────────────────────────────────────────────── */}
      {searched && (
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 16px" }}>
          {tab === "doctors" && (
            <>
              <p style={{ fontSize: 14, color: "#64748b", marginBottom: 20 }}>
                {doctors.length > 0 ? `${doctors.length} ${t("landing.doctors_found")}` : t("landing.no_doctors_found")}
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
                {doctors.map((doc, i) => (
                  <div key={doc.uid} style={{ background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 16, padding: 20, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                      <div style={{ width: 48, height: 48, borderRadius: 14, background: AVATAR_COLORS[i % 5] + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: AVATAR_COLORS[i % 5], flexShrink: 0 }}>
                        {doc.firstName?.[0]}{doc.lastName?.[0]}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: 700, fontSize: 15, margin: 0 }}>Dr. {doc.firstName} {doc.lastName}</p>
                        <p style={{ fontSize: 13, color: AVATAR_COLORS[i % 5], margin: "2px 0 0", fontWeight: 600 }}>{doc.specialty}</p>
                      </div>
                      {doc.isVerified && <CheckCircle2 size={18} color="#22c55e" />}
                    </div>
                    {doc.city && <p style={{ fontSize: 13, color: "#64748b", display: "flex", alignItems: "center", gap: 4, margin: "0 0 14px" }}><MapPin size={12} />{doc.city}</p>}
                    <Link to={`/book?doctorId=${doc.uid}`}>
                      <button style={{ width: "100%", height: 38, background: "#0057B8", color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                        {t("landing.book_now")}
                      </button>
                    </Link>
                  </div>
                ))}
              </div>
            </>
          )}
          {tab === "labs" && (
            <>
              <p style={{ fontSize: 14, color: "#64748b", marginBottom: 20 }}>
                {labs.length > 0 ? `${labs.length} ${t("landing.labs_found")}` : t("landing.no_labs_found")}
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                {labs.map(lab => (
                  <div key={lab.uid} style={{ background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 16, padding: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                      <div style={{ width: 46, height: 46, borderRadius: 12, background: "#f0fdfa", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <FlaskConical size={22} color="#0d9488" />
                      </div>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: 14, margin: 0 }}>{lab.name || `${lab.firstName} Lab`}</p>
                        {lab.city && <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0", display: "flex", alignItems: "center", gap: 4 }}><MapPin size={11} />{lab.city}</p>}
                      </div>
                      {lab.isVerified && <CheckCircle2 size={16} color="#22c55e" style={{ marginLeft: "auto", flexShrink: 0 }} />}
                    </div>
                    {lab.phone && (
                      <a href={`tel:${lab.phone}`} style={{ textDecoration: "none" }}>
                        <button style={{ width: "100%", height: 36, background: "#f8fafc", color: "#0057B8", border: "1.5px solid #e2e8f0", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                          <Phone size={13} /> {t("landing.contact_lab")}
                        </button>
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── STATS ─────────────────────────────────────────────────────── */}
      <div ref={statsRef} style={{ background: "#f8fafc", padding: "72px 16px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
          <p style={{ fontSize: 11, fontWeight: 800, color: "#0057B8", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 48 }}>
            {t("landing.stat_trust")}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 32 }}>
            {[
              { n: pC, label: t("landing.stat_patients"), sub: t("landing.stat_patients_sub"), color: "#0057B8", bg: "#eff6ff", Icon: Users },
              { n: dC, label: t("landing.stat_doctors"), sub: t("landing.stat_doctors_sub"), color: "#0891b2", bg: "#ecfeff", Icon: Stethoscope },
              { n: hC, label: t("landing.stat_hospitals"), sub: t("landing.stat_hospitals_sub"), color: "#7c3aed", bg: "#f5f3ff", Icon: Building2 },
              { n: lC, label: t("landing.stat_labs"), sub: t("landing.stat_labs_sub"), color: "#d97706", bg: "#fffbeb", Icon: FlaskConical },
            ].map(({ n, label, sub, color, bg, Icon }) => (
              <div key={label} style={{ textAlign: "center" }}>
                <div style={{ width: 64, height: 64, borderRadius: 18, background: bg, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                  <Icon size={30} color={color} />
                </div>
                <div style={{ fontSize: 38, fontWeight: 900, color, lineHeight: 1 }}>+{n.toLocaleString()}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginTop: 8 }}>{label}</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── FEATURES ──────────────────────────────────────────────────── */}
      <div style={{ padding: "72px 16px", background: "#fff" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <h2 style={{ fontSize: 38, fontWeight: 900, color: "#0f172a", margin: "0 0 12px" }}>{t("landing.features_title")}</h2>
            <p style={{ fontSize: 17, color: "#64748b", maxWidth: 500, margin: "0 auto" }}>{t("landing.features_subtitle")}</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>
            {[
              { Icon: Lock, title: t("landing.feat_consent_title"), desc: t("landing.feat_consent_desc"), color: "#0057B8", bg: "#eff6ff", border: "#bfdbfe" },
              { Icon: FlaskConical, title: t("landing.feat_labs_title"), desc: t("landing.feat_labs_desc"), color: "#0891b2", bg: "#ecfeff", border: "#a5f3fc" },
              { Icon: FileText, title: t("landing.feat_records_title"), desc: t("landing.feat_records_desc"), color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
            ].map(({ Icon, title, desc, color, bg, border }) => (
              <div key={title} style={{ background: "#fff", border: `2px solid ${border}`, borderRadius: 20, padding: 32, transition: "box-shadow 0.2s" }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 12px 40px rgba(0,0,0,0.1)")}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}
              >
                <div style={{ width: 56, height: 56, borderRadius: 16, background: bg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
                  <Icon size={26} color={color} />
                </div>
                <h3 style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", margin: "0 0 10px" }}>{title}</h3>
                <p style={{ fontSize: 15, color: "#64748b", lineHeight: 1.65, margin: 0 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── HOW IT WORKS ──────────────────────────────────────────────── */}
      <div style={{ background: "#f8fafc", padding: "72px 16px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontSize: 38, fontWeight: 900, color: "#0f172a", margin: "0 0 12px" }}>{t("landing.how_it_works")}</h2>
          <p style={{ fontSize: 17, color: "#64748b", marginBottom: 56 }}>Simple, secure, and patient-first.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 40 }}>
            {[
              { step: "01", Icon: Users, title: t("landing.step1"), desc: t("landing.step1_desc"), bg: "#0057B8" },
              { step: "02", Icon: ShieldCheck, title: t("landing.step2"), desc: t("landing.step2_desc"), bg: "#0891b2" },
              { step: "03", Icon: Zap, title: t("landing.step3"), desc: t("landing.step3_desc"), bg: "#7c3aed" },
            ].map(({ step, Icon, title, desc, bg }) => (
              <div key={step} style={{ textAlign: "center" }}>
                <div style={{ width: 64, height: 64, borderRadius: 9999, background: bg, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", boxShadow: `0 8px 24px ${bg}55` }}>
                  <Icon size={28} color="#fff" />
                </div>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#94a3b8", letterSpacing: "0.15em", marginBottom: 6 }}>STEP {step}</div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", margin: "0 0 8px" }}>{title}</h3>
                <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.6, margin: 0 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── CTA BANNER ────────────────────────────────────────────────── */}
      <div style={{ background: "linear-gradient(135deg, #003580 0%, #0057B8 100%)", padding: "72px 16px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -80, right: -80, width: 300, height: 300, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
        <div style={{ position: "relative", maxWidth: 600, margin: "0 auto" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 999, padding: "6px 16px", marginBottom: 24 }}>
            <Star size={13} color="#fbbf24" fill="#fbbf24" />
            <span style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>Trusted by thousands across Morocco</span>
          </div>
          <h2 style={{ color: "#fff", fontSize: 40, fontWeight: 900, margin: "0 0 16px", lineHeight: 1.1 }}>{t("landing.cta_banner_title")}</h2>
          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 17, marginBottom: 40 }}>{t("landing.cta_banner_subtitle")}</p>
          <Link to="/register">
            <button style={{ height: 52, padding: "0 40px", background: "#fff", color: "#0057B8", border: "none", borderRadius: 14, fontSize: 16, fontWeight: 800, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.25)" }}>
              {t("landing.hero_cta")} <ArrowRight size={18} />
            </button>
          </Link>
        </div>
      </div>

      {/* ─── FOOTER ────────────────────────────────────────────────────── */}
      <footer style={{ background: "#0a1628", padding: "40px 16px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <SpitarLogoMark size={32} />
            <div>
              <p style={{ color: "#fff", fontWeight: 800, fontSize: 17, margin: 0 }}>
                SPITAR <span style={{ color: "#00B4C8" }}>CLD</span>
              </p>
              <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, margin: "2px 0 0" }}>Healthcare Platform for Morocco</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 24 }}>
            <Link to="/login" style={{ color: "rgba(255,255,255,0.45)", fontSize: 14, textDecoration: "none" }}>Login</Link>
            <Link to="/register" style={{ color: "rgba(255,255,255,0.45)", fontSize: 14, textDecoration: "none" }}>Register</Link>
          </div>
        </div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", marginTop: 32, paddingTop: 24, textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: 12 }}>
          © 2026 SPITAR Healthcare Platform. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
