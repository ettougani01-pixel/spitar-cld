import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { CheckCircle2, ShieldCheck, Stethoscope, ArrowRight } from "lucide-react";

const VIDEOS = [
  {
    id: "patient",
    label: "للمريض",
    icon: "🧑‍⚕️",
    color: "#2563eb",
    bg: "#eff6ff",
    border: "#bfdbfe",
    url: "/patient-video.html",
  },
  {
    id: "doctor",
    label: "للطبيب والمستشفى",
    icon: "👨‍⚕️",
    color: "#7c3aed",
    bg: "#f5f3ff",
    border: "#ddd6fe",
    url: "/doctor-video.html",
  },
  {
    id: "lab",
    label: "للمختبر",
    icon: "🔬",
    color: "#059669",
    bg: "#ecfdf5",
    border: "#a7f3d0",
    url: "/lab-video.html",
  },
];

export default function About() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [activeVideo, setActiveVideo] = useState("patient");
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#fff" }}>
      <Navbar />

      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg, #003580 0%, #0057B8 60%, #00B4C8 100%)", padding: isMobile ? "48px 16px 56px" : "72px 16px 80px", textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 999, padding: "6px 16px", marginBottom: 20 }}>
          <ShieldCheck size={14} color="#7ee8f5" />
          <span style={{ color: "#7ee8f5", fontSize: 13, fontWeight: 700 }}>ما هو SPITAR؟</span>
        </div>
        <h1 style={{ color: "#fff", fontSize: isMobile ? 30 : 48, fontWeight: 900, lineHeight: 1.1, margin: "0 0 16px" }}>
          منصة صحية رقمية متكاملة<br />
          <span style={{ color: "#7ee8f5" }}>للمريض والطبيب والمختبر</span>
        </h1>
        <p style={{ color: "rgba(255,255,255,0.8)", fontSize: isMobile ? 15 : 18, maxWidth: 580, margin: "0 auto", lineHeight: 1.7 }}>
          SPITAR يُنهي عصر الأوراق الطبية المبعثرة — ملفك الصحي كاملاً في جيبك، آمن ومتاح في أي وقت لأي طبيب في المغرب.
        </p>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: isMobile ? "40px 16px 64px" : "64px 16px 96px" }}>

        {/* Who uses it */}
        <div style={{ textAlign: "center", marginBottom: isMobile ? 32 : 48 }}>
          <h2 style={{ fontSize: isMobile ? 22 : 30, fontWeight: 800, color: "#0f172a", margin: "0 0 8px" }}>من يستخدم SPITAR؟</h2>
          <p style={{ fontSize: 15, color: "#64748b", margin: 0 }}>منصة واحدة تخدم جميع أطراف المنظومة الصحية</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: isMobile ? 12 : 20, marginBottom: isMobile ? 48 : 72 }}>
          {[
            { icon: "🧑‍⚕️", title: "المريض", desc: "يحفظ ملفه الطبي كاملاً ويتحكم في من يراه", color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" },
            { icon: "👨‍⚕️", title: "الطبيب", desc: "يصل لملفات مرضاه ويكتب الوصفات رقمياً", color: "#0891b2", bg: "#ecfeff", border: "#a5f3fc" },
            { icon: "🔬", title: "المختبر", desc: "يرفع نتائج التحاليل مباشرة لملف المريض", color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
            { icon: "🏥", title: "المستشفى", desc: "يدير المرضى والمواعيد على نطاق واسع", color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
          ].map(item => (
            <div key={item.title} style={{ background: item.bg, borderRadius: 16, padding: isMobile ? "20px 14px" : "28px 22px", textAlign: "center", border: `1px solid ${item.border}` }}>
              <div style={{ fontSize: isMobile ? 30 : 38, marginBottom: 12 }}>{item.icon}</div>
              <p style={{ fontWeight: 800, color: item.color, fontSize: isMobile ? 14 : 16, margin: "0 0 6px" }}>{item.title}</p>
              <p style={{ fontSize: isMobile ? 11 : 13, color: "#64748b", margin: 0, lineHeight: 1.5 }}>{item.desc}</p>
            </div>
          ))}
        </div>

        {/* ── Videos section ── */}
        <div style={{ marginBottom: isMobile ? 48 : 72 }}>
          <div style={{ textAlign: "center", marginBottom: isMobile ? 24 : 36 }}>
            <h2 style={{ fontSize: isMobile ? 22 : 30, fontWeight: 800, color: "#0f172a", margin: "0 0 8px" }}>شاهد SPITAR في العمل</h2>
            <p style={{ fontSize: 15, color: "#64748b", margin: 0 }}>فيديوهات تفاعلية توضح كيفية الاستخدام لكل طرف</p>
          </div>

          {/* Tab buttons */}
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginBottom: 24 }}>
            {VIDEOS.map(v => (
              <button
                key={v.id}
                onClick={() => setActiveVideo(v.id)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 7,
                  padding: isMobile ? "9px 18px" : "10px 24px",
                  borderRadius: 999,
                  border: `1.5px solid ${activeVideo === v.id ? v.color : "#e2e8f0"}`,
                  background: activeVideo === v.id ? v.bg : "#fff",
                  color: activeVideo === v.id ? v.color : "#64748b",
                  fontSize: isMobile ? 13 : 14,
                  fontWeight: activeVideo === v.id ? 700 : 500,
                  cursor: "pointer",
                  transition: "all .18s",
                  boxShadow: activeVideo === v.id ? `0 2px 12px ${v.color}22` : "none",
                }}
              >
                <span style={{ fontSize: 16 }}>{v.icon}</span>
                {v.label}
              </button>
            ))}
          </div>

          {/* iframe player */}
          {VIDEOS.map(v => (
            <div
              key={v.id}
              style={{
                display: activeVideo === v.id ? "block" : "none",
                borderRadius: 20,
                overflow: "hidden",
                border: `1.5px solid ${v.border}`,
                boxShadow: `0 8px 40px ${v.color}18`,
                background: "#000",
                position: "relative",
              }}
            >
              {/* 16:9 wrapper */}
              <div style={{ position: "relative", paddingBottom: "56.25%", height: 0 }}>
                <iframe
                  src={v.url}
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
                  allow="autoplay"
                  title={`SPITAR ${v.label}`}
                />
              </div>
              <div style={{ background: v.bg, padding: "10px 20px", display: "flex", alignItems: "center", gap: 8, borderTop: `1px solid ${v.border}` }}>
                <span style={{ fontSize: 16 }}>{v.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: v.color }}>SPITAR {v.label}</span>
                <span style={{ fontSize: 12, color: "#94a3b8", marginRight: "auto" }}>يمكنك الضغط على مسار التقدم للتنقل بين الشرائح</span>
              </div>
            </div>
          ))}
        </div>

        {/* Main features */}
        <div style={{ textAlign: "center", marginBottom: isMobile ? 32 : 48 }}>
          <h2 style={{ fontSize: isMobile ? 22 : 30, fontWeight: 800, color: "#0f172a", margin: "0 0 8px" }}>الميزات الرئيسية</h2>
          <p style={{ fontSize: 15, color: "#64748b", margin: 0 }}>كل ما تحتاجه لإدارة صحتك رقمياً</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 16 : 24, marginBottom: isMobile ? 48 : 72 }}>

          {/* Emergency Card */}
          <div style={{ background: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)", borderRadius: 20, padding: isMobile ? "28px 20px" : "36px 32px", color: "#fff", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
            <div style={{ fontSize: 32, marginBottom: 16 }}>🆘</div>
            <h3 style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, margin: "0 0 10px" }}>بطاقة الطوارئ الذكية</h3>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.8)", lineHeight: 1.7, margin: "0 0 20px" }}>
              رمز QR دائم يُظهر فوراً فصيلة الدم، الحساسيات، والأمراض المزمنة — حتى بدون اتصال بالإنترنت أو تسجيل دخول. قد ينقذ حياتك في حالة الطوارئ.
            </p>
            {["فصيلة الدم والحساسيات الخطيرة", "الأدوية الحالية وجهات الطوارئ", "تكامل مع Google Wallet", "إمكانية الطباعة"].map(f => (
              <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <CheckCircle2 size={14} color="#7ee8f5" />
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.9)" }}>{f}</span>
              </div>
            ))}
          </div>

          {/* Health Profile */}
          <div style={{ background: "#fff", borderRadius: 20, padding: isMobile ? "28px 20px" : "36px 32px", border: "1px solid #f1f5f9", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>📋</div>
            <h3 style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, color: "#0f172a", margin: "0 0 10px" }}>الملف الصحي الكامل</h3>
            <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.7, margin: "0 0 20px" }}>
              كل معلوماتك الطبية في مكان واحد — من الأمراض المزمنة واللقاحات إلى نتائج التحاليل وسجل الزيارات.
            </p>
            {["10 أمراض مزمنة مع متابعة مفصلة", "جدول لقاحات المغرب الكامل (10 مجموعات عمرية)", "رسوم بيانية لتطور المؤشرات الصحية", "سجل الحساسيات مع درجة الخطورة"].map(f => (
              <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <CheckCircle2 size={14} color="#16a34a" />
                <span style={{ fontSize: 13, color: "#374151" }}>{f}</span>
              </div>
            ))}
          </div>

          {/* Access Control */}
          <div style={{ background: "#fff", borderRadius: 20, padding: isMobile ? "28px 20px" : "36px 32px", border: "1px solid #f1f5f9", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>🔐</div>
            <h3 style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, color: "#0f172a", margin: "0 0 10px" }}>تحكم كامل في الخصوصية</h3>
            <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.7, margin: "0 0 20px" }}>
              أنت وحدك من يقرر من يرى ملفك الطبي. امنح الإذن أو اسحبه بنقرة واحدة في أي وقت.
            </p>
            {["منح الوصول للطبيب بـ SPITAR ID", "سحب الإذن فوراً متى تشاء", "سجل كامل لكل من اطلع على ملفك", "امتثال كامل لمعايير GDPR"].map(f => (
              <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <CheckCircle2 size={14} color="#2563eb" />
                <span style={{ fontSize: 13, color: "#374151" }}>{f}</span>
              </div>
            ))}
          </div>

          {/* AI */}
          <div style={{ background: "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)", borderRadius: 20, padding: isMobile ? "28px 20px" : "36px 32px", border: "1px solid #e9d5ff" }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>🤖</div>
            <h3 style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, color: "#4c1d95", margin: "0 0 10px" }}>مساعد صحي ذكي + تنبيهات</h3>
            <p style={{ fontSize: 14, color: "#6d28d9", lineHeight: 1.7, margin: "0 0 20px" }}>
              دردشة صحية ذكية تجيب على أسئلتك بالعربية والفرنسية والإنجليزية، مع تنبيهات تلقائية للأدوية والمواعيد.
            </p>
            {["إجابات طبية للأعراض الشائعة", "تنبيه قبل 24 ساعة من الموعد", "تذكير تلقائي لجرعات الأدوية", "تنبيه عند وصول نتائج التحاليل"].map(f => (
              <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <CheckCircle2 size={14} color="#7c3aed" />
                <span style={{ fontSize: 13, color: "#4c1d95" }}>{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Doctor section */}
        <div style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)", borderRadius: 20, padding: isMobile ? "32px 20px" : "48px 40px", color: "#fff", marginBottom: isMobile ? 48 : 72 }}>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 24 : 48, alignItems: "center" }}>
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(14,165,233,0.15)", border: "1px solid rgba(14,165,233,0.3)", borderRadius: 999, padding: "5px 14px", marginBottom: 16 }}>
                <Stethoscope size={13} color="#38bdf8" />
                <span style={{ color: "#38bdf8", fontSize: 12, fontWeight: 700 }}>للأطباء والعيادات</span>
              </div>
              <h3 style={{ fontSize: isMobile ? 20 : 28, fontWeight: 800, margin: "0 0 14px", lineHeight: 1.2 }}>
                عيادتك الرقمية<br />
                <span style={{ color: "#7ee8f5" }}>في راحة يدك</span>
              </h3>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", lineHeight: 1.8, margin: 0 }}>
                كل ما يحتاجه الطبيب: الوصول لملفات المرضى، كتابة الوصفات، إدارة المواعيد، الإحالات، والتطبيب عن بعد — كل شيء في منصة واحدة.
              </p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[
                { icon: "💊", text: "فحص تفاعل الأدوية تلقائياً" },
                { icon: "📅", text: "إدارة المواعيد والتأكيد" },
                { icon: "📞", text: "تطبيب عن بعد (Teleconsult)" },
                { icon: "📤", text: "إرسال ملخص الزيارة للمريض" },
                { icon: "⭐", text: "نظام تقييم المريض للطبيب" },
                { icon: "📊", text: "خطة العلاج الأسبوعية" },
              ].map(item => (
                <div key={item.text} style={{ background: "rgba(255,255,255,0.06)", borderRadius: 12, padding: "14px 12px", display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <span style={{ fontSize: 18 }}>{item.icon}</span>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", lineHeight: 1.4 }}>{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Why everyone should use it */}
        <div style={{ textAlign: "center", marginBottom: isMobile ? 32 : 48 }}>
          <h2 style={{ fontSize: isMobile ? 22 : 30, fontWeight: 800, color: "#0f172a", margin: "0 0 8px" }}>لماذا يجب على الجميع استخدامه؟</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 16 : 24, marginBottom: isMobile ? 48 : 72 }}>
          {[
            { title: "للمريض", color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe", points: ["ملفك الطبي دائماً في جيبك لا يضيع", "لا تحتاج تكرار معلوماتك مع كل طبيب جديد", "بطاقة طوارئ قد تنقذ حياتك في الحوادث", "تتبع أدويتك ولقاحاتك بدون نسيان", "أنت من يتحكم في من يرى ملفك"] },
            { title: "للطبيب", color: "#0891b2", bg: "#ecfeff", border: "#a5f3fc", points: ["وصول فوري لتاريخ المريض الكامل", "يُقلص وقت الاستشارة بنسبة 40%", "يُجنبك أخطاء تفاعل الأدوية", "إدارة عيادتك رقمياً بالكامل", "تواصل مباشر مع المرضى"] },
            { title: "للمختبر", color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe", points: ["لا ورق، لا فاكس، لا نتائج مفقودة", "المريض يستلم نتيجته مباشرة في تطبيقه", "ربط مباشر بملف المريض بإذنه", "توفير وقت الموظفين وتقليل الأخطاء"] },
            { title: "للمستشفى", color: "#d97706", bg: "#fffbeb", border: "#fde68a", points: ["إدارة مئات المرضى في منصة واحدة", "تنسيق فوري مع الأطباء والمختبرات", "سجلات رقمية دقيقة ومحمية", "تحسين جودة الخدمة وتقليل الانتظار"] },
          ].map(item => (
            <div key={item.title} style={{ background: item.bg, borderRadius: 20, padding: isMobile ? "24px 18px" : "32px 28px", border: `1px solid ${item.border}` }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: item.color, margin: "0 0 16px" }}>{item.title}</h3>
              {item.points.map(p => (
                <div key={p} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 10 }}>
                  <CheckCircle2 size={15} color={item.color} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 13, color: "#374151", lineHeight: 1.5 }}>{p}</span>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{ background: "linear-gradient(135deg, #003580, #0057B8)", borderRadius: 20, padding: isMobile ? "36px 20px" : "52px 40px", textAlign: "center", color: "#fff" }}>
          <h2 style={{ fontSize: isMobile ? 22 : 32, fontWeight: 800, margin: "0 0 12px" }}>ابدأ رحلتك الصحية اليوم</h2>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.75)", margin: "0 0 28px" }}>انضم لآلاف المغاربة الذين يديرون صحتهم رقمياً مع SPITAR</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link to="/register">
              <button style={{ height: 48, padding: "0 32px", background: "#fff", color: "#0057B8", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>
                إنشاء حساب <ArrowRight size={15} />
              </button>
            </Link>
            <Link to="/login">
              <button style={{ height: 48, padding: "0 28px", background: "transparent", color: "#fff", border: "1.5px solid rgba(255,255,255,0.5)", borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
                تسجيل الدخول
              </button>
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
