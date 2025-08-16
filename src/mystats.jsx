import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, BarChart, Bar, Legend } from "recharts";

const CARD = "#111827D9";
const HILITE = "#1F2937";

export default function MyStats({ user }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true); setMsg("");
    try {
      const { data, error } = await supabase
        .from("attempts")
        .select("id, score, total, created_at, details")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(500);
      if (error) throw error;
      setRows(data || []);
    } catch (e) {
      setMsg(e.message);
    } finally { setLoading(false); }
  }

  const timeline = useMemo(() => rows.map(r => ({
    t: new Date(r.created_at).toLocaleDateString(),
    pct: Math.round((r.score / (r.total || 1)) * 100),
  })), [rows]);

  // Schwierig nach Kategorie (aus attempt.details -> category)
  const byCat = useMemo(() => {
    const map = new Map();
    rows.forEach(r => {
      (r.details || []).forEach(d => {
        const cat = d.category || "Allgemein";
        const s = map.get(cat) || { cat, ok: 0, total: 0 };
        s.ok += d.ok ? 1 : 0;
        s.total += 1;
        map.set(cat, s);
      });
    });
    return Array.from(map.values()).map(x => ({ cat: x.cat, accuracy: x.total ? Math.round((x.ok / x.total) * 100) : 0 }));
  }, [rows]);

  async function resetMyHistory() {
    if (!window.confirm("Eigene Kurzzeit-Statistik wirklich löschen? (Langzeitarchiv bleibt unberührt)")) return;
    // einfache Variante: letzte 500 Versuche löschen
    const ids = rows.map(r => r.id);
    if (ids.length === 0) return;
    const { error } = await supabase.from("attempts").delete().in("id", ids);
    if (error) { alert(error.message); return; }
    await load();
  }

  const avg = useMemo(() => {
    if (rows.length === 0) return 0;
    return Math.round(rows.reduce((s, r) => s + r.score / r.total, 0) / rows.length * 100);
  }, [rows]);
  const best = useMemo(() => rows.length ? Math.max(...rows.map(r => Math.round((r.score / r.total) * 100))) : 0, [rows]);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ background: CARD, border: `1px solid ${HILITE}`, borderRadius: 12, padding: 14 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <b>Meine Statistik</b>
          <span style={{ color: "#9CA3AF" }}>Durchschnitt: {avg}% · Best: {best}% · Versuche: {rows.length}</span>
          <button onClick={load} style={{ marginLeft: "auto", padding: "6px 10px", borderRadius: 8, border: `1px solid ${HILITE}`, background: "#0B1220", color: "white" }}>Neu laden</button>
          <button onClick={resetMyHistory} style={{ padding: "6px 10px", borderRadius: 8, border: "none", background: "#DC2626", color: "white" }}>Meine Statistik zurücksetzen</button>
        </div>

        <div style={{ height: 300, marginTop: 12 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={timeline}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="t" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="pct" name="Punkte (%)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ background: CARD, border: `1px solid ${HILITE}`, borderRadius: 12, padding: 14 }}>
        <b>Kategorien – Genauigkeit</b>
        <div style={{ height: 320, marginTop: 12 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byCat}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="cat" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Bar dataKey="accuracy" name="Richtig (%)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {msg && <div style={{ color: "#F87171" }}>{msg}</div>}
    </div>
  );
}
