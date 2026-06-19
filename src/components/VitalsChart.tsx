import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TrendingUp } from "lucide-react";

interface Vital {
  id: string;
  type: string;
  value: string;
  unit: string;
  recordedAt: string;
}

const VITAL_CONFIG: Record<string, { label: string; color: string; unit: string }> = {
  blood_pressure: { label: "Blood Pressure", color: "#ef4444", unit: "mmHg" },
  blood_sugar:    { label: "Blood Sugar",    color: "#f59e0b", unit: "mg/dL" },
  weight:         { label: "Weight",          color: "#2563eb", unit: "kg" },
  heart_rate:     { label: "Heart Rate",      color: "#7c3aed", unit: "bpm" },
  sleep:          { label: "Sleep",           color: "#0d9488", unit: "hrs" },
};

export function VitalsChart({ vitals }: { vitals: Vital[] }) {
  const [selectedType, setSelectedType] = useState("blood_pressure");

  const filtered = vitals
    .filter(v => v.type === selectedType)
    .map(v => {
      const val = parseFloat(v.value.split("/")[0]);
      const date = new Date(v.recordedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
      return { date, value: isNaN(val) ? 0 : val, full: v.value };
    })
    .slice(-14);

  const cfg = VITAL_CONFIG[selectedType];

  if (vitals.length === 0) return null;

  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: 20, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg, #2563eb, #06b6d4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <TrendingUp size={15} style={{ color: "#fff" }} />
        </div>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>Vitals Trend</span>
      </div>

      {/* Type selector */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {Object.entries(VITAL_CONFIG).map(([key, c]) => (
          <button
            key={key}
            onClick={() => setSelectedType(key)}
            style={{
              padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none",
              background: selectedType === key ? c.color : "#f1f5f9",
              color: selectedType === key ? "#fff" : "#64748b",
              transition: "all 0.15s",
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      {filtered.length < 2 ? (
        <p style={{ fontSize: 13, color: "#94a3b8", textAlign: "center", padding: "20px 0" }}>
          Add at least 2 {cfg.label} readings to see the trend
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={filtered} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} />
            <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
            <Tooltip
              contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }}
              formatter={(val: number, _: string, props: any) => [props.payload.full + " " + cfg.unit, cfg.label]}
            />
            <Line
              type="monotone" dataKey="value"
              stroke={cfg.color} strokeWidth={2.5}
              dot={{ r: 4, fill: cfg.color, strokeWidth: 0 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
