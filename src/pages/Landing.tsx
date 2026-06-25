import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { collection, query, where, getDocs, limit, getCountFromServer } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Navbar } from "@/components/Navbar";
import {
  Users, FlaskConical, Stethoscope, Search, MapPin,
  FileText, Phone, Building2, ArrowRight, Lock,
  CheckCircle2, Heart, ShieldCheck, Zap, Star,
  QrCode, ChevronDown, ChevronUp, Syringe, CalendarCheck,
  ClipboardList, BarChart3, Clock, Smartphone,
} from "lucide-react";
import { SpitarLogoMark } from "@/components/SpitarLogoMark";
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

const TESTIMONIALS = [
  { name: "Fatima Z.", role: "Patiente, Casablanca", avatar: "FZ", color: "#0057B8", rating: 5, text: "أخيراً أستطيع مشاركة ملفي الطبي مع أي طبيب بضغطة واحدة. وفّر عليّ الكثير من الوقت والأوراق." },
  { name: "Dr. Karim B.", role: "Médecin Généraliste, Rabat", avatar: "KB", color: "#0891b2", rating: 5, text: "لوحة التحكم تعطيني الوصول الفوري لسجلات المريض بموافقته. عملي أصبح أسرع وأكثر دقة." },
  { name: "Youssef A.", role: "Patient, Marrakech", avatar: "YA", color: "#7c3aed", rating: 5, text: "بطاقة الطوارئ أنقذت وقتاً ثميناً عند حادث — الطاقم الطبي وصل لمعلوماتي فوراً عبر QR." },
  { name: "Nadia M.", role: "Patiente, Agadir", avatar: "NM", color: "#d97706", rating: 5, text: "تذكيرات الأدوية رائعة. ما عدت أنسى جرعاتي وسجلت كل تطعيمات عائلتي في مكان واحد." },
  { name: "Dr. Samira H.", role: "Cardiologue, Fès", avatar: "SH", color: "#dc2626", rating: 5, text: "النظام يعطيني صورة كاملة عن تاريخ المريض الصحي. يوفر علي الأسئلة المتكررة ويرفع جودة التشخيص." },
  { name: "Omar T.", role: "Patient, Tanger", avatar: "OT", color: "#0d9488", rating: 5, text: "أرسلت رابط ملفي الطبي للطبيب في أقل من دقيقة. مريح جداً خاصة في الحالات المستعجلة." },
];

const PARTNERS = [
  "CHU Ibn Sina", "Clinique Argana", "Polyclinique du Nord", "Lab BioAnalyse",
  "Centre Hospitalier Agadir", "Clinique Yasmine", "Labo MédExpert", "CHU Hassan II",
];

const FAQS = [
  { q: "هل بياناتي الصحية آمنة؟", a: "نعم. كل البيانات مشفّرة ومحفوظة على Firebase من Google. لا يمكن لأي طبيب الوصول لملفك دون موافقتك الصريحة." },
  { q: "هل الخدمة مجانية للمرضى؟", a: "نعم، التسجيل والملف الصحي الرقمي مجانيان تماماً للمرضى. الخطط المدفوعة للعيادات والمستشفيات فقط." },
  { q: "كيف يصل الطبيب لملفي الطبي؟", a: "يمكنك إرسال رابط مؤقت (48 ساعة) مباشرة للطبيب، أو السماح له بالوصول عبر رمز QR في عيادته المعتمدة." },
  { q: "ماذا يحدث في حالة طوارئ؟", a: "بطاقة الطوارئ تُتيح لفريق الإسعاف قراءة معلوماتك الحيوية (فصيلة الدم، الحساسيات، الأدوية) فوراً دون الحاجة لحساب." },
  { q: "هل يمكنني إضافة معلومات عائلتي؟", a: "يمكن إنشاء حساب منفصل لكل فرد من العائلة. ميزة الحساب العائلي الموحد قيد التطوير." },
  { q: "في أي مدن يعمل التطبيق؟", a: "التطبيق متاح في جميع مدن المغرب. قاعدة الأطباء والمختبرات تتوسع باستمرار في الدار البيضاء، الرباط، مراكش، فاس، وأكثر من 8 مدن أخرى." },
];

const SUPPORTED_CITIES = [
  { name: "Casablanca", count: "120+ médecins" },
  { name: "Rabat", count: "80+ médecins" },
  { name: "Marrakech", count: "60+ médecins" },
  { name: "Fès", count: "50+ médecins" },
  { name: "Agadir", count: "35+ médecins" },
  { name: "Tanger", count: "45+ médecins" },
  { name: "Meknès", count: "28+ médecins" },
  { name: "Oujda", count: "22+ médecins" },
];

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
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [partnerOffset, setPartnerOffset] = useState(0);

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

  // Auto-scroll partners ticker
  useEffect(() => {
    const id = setInterval(() => setPartnerOffset(o => (o + 1) % (PARTNERS.length * 180)), 30);
    return () => clearInterval(id);
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
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 999, padding: "6px 16px", marginBottom: 24 }}>
            <Heart size={14} color="#fca5a5" fill="#fca5a5" />
            <span style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>{t("landing.badge")}</span>
          </div>
          <h1 style={{ color: "#fff", fontSize: "clamp(36px, 6vw, 64px)", fontWeight: 900, lineHeight: 1.08, letterSpacing: "-1px", marginBottom: 20 }}>
            Your Health. Your Data.<br />
            <span style={{ color: "#7ee8f5" }}>Your Control.</span>
          </h1>
          <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 18, lineHeight: 1.6, maxWidth: 540, margin: "0 auto 40px" }}>
            {t("landing.hero_subtitle")}
          </p>

          {/* Emergency Card Visual */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 32 }}>
            <div style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 20, padding: "16px 24px", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", gap: 16, maxWidth: 400, textAlign: "left" }}>
              <div style={{ width: 52, height: 52, borderRadius: 12, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <QrCode size={26} color="#7ee8f5" />
              </div>
              <div>
                <p style={{ color: "#7ee8f5", fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", margin: 0 }}>EMERGENCY CARD</p>
                <p style={{ color: "#fff", fontSize: 14, fontWeight: 700, margin: "3px 0 2px" }}>Partagez votre dossier médical</p>
                <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, margin: 0 }}>QR · Lien 48h · Accès instantané</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
                {["A+","Diabète","Aspirine ⚠️"].map(tag => (
                  <span key={tag} style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "rgba(255,255,255,0.15)", color: "#fff", whiteSpace: "nowrap" }}>{tag}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Search card */}
          <div style={{ background: "#fff", borderRadius: 24, padding: "20px 24px", boxShadow: "0 8px 40px rgba(0,0,0,0.18)", marginBottom: 28, maxWidth: 760, marginLeft: "auto", marginRight: "auto" }}>
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
            <div style={{ height: 1, background: "#f1f5f9", marginBottom: 18 }} />
            {tab === "hospitals" ? (
              <div style={{ textAlign: "center", padding: "20px 0", color: "#94a3b8" }}>
                <Building2 size={28} style={{ margin: "0 auto 8px", opacity: 0.4, display: "block" }} />
                <p style={{ fontSize: 14, margin: 0 }}>Hospital search coming soon.</p>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {tab === "doctors" && (
                  <div style={{ flex: 1, minWidth: 200, display: "flex", alignItems: "center", gap: 10, border: "1.5px solid #e2e8f0", borderRadius: 12, padding: "0 14px" }}>
                    <Stethoscope size={16} color="#0057B8" style={{ flexShrink: 0 }} />
                    <input style={{ flex: 1, height: 46, border: "none", outline: "none", fontSize: 14, color: "#0f172a", background: "transparent" }}
                      placeholder={t("landing.search_specialty_placeholder")} value={specialty}
                      onChange={e => setSpecialty(e.target.value)} onKeyDown={e => e.key === "Enter" && doSearch()} />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 200, display: "flex", alignItems: "center", gap: 10, border: "1.5px solid #e2e8f0", borderRadius: 12, padding: "0 14px" }}>
                  <MapPin size={16} color="#0057B8" style={{ flexShrink: 0 }} />
                  <select style={{ flex: 1, height: 46, border: "none", outline: "none", fontSize: 14, color: city ? "#0f172a" : "#94a3b8", background: "transparent", cursor: "pointer" }}
                    value={city} onChange={e => setCity(e.target.value)}>
                    <option value="">{t("landing.search_city_placeholder")}</option>
                    {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <button onClick={doSearch} disabled={searching}
                  style={{ height: 46, padding: "0 28px", background: "#0057B8", color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap", flexShrink: 0 }}>
                  <Search size={16} /> {t("landing.search_btn")}
                </button>
              </div>
            )}
          </div>

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

      {/* ─── SEARCH RESULTS ─────────────────────────────────────────────── */}
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

      {/* ─── PARTNERS TICKER ────────────────────────────────────────────── */}
      <div style={{ background: "#f8fafc", borderTop: "1px solid #e5e7eb", borderBottom: "1px solid #e5e7eb", padding: "18px 0", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
          <div style={{ flexShrink: 0, padding: "0 32px", borderRight: "1px solid #e5e7eb" }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: "#94a3b8", letterSpacing: "0.15em", textTransform: "uppercase", margin: 0, whiteSpace: "nowrap" }}>{t("landing.section_partners")}</p>
          </div>
          <div style={{ overflow: "hidden", flex: 1 }}>
            <div style={{ display: "flex", gap: 48, animation: "ticker 30s linear infinite", whiteSpace: "nowrap" }}>
              {[...PARTNERS, ...PARTNERS].map((p, i) => (
                <span key={i} style={{ fontSize: 14, fontWeight: 700, color: "#475569", flexShrink: 0 }}>{p}</span>
              ))}
            </div>
          </div>
        </div>
        <style>{`@keyframes ticker { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }`}</style>
      </div>

      {/* ─── STATS ──────────────────────────────────────────────────────── */}
      <div ref={statsRef} style={{ background: "#fff", padding: "72px 16px" }}>
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

      {/* ─── BEFORE / AFTER ─────────────────────────────────────────────── */}
      <div style={{ background: "#f8fafc", padding: "72px 16px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: "#0057B8", letterSpacing: "0.18em", textTransform: "uppercase", margin: "0 0 12px" }}>{t("landing.section_difference")}</p>
            <h2 style={{ fontSize: 36, fontWeight: 900, color: "#0f172a", margin: 0 }}>{t("landing.comparison_title")}</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {/* Without */}
            <div style={{ background: "#fff", border: "2px solid #fecaca", borderRadius: 20, padding: 28 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 18 }}>😓</span>
                </div>
                <span style={{ fontSize: 16, fontWeight: 800, color: "#dc2626" }}>{t("landing.without_spitar")}</span>
              </div>
              {[
                "أوراق متناثرة في كل مكان",
                "تكرار المعلومات مع كل طبيب",
                "لا تتذكر اسم الدواء في الطوارئ",
                "نتائج التحاليل مفقودة",
                "انتظار طويل بدون موعد",
                "لا تعرف تاريخ التطعيم القادم",
              ].map(item => (
                <div key={item} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid #fef2f2" }}>
                  <span style={{ color: "#dc2626", fontSize: 16, flexShrink: 0 }}>✕</span>
                  <span style={{ fontSize: 14, color: "#64748b" }}>{item}</span>
                </div>
              ))}
            </div>
            {/* With */}
            <div style={{ background: "#fff", border: "2px solid #bbf7d0", borderRadius: 20, padding: 28 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 18 }}>🚀</span>
                </div>
                <span style={{ fontSize: 16, fontWeight: 800, color: "#16a34a" }}>{t("landing.with_spitar")}</span>
              </div>
              {[
                "ملف طبي رقمي دائماً في جيبك",
                "مشاركة فورية مع أي طبيب",
                "بطاقة طوارئ QR تنقذ حياتك",
                "جميع التحاليل محفوظة وقابلة للتنزيل",
                "حجز موعد في ثوانٍ",
                "تذكيرات تلقائية للأدوية والتطعيمات",
              ].map(item => (
                <div key={item} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid #f0fdf4" }}>
                  <span style={{ color: "#16a34a", fontSize: 16, flexShrink: 0 }}>✓</span>
                  <span style={{ fontSize: 14, color: "#374151", fontWeight: 500 }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ─── FEATURES ───────────────────────────────────────────────────── */}
      <div style={{ padding: "72px 16px", background: "#fff" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <h2 style={{ fontSize: 38, fontWeight: 900, color: "#0f172a", margin: "0 0 12px" }}>{t("landing.features_title")}</h2>
            <p style={{ fontSize: 17, color: "#64748b", maxWidth: 500, margin: "0 auto" }}>{t("landing.features_subtitle")}</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
            {[
              { Icon: Lock,         title: t("landing.feat_consent_title"),  desc: t("landing.feat_consent_desc"),  color: "#0057B8", bg: "#eff6ff",  border: "#bfdbfe" },
              { Icon: FlaskConical, title: t("landing.feat_labs_title"),     desc: t("landing.feat_labs_desc"),     color: "#0891b2", bg: "#ecfeff",  border: "#a5f3fc" },
              { Icon: FileText,     title: t("landing.feat_records_title"),  desc: t("landing.feat_records_desc"), color: "#7c3aed", bg: "#f5f3ff",  border: "#ddd6fe" },
              { Icon: Syringe,      title: t("landing.feat_vaccinations_title"), desc: t("landing.feat_vaccinations_desc"), color: "#0d9488", bg: "#f0fdfa", border: "#99f6e4" },
              { Icon: CalendarCheck,title: t("landing.feat_visits_title"),       desc: t("landing.feat_visits_desc"),       color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
              { Icon: QrCode,       title: t("landing.feat_emergency_title"),    desc: t("landing.feat_emergency_desc"),    color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
            ].map(({ Icon, title, desc, color, bg, border }) => (
              <div key={title} style={{ background: "#fff", border: `2px solid ${border}`, borderRadius: 20, padding: 28, transition: "box-shadow 0.2s" }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 12px 40px rgba(0,0,0,0.1)")}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: bg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
                  <Icon size={24} color={color} />
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", margin: "0 0 10px" }}>{title}</h3>
                <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.65, margin: 0 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── FOR DOCTORS ────────────────────────────────────────────────── */}
      <div style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)", padding: "80px 16px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }}>
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(0,180,200,0.15)", border: "1px solid rgba(0,180,200,0.3)", borderRadius: 999, padding: "6px 16px", marginBottom: 20 }}>
                <Stethoscope size={13} color="#00B4C8" />
                <span style={{ color: "#00B4C8", fontSize: 12, fontWeight: 700 }}>{t("landing.for_doctors_badge")}</span>
              </div>
              <h2 style={{ color: "#fff", fontSize: 36, fontWeight: 900, lineHeight: 1.15, margin: "0 0 20px" }}>
                {t("landing.for_doctors_title_1")}<br />
                <span style={{ color: "#7ee8f5" }}>{t("landing.for_doctors_title_2")}</span>
              </h2>
              <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 16, lineHeight: 1.7, margin: "0 0 32px" }}>
                انضم لشبكة SPITAR وأدر مواعيدك ومرضاك بكفاءة عالية — وصول فوري للملفات الطبية، لوحة تحكم ذكية، وتواصل مباشر مع مرضاك.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 36 }}>
                {[
                  { Icon: ClipboardList, text: "وصول آمن للسجلات الطبية بموافقة المريض" },
                  { Icon: BarChart3,     text: "لوحة تحكم تتبّع كل مرضاك ومواعيدك" },
                  { Icon: Clock,         text: "توفير وقت الاستشارة بنسبة تصل إلى 40%" },
                  { Icon: Smartphone,    text: "تطبيق متاح على الهاتف والحاسوب في أي وقت" },
                ].map(({ Icon, text }) => (
                  <div key={text} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(0,180,200,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon size={15} color="#00B4C8" />
                    </div>
                    <span style={{ fontSize: 14, color: "rgba(255,255,255,0.8)" }}>{text}</span>
                  </div>
                ))}
              </div>
              <Link to="/register">
                <button style={{ height: 46, padding: "0 28px", background: "#00B4C8", color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>
                  {t("landing.join_as_doctor")} <ArrowRight size={16} />
                </button>
              </Link>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {[
                { n: "3×", label: "أسرع في الاستشارة", color: "#7ee8f5" },
                { n: "98%", label: "رضا المرضى", color: "#a78bfa" },
                { n: "0", label: "أوراق مطلوبة", color: "#6ee7b7" },
                { n: "24/7", label: "وصول للملفات", color: "#fca5a5" },
              ].map(({ n, label, color }) => (
                <div key={label} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: "22px 18px", textAlign: "center" }}>
                  <div style={{ fontSize: 32, fontWeight: 900, color, marginBottom: 6 }}>{n}</div>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", fontWeight: 500 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ─── HOW IT WORKS ───────────────────────────────────────────────── */}
      <div style={{ background: "#f8fafc", padding: "72px 16px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontSize: 38, fontWeight: 900, color: "#0f172a", margin: "0 0 12px" }}>{t("landing.how_it_works")}</h2>
          <p style={{ fontSize: 17, color: "#64748b", marginBottom: 56 }}>{t("landing.how_it_works_sub")}</p>
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

      {/* ─── TESTIMONIALS ───────────────────────────────────────────────── */}
      <div style={{ background: "#fff", padding: "72px 16px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: "#0057B8", letterSpacing: "0.18em", textTransform: "uppercase", margin: "0 0 12px" }}>{t("landing.section_testimonials")}</p>
            <h2 style={{ fontSize: 38, fontWeight: 900, color: "#0f172a", margin: 0 }}>{t("landing.testimonials_title")}</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
            {TESTIMONIALS.map((t) => (
              <div key={t.name} style={{ background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 20, padding: 24, transition: "box-shadow 0.2s", display: "flex", flexDirection: "column", gap: 16 }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 8px 32px rgba(0,0,0,0.08)")}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}>
                <div style={{ display: "flex", gap: 2 }}>
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} size={14} color="#f59e0b" fill="#f59e0b" />
                  ))}
                </div>
                <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.7, margin: 0, flex: 1, direction: "rtl", textAlign: "right" }}>"{t.text}"</p>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: t.color + "18", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, color: t.color, flexShrink: 0 }}>
                    {t.avatar}
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", margin: 0 }}>{t.name}</p>
                    <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── SUPPORTED CITIES ───────────────────────────────────────────── */}
      <div style={{ background: "#f8fafc", padding: "72px 16px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: "#0057B8", letterSpacing: "0.18em", textTransform: "uppercase", margin: "0 0 12px" }}>{t("landing.section_coverage")}</p>
            <h2 style={{ fontSize: 36, fontWeight: 900, color: "#0f172a", margin: "0 0 12px" }}>{t("landing.coverage_title")}</h2>
            <p style={{ fontSize: 15, color: "#64748b", margin: 0 }}>{t("landing.coverage_subtitle")}</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 14 }}>
            {SUPPORTED_CITIES.map(({ name, count }) => (
              <div key={name} style={{ background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 14, padding: "16px 20px", display: "flex", alignItems: "center", gap: 12, transition: "border-color 0.2s" }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = "#0057B8")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "#e5e7eb")}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <MapPin size={16} color="#0057B8" />
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", margin: 0 }}>{name}</p>
                  <p style={{ fontSize: 11, color: "#0057B8", margin: 0, fontWeight: 600 }}>{count}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── FAQ ────────────────────────────────────────────────────────── */}
      <div style={{ background: "#fff", padding: "72px 16px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: "#0057B8", letterSpacing: "0.18em", textTransform: "uppercase", margin: "0 0 12px" }}>{t("landing.section_faq")}</p>
            <h2 style={{ fontSize: 36, fontWeight: 900, color: "#0f172a", margin: 0 }}>{t("landing.faq_title")}</h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {FAQS.map((faq, i) => (
              <div key={i} style={{ background: "#f8fafc", border: `1.5px solid ${openFaq === i ? "#0057B8" : "#e5e7eb"}`, borderRadius: 14, overflow: "hidden", transition: "border-color 0.2s" }}>
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px", background: "none", border: "none", cursor: "pointer", textAlign: "right", gap: 12 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", direction: "rtl", textAlign: "right", flex: 1 }}>{faq.q}</span>
                  {openFaq === i ? <ChevronUp size={18} color="#0057B8" style={{ flexShrink: 0 }} /> : <ChevronDown size={18} color="#94a3b8" style={{ flexShrink: 0 }} />}
                </button>
                {openFaq === i && (
                  <div style={{ padding: "0 20px 18px", direction: "rtl" }}>
                    <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.7, margin: 0 }}>{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── CTA BANNER ─────────────────────────────────────────────────── */}
      <div style={{ background: "linear-gradient(135deg, #003580 0%, #0057B8 100%)", padding: "72px 16px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -80, right: -80, width: 300, height: 300, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
        <div style={{ position: "relative", maxWidth: 600, margin: "0 auto" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 999, padding: "6px 16px", marginBottom: 24 }}>
            <Star size={13} color="#fbbf24" fill="#fbbf24" />
            <span style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>{t("landing.trusted_badge")}</span>
          </div>
          <h2 style={{ color: "#fff", fontSize: 40, fontWeight: 900, margin: "0 0 16px", lineHeight: 1.1 }}>{t("landing.cta_banner_title")}</h2>
          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 17, marginBottom: 40 }}>{t("landing.cta_banner_subtitle")}</p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <Link to="/register">
              <button style={{ height: 52, padding: "0 40px", background: "#fff", color: "#0057B8", border: "none", borderRadius: 14, fontSize: 16, fontWeight: 800, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.25)" }}>
                {t("landing.hero_cta")} <ArrowRight size={18} />
              </button>
            </Link>
            <Link to="/register">
              <button style={{ height: 52, padding: "0 32px", background: "rgba(255,255,255,0.12)", color: "#fff", border: "1.5px solid rgba(255,255,255,0.3)", borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: "pointer", backdropFilter: "blur(4px)" }}>
                {t("landing.join_as_doctor")}
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* ─── FOOTER ─────────────────────────────────────────────────────── */}
      <footer style={{ background: "#0a1628", padding: "48px 16px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 40, marginBottom: 40, flexWrap: "wrap" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <SpitarLogoMark size={32} />
                <div>
                  <p style={{ color: "#fff", fontWeight: 800, fontSize: 17, margin: 0 }}>SPITAR <span style={{ color: "#00B4C8" }}>CLD</span></p>
                  <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, margin: "2px 0 0" }}>Healthcare Platform for Morocco</p>
                </div>
              </div>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, lineHeight: 1.6, margin: 0, maxWidth: 260 }}>
                منصة صحية رقمية تربط المرضى بالأطباء وتحفظ سجلاتهم الطبية بأمان تام.
              </p>
            </div>
            <div>
              <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 16px" }}>للمرضى</p>
              {[["التسجيل", "/register"], ["تسجيل الدخول", "/login"], ["الملف الصحي", "/health"], ["بطاقة الطوارئ", "/qr"]].map(([label, href]) => (
                <Link key={label} to={href} style={{ display: "block", color: "rgba(255,255,255,0.45)", fontSize: 14, textDecoration: "none", marginBottom: 10, transition: "color 0.15s" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
                  onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.45)")}>
                  {label}
                </Link>
              ))}
            </div>
            <div>
              <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 16px" }}>للأطباء</p>
              {[["انضم كطبيب", "/register"], ["لوحة التحكم", "/dashboard"], ["إدارة المواعيد", "/dashboard"]].map(([label, href]) => (
                <Link key={label} to={href} style={{ display: "block", color: "rgba(255,255,255,0.45)", fontSize: 14, textDecoration: "none", marginBottom: 10, transition: "color 0.15s" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
                  onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.45)")}>
                  {label}
                </Link>
              ))}
            </div>
            <div>
              <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 16px" }}>المدن</p>
              {["Casablanca","Rabat","Marrakech","Fès","Agadir","Tanger"].map(c => (
                <p key={c} style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, margin: "0 0 8px" }}>{c}</p>
              ))}
            </div>
          </div>
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 24, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 12, margin: 0 }}>© 2026 SPITAR Healthcare Platform. All rights reserved.</p>
            <div style={{ display: "flex", gap: 20 }}>
              {["Confidentialité", "Conditions", "Contact"].map(l => (
                <span key={l} style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, cursor: "pointer" }}>{l}</span>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
