import { useState, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import type { LabResult } from "@/lib/types";

interface Props {
  labResults: LabResult[];
}

export function LabTrendChart({ labResults }: Props) {
  const testNames = useMemo(() => {
    const names = Array.from(new Set(labResults.map(r => r.testName)));
    return names;
  }, [labResults]);

  const [selected, setSelected] = useState<string>(testNames[0] ?? "");

  const chartData = useMemo(() => {
    return labResults
      .filter(r => r.testName === selected)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(r => {
        const numeric = parseFloat(r.result ?? "");
        return {
          date: r.date,
          value: isNaN(numeric) ? null : numeric,
          status: r.status,
          rawResult: r.result,
        };
      });
  }, [labResults, selected]);

  const numericData = chartData.filter(d => d.value !== null);

  if (labResults.length === 0) return null;
  if (testNames.length === 0) return null;

  const dotColor = (status: string) => {
    if (status === "critical") return "#dc2626";
    if (status === "abnormal") return "#d97706";
    return "#16a34a";
  };

  return (
    <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: "18px 20px", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", margin: 0 }}>Lab Results Trend</p>
        <select
          value={selected}
          onChange={e => setSelected(e.target.value)}
          style={{ fontSize: 13, padding: "4px 10px", borderRadius: 8, border: "1.5px solid #e2e8f0", outline: "none", color: "#0f172a", background: "#f8fafc" }}
        >
          {testNames.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      {numericData.length < 2 ? (
        <p style={{ fontSize: 13, color: "#94a3b8", textAlign: "center", padding: "20px 0" }}>
          At least 2 numeric results needed for a trend chart.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={numericData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} width={40} />
            <Tooltip
              contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }}
              formatter={(val: number, _: string, entry: any) => [
                `${val} (${entry?.payload?.rawResult ?? val})`,
                selected,
              ]}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#2563eb"
              strokeWidth={2}
              dot={(props: any) => {
                const { cx, cy, payload } = props;
                return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={5} fill={dotColor(payload.status)} stroke="#fff" strokeWidth={2} />;
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}

      {/* Non-numeric results list */}
      {numericData.length === 0 && chartData.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {chartData.map((d, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
              <span style={{ fontSize: 13, color: "#64748b" }}>{d.date}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: dotColor(d.status) }}>{d.rawResult}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
