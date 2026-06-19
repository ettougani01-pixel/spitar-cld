import { useMemo } from "react";
import { FileText, FlaskConical, CalendarDays, TrendingUp, TrendingDown, Minus, Heart, AlertTriangle } from "lucide-react";
import type { MedicalRecord, LabResult, Appointment } from "@/lib/types";

interface Vital {
  type: string;
  value: number;
  unit: string;
  date: string;
}

interface Props {
  records: MedicalRecord[];
  labResults: LabResult[];
  appointments: Appointment[];
  vitals?: Vital[];
  patientName?: string;
}

export function HealthReport({ records, labResults, appointments, vitals = [], patientName }: Props) {
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

  const stats = useMemo(() => {
    const thisMonth = {
      records: records.filter(r => r.createdAt >= thisMonthStart).length,
      labs: labResults.filter(r => r.createdAt >= thisMonthStart).length,
      appointments: appointments.filter(a => a.date >= thisMonthStart.split("T")[0] && a.status === "confirmed").length,
    };
    const lastMonth = {
      records: records.filter(r => r.createdAt >= lastMonthStart && r.createdAt < thisMonthStart).length,
      labs: labResults.filter(r => r.createdAt >= lastMonthStart && r.createdAt < thisMonthStart).length,
    };

    const criticalLabs = labResults.filter(r => r.status === "critical");
    const abnormalLabs = labResults.filter(r => r.status === "abnormal");

    return { thisMonth, lastMonth, criticalLabs, abnormalLabs };
  }, [records, labResults, appointments, thisMonthStart, lastMonthStart]);

  const vitalSummary = useMemo(() => {
    const types = Array.from(new Set(vitals.map(v => v.type)));
    return types.map(type => {
      const group = vitals.filter(v => v.type === type).sort((a, b) => a.date.localeCompare(b.date));
      if (group.length < 2) return null;
      const latest = group[group.length - 1];
      const prev = group[group.length - 2];
      const trend = latest.value > prev.value ? "up" : latest.value < prev.value ? "down" : "flat";
      return { type, value: latest.value, unit: latest.unit, trend };
    }).filter(Boolean);
  }, [vitals]);

  const monthName = now.toLocaleString("en-US", { month: "long", year: "numeric" });

  const trend = (cur: number, prev: number) => {
    if (cur > prev) return { icon: TrendingUp, color: "#16a34a", label: `+${cur - prev} from last month` };
    if (cur < prev) return { icon: TrendingDown, color: "#dc2626", label: `${cur - prev} from last month` };
    return { icon: Minus, color: "#94a3b8", label: "Same as last month" };
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #1e3a8a, #2563eb)", borderRadius: 16, padding: "20px 24px", color: "#fff" }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.7)", margin: "0 0 4px", letterSpacing: "0.08em" }}>MONTHLY HEALTH REPORT</p>
        <h3 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 4px" }}>{monthName}</h3>
        {patientName && <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", margin: 0 }}>{patientName}</p>}
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {(() => {
          const recTrend = trend(stats.thisMonth.records, stats.lastMonth.records);
          const labTrend = trend(stats.thisMonth.labs, stats.lastMonth.labs);
          return (
            <>
              <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg, #7c3aed, #2563eb)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <FileText size={15} style={{ color: "#fff" }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Medical Records</span>
                </div>
                <p style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", margin: "0 0 4px" }}>{stats.thisMonth.records}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <recTrend.icon size={12} style={{ color: recTrend.color }} />
                  <span style={{ fontSize: 11, color: recTrend.color }}>{recTrend.label}</span>
                </div>
              </div>

              <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg, #0891b2, #16a34a)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <FlaskConical size={15} style={{ color: "#fff" }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Lab Tests</span>
                </div>
                <p style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", margin: "0 0 4px" }}>{stats.thisMonth.labs}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <labTrend.icon size={12} style={{ color: labTrend.color }} />
                  <span style={{ fontSize: 11, color: labTrend.color }}>{labTrend.label}</span>
                </div>
              </div>

              <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg, #0d9488, #16a34a)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <CalendarDays size={15} style={{ color: "#fff" }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Appointments</span>
                </div>
                <p style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", margin: "0 0 4px" }}>{stats.thisMonth.appointments}</p>
                <span style={{ fontSize: 11, color: "#94a3b8" }}>confirmed this month</span>
              </div>
            </>
          );
        })()}
      </div>

      {/* Alerts */}
      {(stats.criticalLabs.length > 0 || stats.abnormalLabs.length > 0) && (
        <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #fca5a5", padding: "14px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <AlertTriangle size={15} style={{ color: "#dc2626" }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>Lab Alerts</span>
          </div>
          {stats.criticalLabs.length > 0 && (
            <p style={{ fontSize: 13, color: "#dc2626", margin: "0 0 4px" }}>
              🔴 <strong>{stats.criticalLabs.length} critical</strong> lab result{stats.criticalLabs.length > 1 ? "s" : ""} on record — contact your doctor
            </p>
          )}
          {stats.abnormalLabs.length > 0 && (
            <p style={{ fontSize: 13, color: "#d97706", margin: 0 }}>
              🟡 <strong>{stats.abnormalLabs.length} abnormal</strong> lab result{stats.abnormalLabs.length > 1 ? "s" : ""} — review with your doctor
            </p>
          )}
        </div>
      )}

      {/* Vital trends */}
      {vitalSummary.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: "14px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Heart size={15} style={{ color: "#dc2626" }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>Vital Signs Summary</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {vitalSummary.map((v: any) => (
              <div key={v.type} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", textTransform: "capitalize" }}>{v.type.replace("_", " ")}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>{v.value} <span style={{ fontSize: 11, fontWeight: 400, color: "#64748b" }}>{v.unit}</span></span>
                  {v.trend === "up" && <TrendingUp size={14} style={{ color: "#d97706" }} />}
                  {v.trend === "down" && <TrendingDown size={14} style={{ color: "#2563eb" }} />}
                  {v.trend === "flat" && <Minus size={14} style={{ color: "#94a3b8" }} />}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent records */}
      {records.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: "14px 18px" }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 10 }}>Recent Medical Records</p>
          {records.slice(0, 5).map(r => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid #f1f5f9" }}>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#ede9fe", color: "#7c3aed", flexShrink: 0 }}>{r.type}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", flex: 1 }}>{r.title}</span>
              <span style={{ fontSize: 11, color: "#94a3b8", flexShrink: 0 }}>{r.date}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
