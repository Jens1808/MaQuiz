import React, { useEffect, useMemo, useRef, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from "react-router-dom";
import { supabase } from "./supabaseClient";

/** ===== Branding ===== */
const MERKUR_LOGO_URL = ""; // echte Logo-URL einsetzen oder leer lassen
const ACCENT = "#FFD300";
const DEEP = "#0F172A";
const CARD = "#111827D9";
const HILITE = "#1F2937";

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

/** ===== Quiz-Karte (mit roten/grünen Umrandungen) ===== */
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
            <button
              key={i}
              type="button"
              onClick={() => onSelect(i)}
              disabled={showResult}
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

/** ===== Admin-Form ===== */
function AdminEditor({ editing, onCancel, onSaved }) {
  const isEdit = !!editing;
  const [text, setText] = useState(editing?.text || "");
  const [category, setCategory] = useState(editing?.category || "");
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
        category: category || null,
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
      <input placeholder="Kategorie (optional)"
        value={category} onChange={(e) => setCategory(e.target.value)}
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

/** ===== Layout: Header + Auth ===== */
function Header({ user, role, onLogout }) {
  return (
    <div style={{
      background: CARD, padding: 16, borderRadius: 16, border: `1px solid ${HILITE}`,
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Sun />
        <div style={{ fontWeight: 800, fontSize: 20, color: "#E5E7EB" }}>MaQuiz</div>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <Link to="/" style={{ color: "#E5E7EB" }}>Quiz</Link>
        <Link to="/stats" style={{ color: "#E5E7EB" }}>Meine Statistik</Link>
        {role === "admin" && <Link to="/admin" style={{ color: "#E5E7EB" }}>Admin-Dashboard</Link>}
        {user && (
          <span style={{ color: "#9CA3AF", fontSize: 14 }}>
            &nbsp;· Eingeloggt: <b style={{ color: "#E5E7EB" }}>{user.email}</b>{role === "admin" ? " · Admin" : ""}
          </span>
        )}
        {user ? (
          <button onClick={onLogout}
            style={{ padding: "8px 12px", background: "#0B1220", border: `1px solid ${HILITE}`, color: "#E5E7EB", borderRadius: 10, cursor: "pointer" }}>
            Abmelden
          </button>
        ) : null}
      </div>
    </div>
  );
}

function LoginScreen({ onLogin, first, setFirst, authMsg }) {
  const [name, setName] = useState("");
  const [pwd, setPwd] = useState("");

  return (
    <div style={{
      minHeight: "100vh",
      background: `radial-gradient(1000px 600px at -10% -10%, rgba(255,211,0,.15), transparent 50%), ${DEEP}`,
      display: "grid", placeItems: "center", color: "#E5E7EB", padding: 20
    }}>
      <div style={{ width: "min(680px, 94vw)", background: CARD, padding: 26, borderRadius: 18, boxShadow: "0 6px 26px rgba(0,0,0,.45)", border: `1px solid ${HILITE}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Sun />
          <div style={{ fontWeight: 800, fontSize: 20, color: "#E5E7EB" }}>MaQuiz</div>
        </div>
        <h2 style={{ marginTop: 20, marginBottom: 12, color: "#F3F4F6" }}>Login</h2>
        <form onSubmit={(e) => onLogin(e, name, pwd, setFirst)} style={{ display: "grid", gap: 12 }}>
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

/** ===== Quiz-Seite ===== */
function QuizPage({ user, role }) {
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [showResult, setShowResult] = useState(false);
  const [authMsg, setAuthMsg] = useState("");
  const [savedAttempt, setSavedAttempt] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("alle");

  const startedAtRef = useRef(Date.now());

  const allAnswered = questions.length > 0 && questions.every((q) => answers[q.id] != null);
  const score = useMemo(() => questions.filter((q) => answers[q.id] === q.correct_idx).length, [answers, questions]);
  const categories = useMemo(() => {
    const s = new Set();
    questions.forEach((q) => q.category && s.add(q.category));
    return ["alle", ...Array.from(s)];
  }, [questions]);

  useEffect(() => {
    fetchQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFilter]);

  async function fetchQuestions() {
    setLoading(true); setAnswers({}); setShowResult(false); setSavedAttempt(false); startedAtRef.current = Date.now();
    let rpcErr = null;
    try {
      const { data, error } = await supabase.rpc("get_random_questions_mc", { limit_count: 20 });
      if (error) rpcErr = error;
      if (Array.isArray(data) && data.length) {
        let rows = data;
        if (categoryFilter !== "alle") rows = rows.filter((r) => (r.category || null) === categoryFilter);
        const picked = shuffle(rows).slice(0, 20);
        setQuestions(picked.map((r) => ({ id: r.id, text: r.text, options: r.options || [], correct_idx: r.correct_idx ?? null, category: r.category || null })));
        setLoading(false); return;
      }
    } catch (e) { rpcErr = e; }
    try {
      let query = supabase.from("questions")
        .select("id, text, options, correct_idx, active, qtype, category")
        .eq("qtype", "mc").eq("active", true);
      if (categoryFilter !== "alle") query = query.eq("category", categoryFilter);
      const { data, error } = await query;
      if (error) throw error;
      const pool = (data || []).filter((r) => Array.isArray(r.options) && typeof r.correct_idx === "number");
      const picked = shuffle(pool).slice(0, 20);
      setQuestions(picked.map((r) => ({ id: r.id, text: r.text, options: r.options, correct_idx: r.correct_idx, category: r.category || null })));
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
        score,
        total: questions.length,
        started_at: new Date(startedAtRef.current).toISOString(),
        finished_at: new Date().toISOString(),
        duration_seconds: Math.round((Date.now() - startedAtRef.current) / 1000),
        details: questions.map((q) => ({ qid: q.id, chosen: answers[q.id], correct: q.correct_idx, ok: answers[q.id] === q.correct_idx, category: q.category || null }))
      };
      const { error } = await supabase.from("attempts").insert(payload).select("id").single();
      if (error) throw error;
      setSavedAttempt(true);
    } catch (e) {
      console.warn("saveAttempt failed:", e.message);
    }
  }

  return (
    <div style={{ width: "min(1100px, 94vw)", margin: "0 auto", display: "grid", gap: 18, color: "#E5E7EB" }}>
      {/* Filter + Buttons */}
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
          style={{ padding: "10px 12px", background: "#0B1220", border: `1px solid ${HILITE}`, color: "#E5E7EB", borderRadius: 10 }}>
          {categories.map((c) => <option key={c} value={c}>{c === "alle" ? "Alle Kategorien" : c}</option>)}
        </select>

        <button onClick={fetchQuestions} disabled={loading}
          style={{ padding: "10px 12px", background: "#0B1220", border: `1px solid ${HILITE}`, color: "#E5E7EB", borderRadius: 10, cursor: "pointer" }}>
          🔄 Neu laden
        </button>

        {showResult && (
          <>
            <button onClick={() => { setAnswers({}); setShowResult(false); setSavedAttempt(false); startedAtRef.current = Date.now(); }}
              style={{ padding: "10px 12px", background: "#1F2937", border: `1px solid ${HILITE}`, color: "#E5E7EB", borderRadius: 10, cursor: "pointer" }}>
              Auswahl zurücksetzen
            </button>
            <button onClick={fetchQuestions}
              style={{ padding: "10px 12px", background: ACCENT, color: "#111827", borderRadius: 10, fontWeight: 800, border: "none", cursor: "pointer" }}>
              ▶︎ Neue Runde
            </button>
          </>
        )}
        <div style={{ marginLeft: "auto", color: "#9CA3AF" }}>
          {loading ? "Lade Fragen…" : `${questions.length} Fragen geladen${showResult ? ` · Ergebnis: ${score}/${questions.length}` : ""}`}
        </div>
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
              onClick={async () => { if (!allAnswered) return; setShowResult(true); await saveAttempt(); }}
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
        </div>
      )}

      {authMsg && <p style={{ color: "#F87171", whiteSpace: "pre-wrap" }}>{authMsg}</p>}
    </div>
  );
}

/** ===== Admin-Dashboard & Meine Statistik als eigene Seiten ===== */
import MyStats from "./MyStats";
import AdminDashboard from "./AdminDashboard";

export default function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState("");
  const [first, setFirst] = useState(false);
  const [authMsg, setAuthMsg] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data?.user || null;
      setUser(u);
      setRole(u?.app_metadata?.role || "user");
    });
  }, []);

  async function handleLogin(e, name, pwd, setFirstFlag) {
    e.preventDefault();
    setAuthMsg("");
    const email = asEmail(name);

    if (first) {
      const { error } = await supabase.auth.signUp({ email, password: pwd, options: { data: { role: "user" } } });
      if (error) { setAuthMsg(error.message); return; }
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pwd });
    if (error) {
      if (/invalid login|user not found|email not confirmed/i.test(error.message)) { setFirst(true); setFirstFlag?.(true); }
      else setAuthMsg(error.message);
      return;
    }
    setUser(data.user);
    setRole(data.user?.app_metadata?.role || "user");
  }

  async function logout() {
    await supabase.auth.signOut();
    setUser(null); setRole("");
  }

  if (!user) return <LoginScreen onLogin={handleLogin} first={first} setFirst={setFirst} authMsg={authMsg} />;

  return (
    <div style={{ minHeight: "100vh", background: `radial-gradient(1200px 700px at 105% -10%, rgba(255,211,0,.12), transparent 55%), ${DEEP}`, padding: 20 }}>
      <Router>
        <div style={{ width: "min(1100px, 94vw)", margin: "0 auto", display: "grid", gap: 18 }}>
          <Header user={user} role={role} onLogout={logout} />
          <Routes>
            <Route path="/" element={<QuizPage user={user} role={role} />} />
            <Route path="/stats" element={<MyStats user={user} />} />
            <Route path="/admin" element={<AdminDashboard user={user} role={role} />} />
            <Route path="*" element={<div style={{ color: "white" }}>Seite nicht gefunden.</div>} />
          </Routes>
        </div>
      </Router>
    </div>
  );
}
