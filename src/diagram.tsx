// ProfileChartApp.tsx
// GUI React+TypeScript utility to plot two-profile distance/depth charts
// --------------------------------------------------------------------
// • Upload a 3-column CSV (distance, upper, lower) or start with demo data
// • Enter a "Total distance" value to stretch/condense the x-axis
// • Chart updates instantly; uses Recharts for visuals, shadcn/ui for controls

import React, { useCallback, useMemo, useState, useRef, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, RefreshCw } from "lucide-react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

// ---------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------
interface Row {
  distance: number;
  upper: number;
  lower: number;
}

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------
/** Rescales distances so the last point equals the desired total. */
function scaleDistances(data: Row[], total: number): Row[] {
  if (!data.length) return data;
  const span = data[data.length - 1].distance;
  const factor = total / span;
  return data.map((r) => ({ ...r, distance: r.distance * factor }));
}

// Demo fallback data (same shape as original example)
const DEMO: Row[] = [
  { distance: 0, upper:0, lower: -1.2 },
  { distance: 2, upper: 0, lower: -1.3 },
  { distance: 5, upper: 0, lower: -1.3 },
  { distance: 8, upper: 0, lower: -1.3 },
  { distance: 10, upper: 0, lower: -1.2 },

];

// ---------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------
const STORAGE_KEY = "profileChartState";

const loadInitial = (): { rows: Row[]; total: string; showUpper: boolean } => {
  if (typeof window === "undefined") return { rows: DEMO, total: "10", showUpper: true };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        rows: Array.isArray(parsed.rows) ? parsed.rows : DEMO,
        total: typeof parsed.totalDist === "string" ? parsed.totalDist : "10",
        showUpper: typeof parsed.showUpper === "boolean" ? parsed.showUpper : true,
      };
    }
  } catch {
    /* ignore */
  }
  return { rows: DEMO, total: "10", showUpper: true };
};

const ProfileChartApp: React.FC = () => {
  const init = loadInitial();
  const [rows, setRows] = useState<Row[]>(init.rows);
  const [totalDist, setTotalDist] = useState<string>(init.total);
  const [showUpper, setShowUpper] = useState<boolean>(init.showUpper);

  // ---------------------------------------------------------------
  // Drag-to-edit state & refs
  // ---------------------------------------------------------------
  type DragTarget = { line: "upper" | "lower"; index: number };
  const [dragging, setDragging] = useState<DragTarget | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  // -------------------------------------------------------------------
  // Event handlers
  // -------------------------------------------------------------------
  const handleReset = () => {
    setRows(DEMO);
    setTotalDist("10");
    setShowUpper(true);
    if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
  };

  // -------------------------------------------------------------------
  // Derived data
  // -------------------------------------------------------------------
  const stretched = useMemo(() => {
    const total = Number(totalDist);
    if (!total || total <= 0) return rows;
    return scaleDistances(rows, total);
  }, [rows, totalDist]);

  // Axis limits for padding
  const yMin = Math.min(...stretched.map((r) => r.lower));
  const yMax = Math.max(...stretched.map((r) => r.upper));
  const yPad = (yMax - yMin) * 0.1 || 1;

  // -------------------------------------------------------------------
  // Drag helpers
  // -------------------------------------------------------------------
  const renderDot = useCallback(
    (line: "upper" | "lower") =>
      // Recharts passes rendering props such as cx, cy, index...
      (props: any) => {
        const { cx, cy, index } = props;
        return (
          <circle
            cx={cx}
            cy={cy}
            r={4}
            fill={line === "upper" ? "#22c55e" : "#2563eb"}
            stroke="white"
            strokeWidth={1}
            style={{ cursor: "ns-resize" }}
            onMouseDown={(e) => {
              e.stopPropagation();
              setDragging({ line, index });
            }}
          />
        );
      },
    []
  );

  // Effect to process mouse move / up while dragging
  useEffect(() => {
    if (!dragging) return;

    function handleMove(e: MouseEvent) {
      if (!chartRef.current || !dragging) return;

      const rect = chartRef.current.getBoundingClientRect();
      const marginTop = 20; // Must match LineChart margin.top
      const marginBottom = 20; // Must match LineChart margin.bottom
      const height = rect.height - marginTop - marginBottom;
      if (height <= 0) return;

      const yPixel = e.clientY - rect.top - marginTop;

      // Convert pixel position to data value
      const domainMin = yMin - yPad;
      const domainMax = yMax + yPad;
      let newVal = domainMax - (yPixel / height) * (domainMax - domainMin);

      // Clamp to domain to avoid weird jumps
      newVal = Math.max(domainMin, Math.min(domainMax, newVal));

      setRows((prev) =>
        prev.map((row, idx) => {
          if (idx !== dragging.index) return row;
          return dragging.line === "upper"
            ? { ...row, upper: newVal }
            : { ...row, lower: newVal };
        })
      );
    }

    const handleUp = () => setDragging(null);

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [dragging, yMin, yMax, yPad]);

  // Row edit helpers ---------------------------------------------------
  const handleRowChange = useCallback(
    (idx: number, field: keyof Row, value: number) => {
      setRows((prev) => {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], [field]: value } as Row;
        return copy;
      });
    },
    []
  );

  const addRow = () => {
    const lastDist = rows.length ? rows[rows.length - 1].distance : 0;
    setRows([...rows, { distance: lastDist + 1, upper: 0, lower: 0 }]);
  };

  const deleteRow = (idx: number) => setRows(rows.filter((_, i) => i !== idx));

  // -------------------------------------------------------------------
  // Export helpers
  // -------------------------------------------------------------------
  const exportPng = async () => {
    if (!chartRef.current) return;
    const canvas = await html2canvas(chartRef.current, { backgroundColor: "white" });
    const url = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = url;
    link.download = "grezimas.png";
    link.click();
  };

  const exportPdf = async () => {
    if (!chartRef.current) return;
    const canvas = await html2canvas(chartRef.current, { backgroundColor: "white" });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: [canvas.width, canvas.height] });
    pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
    pdf.save("grezimas.pdf");
  };

  // Persist to localStorage whenever key data changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload = { rows, totalDist, showUpper };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* ignore storage errors */
    }
  }, [rows, totalDist, showUpper]);

  return (
    <div className="min-h-screen bg-gray-50 p-6 container mx-auto max-w-7xl">
      <h1 className="text-2xl font-bold mb-4">Distance/Depth Profile Chart</h1>

      {/* Controls ---------------------------------------------------- */}
      <Card className="p-4 mb-6 shadow-md rounded-2xl">
        <CardContent className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
          <label className="flex flex-col gap-2">
            <span className="font-medium">Total distance (m)</span>
            <Input
              type="number"
              value={totalDist}
              onChange={(e) => setTotalDist(e.target.value)}
              placeholder="10"
              min={1}
            />
          </label>

          <label className="flex items-center gap-2 mt-2 md:mt-0">
            <input
              type="checkbox"
              checked={showUpper}
              onChange={() => setShowUpper((p) => !p)}
              className="h-4 w-4 accent-green-500"
            />
            <span>Show upper</span>
          </label>

          <div className="flex gap-3 mt-2 md:mt-0">
            <Button variant="outline" onClick={handleReset} className="gap-1">
              <RefreshCw size={16} /> Reset demo
            </Button>
          </div>

          <div className="flex gap-3 mt-2 md:mt-0">
            <Button variant="outline" onClick={exportPng} className="gap-1">
              Export PNG
            </Button>
            <Button variant="outline" onClick={exportPdf} className="gap-1">
              Export PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Editable table ------------------------------------------------ */}
      <Card className="p-4 mb-6 shadow-md rounded-2xl">
        <CardContent>
          <table className="w-full text-sm mb-3">
            <thead>
              <tr className="text-left font-medium">
                <th className="p-1">#</th>
                <th className="p-1">Distance</th>
                <th className="p-1">Upper</th>
                <th className="p-1">Lower</th>
                <th className="p-1"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t">
                  <td className="p-1">{i + 1}</td>
                  <td className="p-1">
                    <Input
                      type="number"
                      value={r.distance}
                      step={1}
                      onChange={(e) =>
                        handleRowChange(i, "distance", Number(e.target.value))
                      }
                      className="w-24"
                    />
                  </td>
                  <td className="p-1">
                    <Input
                      type="number"
                      value={r.upper}
                      step={0.1}
                      onChange={(e) =>
                        handleRowChange(i, "upper", Number(e.target.value))
                      }
                      className="w-24"
                    />
                  </td>
                  <td className="p-1">
                    <Input
                      type="number"
                      value={r.lower}
                      step={0.1}
                      onChange={(e) =>
                        handleRowChange(i, "lower", Number(e.target.value))
                      }
                      className="w-24"
                    />
                  </td>
                  <td className="p-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteRow(i)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Button variant="outline" className="gap-1" onClick={addRow}>
            <Plus size={16} /> Add row
          </Button>
        </CardContent>
      </Card>

      {/* Chart ------------------------------------------------------- */}
      <Card className="p-4 shadow-md rounded-2xl">
        <CardContent>
          {/* ResponsiveContainer ensures the chart scales with its parent */}
          <div ref={chartRef} className="w-full h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stretched} margin={{ top: 20, right: 30, bottom: 40, left: 50 }}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
                <XAxis
                  dataKey="distance"
                  label={{ value: "Distance (m)", position: "insideBottom", dy: 20 }}
                  tickFormatter={(v: number) => Math.round(v).toString()}
                />
                <YAxis
                  domain={[yMin - yPad, yMax + yPad]}
                  label={{ value: "Depth (m)", angle: -90, position: "insideLeft", dx: -30 }}
                  tickFormatter={(v: number) => {
                    const s = v.toFixed(2);
                    return s.replace(/\.0+$/, "").replace(/(\.\d)0$/, "$1");
                  }}
                />
                <Tooltip formatter={(v: number) => v.toFixed(2)} />
                {showUpper && (
                  <Line
                    type="monotone"
                    dataKey="upper"
                    name="Upper"
                    stroke="#22c55e"
                    dot={renderDot("upper")}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="lower"
                  name="Lower"
                  stroke="#2563eb"
                  dot={renderDot("lower")}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfileChartApp;