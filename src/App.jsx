import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

/** ===== Branding ===== */
const MERKUR_LOGO_URL = ""; // echte Logo-URL einsetzen oder leer lassen
const ACCENT = "#FFD300";
const DEEP = "#0F172A";
const CARD = "#111827D9";
const HILITE = "#1F2937";

/** ===== Helpers ===== */
const asEmail = (name) =>
  name.includes("@") ? name.trim() : `${name.trim().toUpperCase()}@quiz.local`;
const range = (n) => Array.from({ length: n }, (_, i) => i);
const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/** ===== Mini-Chart-Komponenten (SVG, ohne Libs) ===== */
function Sparkline({ values = [], width = 280, height = 60 }) {
  if (!values.length) return null;
  const max = 100, min = 0;
  const stepX = width / Math.max(1, values.length - 1);
  const last = values[values.length - 1];
  const pts = values.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / (max - min)) * height;
    return `${x},${y}`;
  });
  return (
    <svg width={width} height={height}>
      <polyline fill="none" stroke={ACCENT} strokeWidth="2.5" points={pts.join(" ")} />
      <circle
        cx={(values.length - 1) * stepX}
        cy={height - ((last - min) / (max - min)) * height}
        r="3.8"
        fill={ACCENT}
      />
    </svg>
  );
}
function Donut({ value = 0, size = 120 }) {
  const r = size / 2 - 10, c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, value));
  const dash = (p / 100) * c;
  return (
    <svg width={size} height={size}>
      <g transform={`translate(${size / 2}, ${size / 2})`}>
        <circle r={r} fill="none" stroke="#334155" strokeWidth="12" />
        <circle r={r} fill="none" stroke={ACCENT} strokeWidth="12" strokeDasharray={`${dash} ${c - dash}`} transform="rotate(-90)" strokeLinecap="round" />
        <text x="0" y="6" textAnchor="middle" fontWeight="800" fontSize="22" fill="#E5E7EB">{Math.round(p)}%</text>
      </g>
    </svg>
  );
}
function Bars({ rows = [], width = 520, height = 200 }) {
  const pad = 28, w = width - pad * 2, h = height - pad * 2;
  const max = Math.max(100, ...rows.map((r) => r.value));
  const barW = rows.length ? w / rows.length - 8 : 0;
  return (
    <svg width={width} height={height}>
      <g transform={`translate(${pad},${pad})`}>
        <line x1="0" y1={h} x2={w} y2={h} stroke="#64748B" strokeWidth="1" />
        {rows.map((r, i) => {
          const x = i * (barW + 8);
          const barH = (r.value / max) * h;
          const y = h - barH;
          return (
            <g key={r.label} transform={`translate(${x},0)`}>
              <rect x="0" y={y} width={barW} height={barH} fill={ACCENT} />
              <text x={barW / 2} y={h + 14} textAnchor="middle" fontSize="10" fill="#CBD5E1">{r.label}</text>
              <text x={barW / 2} y={y - 6} textAnchor="middle" fontSize="10" fill="#E5E7EB">{r.value}%</text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

/** ===== UI Bits ===== */
function Sun() {
  return MERKUR_LOGO_URL ? (
    <img src={MERKUR_LOGO_URL} alt="Merkur" style={{ width: 28, height: 28, borderRadius: "50%" }} />
  ) : (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="5.5" fill={ACCENT} />
      <g stroke={ACCENT} strokeWidth="1.8" strokeLinecap="round">
        <line x1="12" y1="1.5" x2="12" y2="4.2" />
        <line x1="12" y1="19.8" x2="12" y2="22.5" />
        <line x1="1.5" y1="12" x2="4.2" y2="12" />
        <line x1="19.8" y1="12" x2="22.5" y2="12" />
        <line x1="4.1" y1="4.1" x2="6.1" y2="6.1" />
        <line x1="17.9" y1="17.9" x2="15.9" y2="15.9" />
        <line x1="4.1" y1="19.9" x2="6.1" y2="17.9" />
        <line x1="17.9" y1="4.1" x2="15.9" y2="6.1" />
      </g>
    </svg>
  );
}

/** ===== Quiz-Karte (mit rot/grün Umrandung bei showResult) ===== */
function QuestionCard({ index, q, selected, onSelect, showResult }) {
  const isCorrect = showResult && selected === q.correct_idx;
  const isWrong = showResult && selected != null && selected !== q.correct_idx;
  return (
    <div style={{
      background: CARD, borderRadius: 14, padding: 18,
      border: `2px solid ${isCorrect ? "#16A34A" : isWrong ? "#DC2626" : "transparent"}`,
      boxShadow: "0 2px 10px rgba(0,0,0,.35)"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#D1D5DB" }}>
        <div style={{
          width: 28, height: 28, borderRadius: "50%", background: HILITE,
          border: `2px solid ${ACCENT}`, display: "grid", placeItems: "center", fontSize: 12
        }}>{index + 1}</div>
        <div style={{ fontWeight: 600, color: "#E5E7EB" }}>{q.text}</div>
      </div>
      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
        {q.options.map((opt, i) => {
          const chosen = selected === i;
          const correct = showResult && i === q.correct_idx;
          const wrong = showResult && chosen && i !== q.correct_idx;
          return (
            <button key={i} type="button" onClick={() => onSelect(i)} disabled={showResult}
              style={{
                textAlign: "left", borderRadius: 12, padding: "12px 14px",
                background: chosen ? "#1F2937" : "#0B1220", color: "#E5E7EB",
                border: `2px solid ${correct ? "#16A34A" : wrong ? "#DC2626" : chosen ? ACCENT : "#1F2937"}`,
                cursor: showResult ? "default" : "pointer"
              }}>
              {opt}
            </button>
          );
        })}
      </div>
      {showResult && (
        <div style={{ marginTop: 10, color: isCorrect ? "#16A34A" : "#F87171" }}>
          {isCorrect ? "Richtig ✔" : `Falsch ✖ – korrekt: ${q.options[q.correct_idx]}`}
        </div>
      )}
    </div>
  );
}

/** ===== Admin-Editor ===== */
function AdminEditor({ editing, onCancel, onSaved }) {
  const isEdit = !!editing;
  const [text, setText] = useState(editing?.text || "");
  const [opts, setOpts] = useState(() => {
    const base = editing?.options || ["", "", "", ""];
    return [...base, ...range(Math.max(0, 4 - base.length)).map(() => "")].slice(0, 4);
  });
  const [correct, setCorrect] = useState(editing?.correct_idx ?? 0);
  const [active, setActive] = useState(editing?.active ?? true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    setErr("");
    if (!text.trim()) { setErr("Fragetext fehlt"); return; }
    const clean = opts.map((o) => o.trim()).filter(Boolean);
    if (clean.length < 2) { setErr("Mindestens 2 Optionen erforderlich"); return; }
    if (correct < 0 || correct >= clean.length) { setErr("Korrekter Index ist außerhalb des Bereichs"); return; }
    setSaving(true);
    try {
      const payload = {
        id: editing?.id,
        text: text.trim(),
        qtype: "mc",
        options: clean,
        correct_idx: Math.min(correct, clean.length - 1),
        active,
      };
      const { error } = await supabase.from("questions").upsert(payload).select("id").single();
      if (error) throw error;
      onSaved?.();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ background: CARD, border: `1px solid ${HILITE}`, borderRadius: 12, padding: 14, display: "grid", gap: 10 }}>
      <div style={{ fontWeight: 700, color: "#E5E7EB" }}>{isEdit ? "Frage bearbeiten" : "Neue Frage anlegen"}</div>
      <input placeholder="Fragetext" value={text} onChange={(e) => setText(e.target.value)}
        style={{ padding: "10px 12px", background: "#0B1220", color: "#E5E7EB", borderRadius: 10, border: `1px solid ${HILITE}` }} />
      {range(4).map((i) => (
        <div key={i} style={{ display: "flex", gap: 10 }}>
          <input placeholder={`Option ${i + 1}`} value={opts[i] || ""}
            onChange={(e) => setOpts((p) => { const c = p.slice(); c[i] = e.target.value; return c; })}
            style={{ flex: 1, padding: "10px 12px", background: "#0B1220", color: "#E5E7EB", borderRadius: 10, border: `1px solid ${HILITE}` }} />
          <label style={{ display: "flex", alignItems: "center", gap: 6, color: "#E5E7EB" }}>
            <input type="radio" name="correct" checked={correct === i} onChange={() => setCorrect(i)} /> korrekt
          </label>
        </div>
      ))}
      <label style={{ color: "#E5E7EB", display: "flex", gap: 8, alignItems: "center" }}>
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> aktiv
      </label>
      {err && <div style={{ color: "#F87171" }}>{err}</div>}
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={save} disabled={saving}
          style={{ padding: "10px 12px", background: ACCENT, color: "#111827", fontWeight: 800, border: "none", borderRadius: 10, cursor: "pointer" }}>
          {isEdit ? "Speichern" : "Anlegen"}
        </button>
        <button onClick={onCancel}
          style={{ padding: "10px 12px", background: "#1F2937", border: `1px solid ${HILITE}`, color: "#E5E7EB", borderRadius: 10, cursor: "pointer" }}>
          Abbrechen
        </button>
      </div>
    </div>
  );
}

/** ===== App ===== */
export default function App() {
  /** Auth */
  const [name, setName] = useState("");
  const [pwd, setPwd] = useState("");
  const [first, setFirst] = useState(false);
  const [user, setUser] = useState(null);
  const [role, setRole] = useState("");
  const [authMsg, setAuthMsg] = useState("");

  /** Tabs */
  const [tab, setTab] = useState("quiz"); // 'quiz' | 'stats' | 'admin'

  /** Quiz */
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [showResult, setShowResult] = useState(false);
  const [savedAttempt, setSavedAttempt] = useState(false);
  const allAnswered = questions.length > 0 && questions.every((q) => answers[q.id] != null);
  const score = useMemo(() => questions.filter((q) => answers[q.id] === q.correct_idx).length, [answers, questions]);

  /** Stats */
  const [myAttempts, setMyAttempts] = useState([]);
  const [mySummary, setMySummary] = useState({ count: 0, avg: 0, best: 0 });
  const [teamAgg, setTeamAgg] = useState([]);
  const [statsLoading, setStatsLoading] = useState(false);

  /** Admin */
  const [adminList, setAdminList] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [editing, setEditing] = useState(null);

  // Nach Login: Fragen holen
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data?.user || null;
      setUser(u);
      setRole(u?.app_metadata?.role || "user");
      if (u) fetchQuestions();
    });
  }, []);

  // Wenn Tab gewechselt wird: Stats nachladen
  useEffect(() => {
    if (tab === "stats" && user) {
      loadMyStats();
      if (role === "admin") loadTeamStats();
    }
    if (tab === "admin" && role === "admin") {
      loadAdminList();
    }
  }, [tab, user, role]);

  async function handleSubmit(e) {
    e.preventDefault();
    setAuthMsg("");
    const email = asEmail(name);

    if (first) {
      const { error } = await supabase.auth.signUp({ email, password: pwd, options: { data: { role: "user" } } });
      if (error) { setAuthMsg(error.message); return; }
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pwd });
    if (error) {
      if (/invalid login|user not found|email not confirmed/i.test(error.message)) setFirst(true);
      else setAuthMsg(error.message);
      return;
    }
    setUser(data.user);
    setRole(data.user?.app_metadata?.role || "user");
    fetchQuestions();
  }

  async function logout() {
    await supabase.auth.signOut();
    setUser(null); setRole(""); setQuestions([]); setAnswers({}); setShowResult(false); setSavedAttempt(false);
    setTab("quiz"); setName(""); setPwd("");
  }

  async function fetchQuestions() {
    setLoading(true); setAnswers({}); setShowResult(false); setSavedAttempt(false);
    let fallbackErr = null;

    // 1) Optional: RPC nutzen, wenn vorhanden
    try {
      const { data, error } = await supabase.rpc("get_random_questions_mc", { limit_count: 20 });
      if (!error && Array.isArray(data) && data.length) {
        setQuestions(data.map((r) => ({ id: r.id, text: r.text, options: r.options || [], correct_idx: r.correct_idx ?? null })));
        setLoading(false); return;
      }
    } catch (e) {
      fallbackErr = e;
    }

    // 2) Fallback: Direkt aus questions lesen (aktive MC)
    try {
      const { data, error } = await supabase
        .from("questions")
        .select("id, text, options, correct_idx, active, qtype")
        .eq("qtype", "mc")
        .eq("active", true);
      if (error) throw error;
      const pool = (data || []).filter((r) => Array.isArray(r.options) && typeof r.correct_idx === "number");
      const picked = shuffle(pool).slice(0, 20);
      setQuestions(picked.map((r) => ({ id: r.id, text: r.text, options: r.options, correct_idx: r.correct_idx })));
      if (picked.length === 0) {
        setAuthMsg("Keine aktiven Multiple-Choice-Fragen gefunden. Lege im Admin-Tab Fragen an oder prüfe RLS-Policies.");
      }
    } catch (e2) {
      setAuthMsg("Fehler beim Laden der Fragen:\n" + (fallbackErr?.message || "") + "\n" + e2.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveAttempt() {
    if (!user || savedAttempt) return;
    try {
      const started = Date.now() - 30000; // grobe Dauer (30s) – optional ersetzen
      const payload = {
        user_id: user.id,
        email: user.email,
        score,
        total: questions.length,
        started_at: new Date(started).toISOString(),
        finished_at: new Date().toISOString(),
        duration_seconds: Math.round((Date.now() - started) / 1000),
        details: questions.map((q) => ({ id: q.id, chosen: answers[q.id], correct: q.correct_idx, ok: answers[q.id] === q.correct_idx })),
      };
      const { error } = await supabase.from("attempts").insert(payload).select("id").single();
      if (error) throw error;
      setSavedAttempt(true);
    } catch (e) {
      console.warn("saveAttempt failed:", e.message);
    }
  }

  async function loadMyStats() {
    setStatsLoading(true);
    try {
      const { data, error } = await supabase
        .from("attempts")
        .select("id, score, total, finished_at")
        .eq("user_id", user.id)
        .order("finished_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      setMyAttempts(data || []);
      const count = data?.length || 0;
      const avg = count ? Math.round((data.reduce((s, a) => s + a.score / a.total, 0) / count) * 100) : 0;
      const best = count ? Math.max(...data.map((a) => Math.round((a.score / a.total) * 100))) : 0;
      setMySummary({ count, avg, best });
    } catch (e) {
      setAuthMsg("Konnte Nutzer-Statistik nicht laden: " + e.message);
    } finally {
      setStatsLoading(false);
    }
  }

  async function loadTeamStats() {
    setStatsLoading(true);
    try {
      const { data, error } = await supabase
        .from("attempts")
        .select("user_id, email, score, total, finished_at")
        .order("finished_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      const byEmail = new Map();
      (data || []).forEach((a) => {
        const key = a.email || a.user_id;
        const arr = byEmail.get(key) || [];
        arr.push(a);
        byEmail.set(key, arr);
      });
      const rows = Array.from(byEmail.entries()).map(([email, arr]) => {
        const count = arr.length;
        const avg = Math.round((arr.reduce((s, x) => s + x.score / x.total, 0) / count) * 100);
        const best = Math.max(...arr.map((x) => Math.round((x.score / x.total) * 100)));
        const lastAt = arr[0]?.finished_at;
        return { email, count, avg, best, lastAt };
      });
      rows.sort((a, b) => b.avg - a.avg || b.best - a.best);
      setTeamAgg(rows);
    } catch (e) {
      setAuthMsg("Konnte Team-Statistik nicht laden: " + e.message);
    } finally {
      setStatsLoading(false);
    }
  }

  async function loadAdminList() {
    setAdminLoading(true);
    try {
      const { data, error } = await supabase
        .from("questions")
        .select("id, text, options, correct_idx, active, qtype, created_at")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      setAdminList(data || []);
    } catch (e) {
      setAuthMsg("Admin-Laden fehlgeschlagen: " + e.message);
    } finally {
      setAdminLoading(false);
    }
  }

  async function removeQuestion(id) {
    if (!window.confirm("Diese Frage wirklich löschen?")) return;
    const { error } = await supabase.from("questions").delete().eq("id", id);
    if (error) { alert(error.message); return; }
    await loadAdminList();
  }

  const header = (
    <div style={{
      background: CARD, padding: 16, borderRadius: 16, border: `1px solid ${HILITE}`,
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Sun />
        <div style={{ fontWeight: 800, fontSize: 20, color: "#E5E7EB" }}>MaQuiz</div>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {user && (
          <span style={{ color: "#9CA3AF", fontSize: 14 }}>
            Angemeldet als <b style={{ color: "#E5E7EB" }}>{user.email}</b>{role === "admin" ? " · Admin" : ""}
          </span>
        )}
        {user ? (
          <button onClick={logout}
            style={{ padding: "8px 12px", background: "#0B1220", border: `1px solid ${HILITE}`, color: "#E5E7EB", borderRadius: 10, cursor: "pointer" }}>
            Abmelden
          </button>
        ) : null}
      </div>
    </div>
  );

  if (!user) {
    return (
      <div style={{
        minHeight: "100vh",
        background: `radial-gradient(1000px 600px at -10% -10%, rgba(255,211,0,.15), transparent 50%), ${DEEP}`,
        display: "grid", placeItems: "center", color: "#E5E7EB", padding: 20
      }}>
        <div style={{ width: "min(680px, 94vw)", background: CARD, padding: 26, borderRadius: 18, boxShadow: "0 6px 26px rgba(0,0,0,.45)", border: `1px solid ${HILITE}` }}>
          {header}
          <h2 style={{ marginTop: 20, marginBottom: 12, color: "#F3F4F6" }}>Login</h2>
          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
            <input placeholder="Benutzername (z. B. ADMIN) oder E-Mail" value={name} onChange={(e) => setName(e.target.value)}
              style={{ padding: "12px 14px", background: "#0B1220", color: "#E5E7EB", borderRadius: 12, border: `1px solid ${HILITE}` }} required />
            <input type="password" placeholder={first ? "Neues Passwort" : "Passwort"} value={pwd} onChange={(e) => setPwd(e.target.value)}
              style={{ padding: "12px 14px", background: "#0B1220", color: "#E5E7EB", borderRadius: 12, border: `1px solid ${HILITE}` }} required />
            <button type="submit"
              style={{ padding: "12px 14px", background: ACCENT, color: "#111827", fontWeight: 700, border: "none", borderRadius: 12, cursor: "pointer" }}>
              {first ? "Konto anlegen & einloggen" : "Einloggen"}
            </button>
          </form>
          {authMsg && <p style={{ marginTop: 10, color: "#F87171", whiteSpace: "pre-wrap" }}>{authMsg}</p>}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: `radial-gradient(1200px 700px at 105% -10%, rgba(255,211,0,.12), transparent 55%), ${DEEP}`,
      padding: 20, color: "#E5E7EB"
    }}>
      <div style={{ width: "min(1100px, 94vw)", margin: "0 auto", display: "grid", gap: 18 }}>
        {header}

        {/* Tabs */}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setTab("quiz")}
            style={{ padding: "10px 12px", borderRadius: 10,
              background: tab === "quiz" ? ACCENT : "#0B1220",
              color: tab === "quiz" ? "#111827" : "#E5E7EB",
              border: tab === "quiz" ? "none" : `1px solid ${HILITE}`, fontWeight: 800, cursor: "pointer" }}>
            Quiz
          </button>
          <button onClick={() => setTab("stats")}
            style={{ padding: "10px 12px", borderRadius: 10,
              background: tab === "stats" ? ACCENT : "#0B1220",
              color: tab === "stats" ? "#111827" : "#E5E7EB",
              border: tab === "stats" ? "none" : `1px solid ${HILITE}`, fontWeight: 800, cursor: "pointer" }}>
            Statistik
          </button>
          {role === "admin" && (
            <button onClick={() => setTab("admin")}
              style={{ padding: "10px 12px", borderRadius: 10,
                background: tab === "admin" ? ACCENT : "#0B1220",
                color: tab === "admin" ? "#111827" : "#E5E7EB",
                border: tab === "admin" ? "none" : `1px solid ${HILITE}`, fontWeight: 800, cursor: "pointer" }}>
              Admin
            </button>
          )}
          <div style={{ marginLeft: "auto", color: "#9CA3AF" }}>
            {tab === "quiz" && (loading ? "Lade Fragen…" : `${questions.length} Fragen geladen${showResult ? ` · Ergebnis: ${score}/${questions.length}` : ""}`)}
            {tab === "stats" && (statsLoading ? "Lade Statistik…" : "")}
            {tab === "admin" && (adminLoading ? "Lade…" : `${adminList.length} Fragen`)}
          </div>
        </div>

        {/* Inhalte */}
        {tab === "quiz" ? (
          <>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={fetchQuestions} disabled={loading}
                style={{ padding: "10px 12px", background: "#0B1220", border: `1px solid ${HILITE}`, color: "#E5E7EB", borderRadius: 10, cursor: "pointer" }}>
                🔄 Neu laden
              </button>
              {showResult && (
                <>
                  <button onClick={() => { setAnswers({}); setShowResult(false); setSavedAttempt(false); }}
                    style={{ padding: "10px 12px", background: "#1F2937", border: `1px solid ${HILITE}`, color: "#E5E7EB", borderRadius: 10, cursor: "pointer" }}>
                    Auswahl zurücksetzen
                  </button>
                  <button onClick={fetchQuestions}
                    style={{ padding: "10px 12px", background: ACCENT, color: "#111827", borderRadius: 10, fontWeight: 800, border: "none", cursor: "pointer" }}>
                    ▶︎ Neue Runde
                  </button>
                </>
              )}
            </div>

            {!showResult ? (
              <>
                <div style={{ display: "grid", gap: 14 }}>
                  {questions.map((q, i) => (
                    <QuestionCard key={q.id} index={i} q={q}
                      selected={answers[q.id]}
                      onSelect={(idx) => setAnswers((p) => ({ ...p, [q.id]: idx }))}
                      showResult={false} />
                  ))}
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                  <button onClick={async () => {
                      if (!allAnswered) return;
                      setShowResult(true);
                      await saveAttempt(); // Speichert Versuch → taucht in Statistik auf
                    }}
                    disabled={!allAnswered}
                    style={{ padding: "10px 12px", background: allAnswered ? ACCENT : "#6B7280",
                      color: "#111827", borderRadius: 10, fontWeight: 800, border: "none",
                      cursor: allAnswered ? "pointer" : "not-allowed" }}>
                    Auswerten
                  </button>
                </div>
              </>
            ) : (
              <div style={{ background: CARD, border: `1px solid ${HILITE}`, borderRadius: 16, padding: 18 }}>
                <h2 style={{ margin: "4px 0 12px 0", color: "#F3F4F6" }}>Auswertung</h2>
                <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
                  <div style={{ background: "#0B1220", border: `1px solid ${HILITE}`, padding: "10px 12px", borderRadius: 10, color: "#E5E7EB" }}>
                    Punktzahl: <b>{score}</b> / {questions.length}
                  </div>
                  <div style={{ background: "#0B1220", border: `1px solid ${HILITE}`, padding: "10px 12px", borderRadius: 10, color: "#E5E7EB" }}>
                    Quote: <b>{Math.round((score / (questions.length || 1)) * 100)}%</b>
                  </div>
                </div>
                <div style={{ display: "grid", gap: 12 }}>
                  {questions.map((q, i) => (
                    <QuestionCard key={q.id} index={i} q={q} selected={answers[q.id]} onSelect={() => {}} showResult />
                  ))}
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                  <button onClick={() => { setAnswers({}); setShowResult(false); setSavedAttempt(false); }}
                    style={{ padding: "10px 12px", background: "#1F2937", border: `1px solid ${HILITE}`, color: "#E5E7EB", borderRadius: 10, cursor: "pointer" }}>
                    Auswahl zurücksetzen
                  </button>
                  <button onClick={fetchQuestions}
                    style={{ padding: "10px 12px", background: ACCENT, color: "#111827", borderRadius: 10, fontWeight: 800, border: "none", cursor: "pointer" }}>
                    ▶︎ Neue Runde
                  </button>
                </div>
              </div>
            )}
          </>
        ) : tab === "stats" ? (
          <div style={{ display: "grid", gap: 14 }}>
            {/* Meine Statistik */}
            <div style={{ background: CARD, border: `1px solid ${HILITE}`, borderRadius: 12, padding: 14 }}>
              <div style={{ fontWeight: 800, marginBottom: 8 }}>Meine Statistik</div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 16, alignItems: "center" }}>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <StatBadge label="Versuche" value={mySummary.count} />
                  <StatBadge label="Durchschnitt" value={`${mySummary.avg}%`} />
                  <StatBadge label="Bestleistung" value={`${mySummary.best}%`} />
                </div>
                <Donut value={myAttempts.length ? Math.round((myAttempts[myAttempts.length - 1].score / myAttempts[myAttempts.length - 1].total) * 100) : 0} />
              </div>

              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                <div style={{ background: "#0B1220", border: `1px solid ${HILITE}`, borderRadius: 10, padding: 10 }}>
                  <div style={{ color: "#E5E7EB", marginBottom: 6, fontWeight: 600 }}>Verlauf (%)</div>
                  <Sparkline values={(myAttempts || []).map((a) => Math.round((a.score / a.total) * 100))} width={560} height={70} />
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  {(myAttempts || []).slice().reverse().map((a) => (
                    <div key={a.id} style={{ display: "flex", justifyContent: "space-between", background: "#0B1220", border: `1px solid ${HILITE}`, borderRadius: 8, padding: "8px 10px" }}>
                      <span style={{ color: "#E5E7EB" }}>{new Date(a.finished_at).toLocaleString()}</span>
                      <span style={{ color: "#CBD5E1" }}>{a.score} / {a.total} ({Math.round((a.score / a.total) * 100)}%)</span>
                    </div>
                  ))}
                  {myAttempts.length === 0 && <div style={{ color: "#9CA3AF" }}>Noch keine Versuche.</div>}
                </div>
              </div>
            </div>

            {/* Team-Statistik (Admin) */}
            {role === "admin" && (
              <div style={{ background: CARD, border: `1px solid ${HILITE}`, borderRadius: 12, padding: 14 }}>
                <div style={{ fontWeight: 800, marginBottom: 8 }}>Team-Statistik</div>
                <div style={{ background: "#0B1220", border: `1px solid ${HILITE}`, borderRadius: 10, padding: 10, marginBottom: 10 }}>
                  <div style={{ color: "#E5E7EB", marginBottom: 6, fontWeight: 600 }}>⌀ Durchschnitt pro Mitarbeiter (Top 10)</div>
                  <Bars rows={teamAgg.slice(0, 10).map((r) => ({ label: (r.email || "").split("@")[0], value: r.avg }))} width={640} height={240} />
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  {(teamAgg || []).map((r) => (
                    <div key={r.email} style={{ display: "grid", gridTemplateColumns: "1.2fr .5fr .5fr .8fr", gap: 8, background: "#0B1220", border: `1px solid ${HILITE}`, borderRadius: 8, padding: "8px 10px" }}>
                      <div style={{ color: "#E5E7EB" }}>{r.email}</div>
                      <div style={{ color: "#CBD5E1" }}>{r.count}×</div>
                      <div style={{ color: "#CBD5E1" }}>{r.avg}% ⌀ / Best {r.best}%</div>
                      <div style={{ color: "#9CA3AF", textAlign: "right" }}>{r.lastAt ? new Date(r.lastAt).toLocaleString() : "–"}</div>
                    </div>
                  ))}
                  {teamAgg.length === 0 && <div style={{ color: "#9CA3AF" }}>Keine Daten vorhanden.</div>}
                </div>
              </div>
            )}
          </div>
        ) : (
          // ===== Admin =====
          <div style={{ display: "grid", gap: 14 }}>
            <AdminEditor
              editing={editing}
              onCancel={() => setEditing(null)}
              onSaved={async () => { setEditing(null); await loadAdminList(); }}
            />
            <div style={{ background: CARD, border: `1px solid ${HILITE}`, borderRadius: 12, padding: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Fragen (neueste zuerst)</div>
              <div style={{ display: "grid", gap: 8 }}>
                {adminList.map((q) => (
                  <div key={q.id} style={{ border: `1px solid ${HILITE}`, borderRadius: 10, padding: 10, background: "#0B1220" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ color: "#E5E7EB", fontWeight: 600 }}>{q.text}</div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <span style={{ color: "#9CA3AF" }}>{q.active ? "aktiv" : "inaktiv"}</span>
                        <button onClick={() => setEditing(q)}
                          style={{ padding: "6px 10px", background: "#1F2937", border: `1px solid ${HILITE}`, color: "#E5E7EB", borderRadius: 8, cursor: "pointer" }}>
                          Bearbeiten
                        </button>
                        <button onClick={() => removeQuestion(q.id)}
                          style={{ padding: "6px 10px", background: "#DC2626", color: "white", border: "none", borderRadius: 8, cursor: "pointer" }}>
                          Löschen
                        </button>
                      </div>
                    </div>
                    <div style={{ marginTop: 6, color: "#CBD5E1", fontSize: 14 }}>
                      {q.options?.map((o, i) => (
                        <span key={i} style={{
                          padding: "2px 8px", borderRadius: 999, marginRight: 6,
                          border: `1px solid ${i === q.correct_idx ? "#16A34A" : HILITE}`, color: i === q.correct_idx ? "#16A34A" : "#CBD5E1"
                        }}>
                          {o}{i === q.correct_idx ? " ✔" : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
                {adminList.length === 0 && <div style={{ color: "#9CA3AF" }}>Keine Fragen gefunden.</div>}
              </div>
            </div>
          </div>
        )}

        {authMsg && <p style={{ color: "#F87171", whiteSpace: "pre-wrap" }}>{authMsg}</p>}
      </div>
    </div>
  );
}

function StatBadge({ label, value }) {
  return (
    <div style={{ background: "#0B1220", border: `1px solid ${HILITE}`, borderRadius: 10, padding: "8px 10px", color: "#E5E7EB" }}>
      <div style={{ fontSize: 12, color: "#9CA3AF" }}>{label}</div>
      <div style={{ fontWeight: 800 }}>{value}</div>
    </div>
  );
}
