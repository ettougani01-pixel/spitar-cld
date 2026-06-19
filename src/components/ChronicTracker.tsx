import { TrendingUp, TrendingDown, Minus, Target } from "lucide-react";

interface Vital { id: string; type: string; value: string; recordedAt: string; }

const TARGETS: Record<string, { label: string; unit: string; ranges: { label: string; min: number; max: number; color: string }[]; getValue: (v: string) => number }> = {
  blood_pressure: {
    label: "Blood Pressure",
    unit: "mmHg",
    getValue: v => parseFloat(v.split("/")[0]),
    ranges: [
      { label: "Low", min: 0, max: 89, color: "#2563eb" },
      { label: "Normal", min: 90, max: 119, color: "#16a34a" },
      { label: "Elevated", min: 120, max: 129, color: "#d97706" },
      { label: "High", min: 130, max: 999, color: "#dc2626" },
    ],
  },
  blood_sugar: {
    label: "Blood Sugar",
    unit: "mg/dL",
    getValue: v => parseFloat(v),
    ranges: [
      { label: "Low", min: 0, max: 69, color: "#2563eb" },
      { label: "Normal", min: 70, max: 99, color: "#16a34a" },
      { label: "Pre-diabetic", min: 100, max: 125, color: "#d97706" },
      { label: "Diabetic", min: 126, max: 999, color: "#dc2626" },
    ],
  },
  heart_rate: {
    label: "Heart Rate",
    unit: "bpm",
    getValue: v => parseFloat(v),
    ranges: [
      { label: "Low", min: 0, max: 59, color: "#2563eb" },
      { label: "Normal", min: 60, max: 100, color: "#16a34a" },
      { label: "Elevated", min: 101, max: 999, color: "#dc2626" },
    ],
  },
};

function getRange(type: string, val: number) {
  const t = TARGETS[type];
  if (!t) return null;
  return t.ranges.find(r => val >= r.min && val <= r.max) ?? null;
}

export function ChronicTracker({ vitals }: { vitals: Vital[] }) {
  const types = ["blood_pressure", "blood_sugar", "heart_rate"];
  const hasData = types.some(t => vitals.some(v => v.type === t));
  if (!hasData) return null;

  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: 20, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg, #dc2626, #d97706)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Target size={15} style={{ color: "#fff" }} />
        </div>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>Chronic Disease Tracker</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        {types.map(type => {
          const target = TARGETS[type];
          if (!target) return null;
          const typeVitals = vitals.filter(v => v.type === type).sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
          if (typeVitals.length === 0) return null;

          const latest = typeVitals[0];
          const latestVal = target.getValue(latest.value);
          const range = getRange(type, latestVal);

          const prev = typeVitals[1];
          const prevVal = prev ? target.getValue(prev.value) : null;
          const trend = prevVal !== null ? (latestVal > prevVal ? "up" : latestVal < prevVal ? "down" : "same") : "same";

          // Average of last 7 readings
          const last7 = typeVitals.slice(0, 7).map(v => target.getValue(v.value));
          const avg = last7.reduce((a, b) => a + b, 0) / last7.length;

          return (
            <div key={type} style={{ border: `1.5px solid ${range?.color ?? "#e5e7eb"}33`, borderRadius: 12, padding: 14, background: `${range?.color ?? "#e5e7eb"}08` }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>{target.label}</p>

              <div style={{ display: "flex", alignItems: "flex-end", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 28, fontWeight: 800, color: range?.color ?? "#0f172a", lineHeight: 1 }}>{latest.value}</span>
                <span style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>{target.unit}</span>
                {trend === "up" ? <TrendingUp size={16} style={{ color: "#dc2626", marginBottom: 4 }} /> :
                 trend === "down" ? <TrendingDown size={16} style={{ color: "#2563eb", marginBottom: 4 }} /> :
                 <Minus size={16} style={{ color: "#94a3b8", marginBottom: 4 }} />}
              </div>

              {range && (
                <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20, background: range.color + "22", color: range.color }}>
                  {range.label}
                </span>
              )}

              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #f3f4f6" }}>
                <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>
                  7-reading avg: <strong style={{ color: "#0f172a" }}>{avg.toFixed(0)} {target.unit}</strong>
                </p>
                <p style={{ fontSize: 11, color: "#94a3b8", margin: "2px 0 0" }}>
                  Last reading: {latest.recordedAt}
                </p>
              </div>

              {/* Range scale */}
              <div style={{ marginTop: 10 }}>
                <div style={{ display: "flex", gap: 2, height: 6, borderRadius: 3, overflow: "hidden" }}>
                  {target.ranges.map((r, i) => (
                    <div key={i} style={{ flex: 1, background: latestVal >= r.min && latestVal <= r.max ? r.color : r.color + "33", borderRadius: i === 0 ? "3px 0 0 3px" : i === target.ranges.length - 1 ? "0 3px 3px 0" : 0 }} />
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                  {target.ranges.map((r, i) => (
                    <span key={i} style={{ fontSize: 9, color: "#94a3b8", fontWeight: 600 }}>{r.label}</span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
