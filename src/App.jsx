import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

/** ===== Branding ===== */
const MERKUR_LOGO_URL = ""; // echte Logo-URL einsetzen oder leer lassen
const ACCENT = "#FFD300";
const DEEP = "#0F172A";
const CARD = "#111827D9";
const HILITE = "#1F2937";

const VALID_TABS = ["quiz", "stats", "admin"];
const asEmail = (name) => (name.includes("@") ? name.trim() : `${name.trim().toUpperCase()}@quiz.local`);
const range = (n) => Array.from({ length: n }, (_, i) => i);
const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/** ====== Mini Chart Helpers (pure SVG, keine Libs) ====== */
function Bars({ values = [], width = 320, height = 120, pad = 8, color = ACCENT, bg = "#0B1220" }) {
  const max = Math.max(1, ...values);
  const w = width - pad * 2;
  const h = height - pad * 2;
  const bw = values.length ? w / values.length - 4 : 0;
  return (
    <svg width={width} height={height} style={{ display: "block", background: bg, borderRadius: 10, border: `1px solid ${HILITE}` }}>
      <rect x="0" y="0" width={width} height={height} fill={bg} rx="10" />
      {values.map((v, i) => {
        const bh = (v / max) * h;
        const x = pad + i * (bw + 4);
        const y = pad + (h - bh);
        return <rect key={i} x={x} y={y} width={bw} height={bh} fill={color} rx="3" />;
      })}
      {/* Linie für 100% wenn sinnvoll */}
      <line x1={pad} x2={pad + w} y1={pad} y2={pad} stroke="#334155" strokeDasharray="4 4" />
    </svg>
  );
}

function Sparkline({ values = [], width = 320, height = 60, color = ACCENT, bg = "#0B1220", pad = 8 }) {
  if (!values.length) return (
    <svg width={width} height={height} style={{ display: "block", background: bg, borderRadius: 10, border: `1px solid ${HILITE}` }} />
  );
  const min = Math.min(...values);
  const max = Math.max(...values);
  const w = width - pad * 2;
  const h = height - pad * 2;
  const normY = (v) => (max === min ? 0.5 : (v - min) / (max - min));
  const pts = values.map((v, i) => {
    const x = pad + (i / Math.max(1, values.length - 1)) * w;
    const y = pad + (1 - normY(v)) * h;
    return [x, y];
  });
  const d = pts.map(([x, y], i) => (i ? `L${x},${y}` : `M${x},${y}`)).join(" ");
  return (
    <svg width={width} height={height} style={{ display: "block", background: bg, borderRadius: 10, border: `1px solid ${HILITE}` }}>
      <rect x="0" y="0" width={width} height={height} fill={bg} rx="10" />
      <path d={d} fill="none" stroke={color} strokeWidth="2" />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.5" fill={color} />
      ))}
    </svg>
  );
}

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

/** ===== Quiz-Karte ===== */
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

/** ===== Admin-Form für eine Frage ===== */
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
        correct_idx: correct,
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
      <input placeholder="Fragetext"
        value={text} onChange={(e) => setText(e.target.value)}
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

export default function App() {
  /** Auth */
  const [name, setName] = useState("");
  const [pwd, setPwd] = useState("");
  const [first, setFirst] = useState(false);
  const [user, setUser] = useState(null);
  const [role, setRole] = useState("");
  const [authMsg, setAuthMsg] = useState("");

  /** Tabs (Hash-Routing) */
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
  const [teamAgg, setTeamAgg] = useState([]); // [{email, count, avg, best, lastAt}]
  const [statsLoading, setStatsLoading] = useState(false);

  /** Admin */
  const [adminList, setAdminList] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [editing, setEditing] = useState(null);

  /** Hash-Router */
  useEffect(() => {
    const init = () => {
      const h = (window.location.hash || "#quiz").slice(1);
      if (VALID_TABS.includes(h)) setTab(h);
    };
    const onHash = () => {
      const h = (window.location.hash || "#quiz").slice(1);
      if (VALID_TABS.includes(h)) setTab(h);
    };
    init();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const goTab = (t) => { setTab(t); window.location.hash = t; };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data?.user || null;
      setUser(u);
      setRole(u?.app_metadata?.role || "user");
      if (u) fetchQuestions();
    });
  }, []);

  useEffect(() => {
    if (tab === "stats" && user) {
      loadMyStats();
      if (role === "admin") loadTeamStats();
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
    setUser(null); setRole(""); setQuestions([]); setAnswers({}); setShowResult(false); setSavedAttempt(false); setTab("quiz"); setName(""); setPwd("");
    window.location.hash = "quiz";
  }

  async function fetchQuestions() {
    setLoading(true); setAnswers({}); setShowResult(false); setSavedAttempt(false);
    let rpcErr = null;
    try {
      const { data, error } = await supabase.rpc("get_random_questions_mc", { limit_count: 20 });
      if (error) rpcErr = error;
      if (Array.isArray(data) && data.length) {
        setQuestions(data.map((r) => ({ id: r.id, text: r.text, options: r.options || [], correct_idx: r.correct_idx ?? null })));
        setLoading(false); return;
      }
    } catch (e) { rpcErr = e; }
    try {
      const { data, error } = await supabase.from("questions")
        .select("id, text, options, correct_idx, active, qtype").eq("qtype", "mc").eq("active", true);
      if (error) throw error;
      const pool = (data || []).filter((r) => Array.isArray(r.options) && typeof r.correct_idx === "number");
      const picked = shuffle(pool).slice(0, 20);
      setQuestions(picked.map((r) => ({ id: r.id, text: r.text, options: r.options, correct_idx: r.correct_idx })));
    } catch (e2) {
      setAuthMsg("Fehler beim Laden der Fragen:\n" + (rpcErr?.message || "") + "\n" + e2.message);
    } finally { setLoading(false); }
  }

  async function saveAttempt() {
    if (!user || savedAttempt) return;
    try {
      const payload = {
        user_id: user.id,
        email: user.email,
        score: score,
        total: questions.length,
        details: questions.map((q) => ({ id: q.id, chosen: answers[q.id], correct: q.correct_idx, ok: answers[q.id] === q.correct_idx }))
      };
      const { error } = await supabase.from("attempts").insert(payload).select("id").single();
      if (error) throw error;
      setSavedAttempt(true);
      // direkt updaten, damit #stats sofort Daten zeigt
      await loadMyStats();
      if (role === "admin") await loadTeamStats();
    } catch (e) {
      console.warn("saveAttempt failed:", e.message);
    }
  }

  /** Stats laden */
  async function loadMyStats() {
    setStatsLoading(true);
    try {
      const { data, error } = await supabase
        .from("attempts")
        .select("id, score, total, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);
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
        .select("user_id, email, score, total, created_at")
        .order("created_at", { ascending: false })
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
        const lastAt = arr[0]?.created_at;
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

  /** UI */
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

  // Daten für Diagramme
  const last10Pct = (myAttempts || [])
    .slice(0, 10)
    .map((a) => Math.round((a.score / Math.max(1, a.total)) * 100))
    .reverse(); // älteste links

  const leaderboard = (teamAgg || []).slice(0, 8);
  const leaderboardVals = leaderboard.map((r) => r.avg);

  return (
    <div style={{
      minHeight: "100vh",
      background: `radial-gradient(1200px 700px at 105% -10%, rgba(255,211,0,.12), transparent 55%), ${DEEP}`,
      padding: 20, color: "#E5E7EB"
    }}>
      <div style={{ width: "min(1100px, 94vw)", margin: "0 auto", display: "grid", gap: 18 }}>
        {header}

        {/* Tabs als Links (#) */}
        <div style={{ display: "flex", gap: 10 }}>
          <a href="#quiz" onClick={(e)=>{e.preventDefault(); goTab("quiz");}}
            style={{
              padding: "10px 12px", borderRadius: 10, textDecoration: "none",
              background: tab === "quiz" ? ACCENT : "#0B1220",
              color: tab === "quiz" ? "#111827" : "#E5E7EB",
              border: tab === "quiz" ? "none" : `1px solid ${HILITE}`, fontWeight: 800, cursor: "pointer"
            }}>
            Quiz
          </a>
          <a href="#stats" onClick={(e)=>{e.preventDefault(); goTab("stats");}}
            style={{
              padding: "10px 12px", borderRadius: 10, textDecoration: "none",
              background: tab === "stats" ? ACCENT : "#0B1220",
              color: tab === "stats" ? "#111827" : "#E5E7EB",
              border: tab === "stats" ? "none" : `1px solid ${HILITE}`, fontWeight: 800, cursor: "pointer"
            }}>
            Statistik
          </a>
          {role === "admin" && (
            <a href="#admin" onClick={(e)=>{e.preventDefault(); goTab("admin"); loadAdminList();}}
              style={{
                padding: "10px 12px", borderRadius: 10, textDecoration: "none",
                background: tab === "admin" ? ACCENT : "#0B1220",
                color: tab === "admin" ? "#111827" : "#E5E7EB",
                border: tab === "admin" ? "none" : `1px solid ${HILITE}`, fontWeight: 800, cursor: "pointer"
              }}>
              Admin
            </a>
          )}
          <div style={{ marginLeft: "auto", color: "#9CA3AF" }}>
            {tab === "quiz" && (loading ? "Lade Fragen…" : `${questions.length} Fragen geladen${showResult ? ` · Ergebnis: ${score}/${questions.length}` : ""}`)}
            {tab === "stats" && (statsLoading ? "Lade Statistik…" : "")}
            {tab === "admin" && (adminLoading ? "Lade…" : `${adminList.length} Fragen`)}
          </div>
        </div>

        {/* Inhalt */}
        {tab === "quiz" ? (
          <>
            {/* OBERER Bereich – nur „Neu laden“ bleibt oben */}
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

            {/* FRAGENLISTE */}
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
                {/* AUSWERTEN – unten */}
                <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                  <button
                    onClick={async () => {
                      if (!allAnswered) return;
                      setShowResult(true);
                      await saveAttempt();
                    }}
                    disabled={!allAnswered}
                    style={{
                      padding: "10px 12px", background: allAnswered ? ACCENT : "#6B7280",
                      color: "#111827", borderRadius: 10, fontWeight: 800, border: "none",
                      cursor: allAnswered ? "pointer" : "not-allowed"
                    }}>
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
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <StatBadge label="Versuche" value={mySummary.count} />
                <StatBadge label="Durchschnitt" value={`${mySummary.avg}%`} />
                <StatBadge label="Bestleistung" value={`${mySummary.best}%`} />
                <div style={{ marginLeft: "auto" }}>
                  <button onClick={loadMyStats}
                    style={{ padding: "8px 12px", background: "#0B1220", border: `1px solid ${HILITE}`, color: "#E5E7EB", borderRadius: 10, cursor: "pointer" }}>
                    ↻ Aktualisieren
                  </button>
                </div>
              </div>

              {/* Charts für mich */}
              <div style={{ marginTop: 12, display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
                <div>
                  <div style={{ color: "#9CA3AF", marginBottom: 6 }}>Letzte 10 Versuche (Prozent)</div>
                  <Bars values={last10Pct} width={520} height={140} />
                </div>
                <div>
                  <div style={{ color: "#9CA3AF", marginBottom: 6 }}>Trend (Prozent)</div>
                  <Sparkline values={last10Pct} width={520} height={140} />
                </div>
              </div>

              <div style={{ marginTop: 14, display: "grid", gap: 6 }}>
                {(myAttempts || []).map((a) => (
                  <div key={a.id} style={{ display: "flex", justifyContent: "space-between", background: "#0B1220", border: `1px solid ${HILITE}`, borderRadius: 8, padding: "8px 10px" }}>
                    <span style={{ color: "#E5E7EB" }}>{new Date(a.created_at).toLocaleString()}</span>
                    <span style={{ color: "#CBD5E1" }}>{a.score} / {a.total} ({Math.round((a.score / a.total) * 100)}%)</span>
                  </div>
                ))}
                {myAttempts.length === 0 && <div style={{ color: "#9CA3AF" }}>Noch keine Versuche.</div>}
              </div>
            </div>

            {/* Team-Statistik (Admin) */}
            {role === 'admin' && (
              <div style={{ background: CARD, border: `1px solid ${HILITE}`, borderRadius: 12, padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ fontWeight: 800 }}>Team-Statistik</div>
                  <div style={{ marginLeft: "auto" }}>
                    <button onClick={loadTeamStats}
                      style={{ padding: "8px 12px", background: "#0B1220", border: `1px solid ${HILITE}`, color: "#E5E7EB", borderRadius: 10, cursor: "pointer" }}>
                      ↻ Aktualisieren
                    </button>
                  </div>
                </div>

                {/* Leaderboard Balken */}
                <div style={{ marginTop: 12 }}>
                  <div style={{ color: "#9CA3AF", marginBottom: 6 }}>Durchschnitt nach Nutzer (Top 8)</div>
                  <Bars values={leaderboardVals} width={1060} height={160} />
                </div>

                {/* Tabelle */}
                <div style={{ marginTop: 12, display: "grid", gap: 6 }}>
                  {leaderboard.map((r) => (
                    <div key={r.email} style={{ display: "grid", gridTemplateColumns: "1.2fr .5fr .8fr .8fr", gap: 8, background: "#0B1220", border: `1px solid ${HILITE}`, borderRadius: 8, padding: "8px 10px" }}>
                      <div style={{ color: "#E5E7EB" }}>{r.email}</div>
                      <div style={{ color: "#CBD5E1" }}>{r.count}×</div>
                      <div style={{ color: "#CBD5E1" }}>{r.avg}% ⌀ · Best {r.best}%</div>
                      <div style={{ color: "#9CA3AF", textAlign: "right" }}>{r.lastAt ? new Date(r.lastAt).toLocaleString() : "–"}</div>
                    </div>
                  ))}
                  {leaderboard.length === 0 && <div style={{ color: "#9CA3AF" }}>Keine Daten vorhanden.</div>}
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
