// src/App.jsx
import React, { useEffect, useMemo, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from "react-router-dom";
import { supabase } from "./supabaseClient";

/** ===== Branding ===== */
const MERKUR_LOGO_URL = ""; // echte Logo-URL einsetzen oder leer lassen
const ACCENT = "#FFD300";
const DEEP = "#0F172A";
const CARD = "#111827D9";
const HILITE = "#1F2937";

/** ===== Utils ===== */
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
const pct = (num, den) => (den ? Math.round((num / den) * 100) : 0);

/** ===== Logo ===== */
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

/** ===== Layout ===== */
function Shell({ user, role, onLogout, children }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: `radial-gradient(1200px 700px at 105% -10%, rgba(255,211,0,.12), transparent 55%), ${DEEP}`,
        padding: 20,
        color: "#E5E7EB",
      }}
    >
      <div style={{ width: "min(1100px, 94vw)", margin: "0 auto", display: "grid", gap: 18 }}>
        {/* Header */}
        <div
          style={{
            background: CARD,
            padding: 16,
            borderRadius: 16,
            border: `1px solid ${HILITE}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Sun />
            <div style={{ fontWeight: 800, fontSize: 20, color: "#E5E7EB" }}>MaQuiz</div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <NavLink to="/">Quiz</NavLink>
            <NavLink to="/meine-statistik">Meine Statistik</NavLink>
            <NavLink to="/admin" disabled={role !== "admin"}>
              Admin
            </NavLink>
            {user && (
              <span style={{ color: "#9CA3AF", fontSize: 14 }}>
                Angemeldet als <b style={{ color: "#E5E7EB" }}>{user.email}</b>
                {role === "admin" ? " · Admin" : ""}
              </span>
            )}
            {user ? (
              <button
                onClick={onLogout}
                style={{
                  padding: "8px 12px",
                  background: "#0B1220",
                  border: `1px solid ${HILITE}`,
                  color: "#E5E7EB",
                  borderRadius: 10,
                  cursor: "pointer",
                }}
              >
                Abmelden
              </button>
            ) : null}
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}

function NavLink({ to, children, disabled }) {
  const style = {
    padding: "8px 12px",
    borderRadius: 10,
    background: "#0B1220",
    color: disabled ? "#6B7280" : "#E5E7EB",
    border: `1px solid ${HILITE}`,
    cursor: disabled ? "not-allowed" : "pointer",
    textDecoration: "none",
    fontWeight: 700,
  };
  return disabled ? (
    <span style={style}>{children}</span>
  ) : (
    <Link to={to} style={style}>
      {children}
    </Link>
  );
}

/** ===== Login Screen (vor App-Shell) ===== */
function Login({ onLogin }) {
  const [name, setName] = useState("");
  const [pwd, setPwd] = useState("");
  const [first, setFirst] = useState(false);
  const [msg, setMsg] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg("");
    const email = asEmail(name);

    if (first) {
      const { error } = await supabase.auth.signUp({ email, password: pwd, options: { data: { role: "user" } } });
      if (error) {
        setMsg(error.message);
        return;
      }
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pwd });
    if (error) {
      if (/invalid login|user not found|email not confirmed/i.test(error.message)) setFirst(true);
      else setMsg(error.message);
      return;
    }
    onLogin(data.user);
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: `radial-gradient(1000px 600px at -10% -10%, rgba(255,211,0,.15), transparent 50%), ${DEEP}`,
        display: "grid",
        placeItems: "center",
        color: "#E5E7EB",
        padding: 20,
      }}
    >
      <div
        style={{
          width: "min(680px, 94vw)",
          background: CARD,
          padding: 26,
          borderRadius: 18,
          boxShadow: "0 6px 26px rgba(0,0,0,.45)",
          border: `1px solid ${HILITE}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Sun />
          <div style={{ fontWeight: 800, fontSize: 20, color: "#E5E7EB" }}>MaQuiz</div>
        </div>
        <h2 style={{ marginTop: 20, marginBottom: 12, color: "#F3F4F6" }}>Login</h2>
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
          <input
            placeholder="Benutzername (z. B. ADMIN) oder E-Mail"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ padding: "12px 14px", background: "#0B1220", color: "#E5E7EB", borderRadius: 12, border: `1px solid ${HILITE}` }}
            required
          />
          <input
            type="password"
            placeholder={first ? "Neues Passwort" : "Passwort"}
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            style={{ padding: "12px 14px", background: "#0B1220", color: "#E5E7EB", borderRadius: 12, border: `1px solid ${HILITE}` }}
            required
          />
          <button
            type="submit"
            style={{ padding: "12px 14px", background: ACCENT, color: "#111827", fontWeight: 700, border: "none", borderRadius: 12, cursor: "pointer" }}
          >
            {first ? "Konto anlegen & einloggen" : "Einloggen"}
          </button>
        </form>
        {msg && <p style={{ marginTop: 10, color: "#F87171", whiteSpace: "pre-wrap" }}>{msg}</p>}
      </div>
    </div>
  );
}

/** ===== Quiz-Karte ===== */
function QuestionCard({ index, q, selected, onSelect, showResult }) {
  const isCorrect = showResult && selected === q.correct_idx;
  const isWrong = showResult && selected != null && selected !== q.correct_idx;
  return (
    <div
      style={{
        background: CARD,
        borderRadius: 14,
        padding: 18,
        border: `2px solid ${isCorrect ? "#16A34A" : isWrong ? "#DC2626" : "transparent"}`,
        boxShadow: "0 2px 10px rgba(0,0,0,.35)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#D1D5DB" }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: HILITE,
            border: `2px solid ${ACCENT}`,
            display: "grid",
            placeItems: "center",
            fontSize: 12,
          }}
        >
          {index + 1}
        </div>
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
                textAlign: "left",
                borderRadius: 12,
                padding: "12px 14px",
                background: chosen ? "#1F2937" : "#0B1220",
                color: "#E5E7EB",
                border: `2px solid ${correct ? "#16A34A" : wrong ? "#DC2626" : chosen ? ACCENT : "#1F2937"}`,
                cursor: showResult ? "default" : "pointer",
              }}
            >
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

/** ===== Quiz-Seite ===== */
function QuizPage({ user }) {
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [showResult, setShowResult] = useState(false);
  const [savedAttempt, setSavedAttempt] = useState(false);

  const allAnswered = questions.length > 0 && questions.every((q) => answers[q.id] != null);
  const score = useMemo(() => questions.filter((q) => answers[q.id] === q.correct_idx).length, [answers, questions]);

  async function fetchQuestions() {
    setLoading(true);
    setAnswers({});
    setShowResult(false);
    setSavedAttempt(false);
    let rpcErr = null;
    try {
      const { data, error } = await supabase.rpc("get_random_questions_mc", { limit_count: 20 });
      if (error) rpcErr = error;
      if (Array.isArray(data) && data.length) {
        setQuestions(
          data.map((r) => ({ id: r.id, text: r.text, options: r.options || [], correct_idx: r.correct_idx ?? null }))
        );
        setLoading(false);
        return;
      }
    } catch (e) {
      rpcErr = e;
    }
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
    } catch (e2) {
      alert("Fehler beim Laden der Fragen:\n" + (rpcErr?.message || "") + "\n" + e2.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchQuestions();
  }, []);

  async function saveAttempt() {
    if (!user || savedAttempt) return;
    try {
      const payload = {
        user_id: user.id,
        email: user.email,
        score,
        total: questions.length,
        details: questions.map((q) => ({
          qid: String(q.id),
          chosen: answers[q.id],
          correct: q.correct_idx,
          ok: answers[q.id] === q.correct_idx,
        })),
      };
      const { error } = await supabase.from("attempts").insert(payload).select("id").single();
      if (error) throw error;
      setSavedAttempt(true);
    } catch (e) {
      console.warn("saveAttempt failed:", e.message);
    }
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* Top Controls */}
      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={fetchQuestions}
          disabled={loading}
          style={{
            padding: "10px 12px",
            background: "#0B1220",
            border: `1px solid ${HILITE}`,
            color: "#E5E7EB",
            borderRadius: 10,
            cursor: "pointer",
          }}
        >
          🔄 Neu laden
        </button>
        {showResult && (
          <>
            <button
              onClick={() => {
                setAnswers({});
                setShowResult(false);
                setSavedAttempt(false);
              }}
              style={{
                padding: "10px 12px",
                background: "#1F2937",
                border: `1px solid ${HILITE}`,
                color: "#E5E7EB",
                borderRadius: 10,
                cursor: "pointer",
              }}
            >
              Auswahl zurücksetzen
            </button>
            <button
              onClick={fetchQuestions}
              style={{
                padding: "10px 12px",
                background: ACCENT,
                color: "#111827",
                borderRadius: 10,
                fontWeight: 800,
                border: "none",
                cursor: "pointer",
              }}
            >
              ▶︎ Neue Runde
            </button>
          </>
        )}
        <div style={{ marginLeft: "auto", color: "#9CA3AF" }}>
          {loading ? "Lade Fragen…" : `${questions.length} Fragen geladen${showResult ? ` · Ergebnis: ${score}/${questions.length}` : ""}`}
        </div>
      </div>

      {/* Fragenliste */}
      {!showResult ? (
        <>
          <div style={{ display: "grid", gap: 14 }}>
            {questions.map((q, i) => (
              <QuestionCard
                key={q.id}
                index={i}
                q={q}
                selected={answers[q.id]}
                onSelect={(idx) => setAnswers((p) => ({ ...p, [q.id]: idx }))}
                showResult={false}
              />
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
                padding: "10px 12px",
                background: allAnswered ? ACCENT : "#6B7280",
                color: "#111827",
                borderRadius: 10,
                fontWeight: 800,
                border: "none",
                cursor: allAnswered ? "pointer" : "not-allowed",
              }}
            >
              Auswerten
            </button>
          </div>
        </>
      ) : (
        <div style={{ background: CARD, border: `1px solid ${HILITE}`, borderRadius: 16, padding: 18 }}>
          <h2 style={{ margin: "4px 0 12px 0", color: "#F3F4F6" }}>Auswertung</h2>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
            <Badge label="Punktzahl" value={`${score} / ${questions.length}`} />
            <Badge label="Quote" value={`${pct(score, questions.length)}%`} />
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            {questions.map((q, i) => (
              <QuestionCard key={q.id} index={i} q={q} selected={answers[q.id]} onSelect={() => {}} showResult />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** ===== Meine Statistik ===== */
function MyStatsPage({ user }) {
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("attempts")
        .select("id,score,total,created_at,details")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(500);
      if (error) throw error;
      setAttempts(data || []);
    } catch (e) {
      alert("Statistik laden fehlgeschlagen: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const count = attempts.length;
  const avg = count ? Math.round(attempts.reduce((s, a) => s + a.score / a.total, 0) / count * 100) : 0;
  const best = count ? Math.max(...attempts.map((a) => pct(a.score, a.total))) : 0;

  async function resetMine() {
    if (!window.confirm("Eigene Statistik wirklich zurücksetzen?")) return;
    const { error } = await supabase.from("attempts").delete().eq("user_id", user.id);
    if (error) { alert(error.message); return; }
    load();
  }

  // kleine Diagramme
  const points = attempts.map((a, i) => `${i * 16},${100 - pct(a.score, a.total)}`).join(" ");

  const last = attempts[attempts.length - 1];
  const lastPct = last ? pct(last.score, last.total) : 0;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ background: CARD, border: `1px solid ${HILITE}`, borderRadius: 12, padding: 14 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Badge label="Versuche" value={count} />
            <Badge label="Durchschnitt" value={`${avg}%`} />
            <Badge label="Bestleistung" value={`${best}%`} />
          </div>
          <button
            onClick={resetMine}
            style={{ padding: "8px 12px", background: "#1F2937", border: `1px solid ${HILITE}`, color: "#E5E7EB", borderRadius: 10, cursor: "pointer" }}
          >
            Statistik zurücksetzen
          </button>
        </div>

        {/* Donut + Line */}
        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 16, marginTop: 14 }}>
          <svg width="220" height="160" viewBox="0 0 220 160">
            <circle cx="80" cy="80" r="58" fill="none" stroke="#1F2937" strokeWidth="18" />
            <circle
              cx="80"
              cy="80"
              r="58"
              fill="none"
              stroke={ACCENT}
              strokeWidth="18"
              strokeDasharray={`${(Math.PI * 2 * 58 * lastPct) / 100} ${Math.PI * 2 * 58}`}
              transform="rotate(-90 80 80)"
            />
            <text x="80" y="80" textAnchor="middle" dominantBaseline="middle" fill="#E5E7EB" fontWeight="800">
              {lastPct}%
            </text>
            <text x="80" y="120" textAnchor="middle" fill="#9CA3AF" fontSize="12">
              Letzter Run
            </text>
          </svg>

          <div style={{ background: "#0B1220", border: `1px solid ${HILITE}`, borderRadius: 10, padding: 8 }}>
            <div style={{ color: "#E5E7EB", fontWeight: 700, margin: "4px 0 6px" }}>Verlauf</div>
            <svg width="100%" height="120" viewBox={`0 0 ${Math.max(1, attempts.length - 1) * 16 + 2} 100`} preserveAspectRatio="none">
              <polyline fill="none" stroke={ACCENT} strokeWidth="2.5" points={points} />
            </svg>
          </div>
        </div>

        {/* Tabelle */}
        <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
          {[...attempts].reverse().map((a) => (
            <div
              key={a.id}
              style={{ display: "flex", justifyContent: "space-between", background: "#0B1220", border: `1px solid ${HILITE}`, borderRadius: 8, padding: "8px 10px" }}
            >
              <span style={{ color: "#E5E7EB" }}>{new Date(a.created_at).toLocaleString()}</span>
              <span style={{ color: "#CBD5E1" }}>
                {a.score} / {a.total} ({pct(a.score, a.total)}%)
              </span>
            </div>
          ))}
          {attempts.length === 0 && <div style={{ color: "#9CA3AF" }}>{loading ? "Lade…" : "Noch keine Versuche."}</div>}
        </div>
      </div>
    </div>
  );
}

/** ===== Admin Dashboard ===== */
function AdminDashboard({ user, role }) {
  const [rows, setRows] = useState([]); // alle attempts (limitiert)
  const [byUser, setByUser] = useState([]); // {email,count,avg,best,lastAt}
  const [hardest, setHardest] = useState([]); // {qid,text,seen,acc}
  const [loading, setLoading] = useState(false);

  async function load() {
    if (role !== "admin") return;
    setLoading(true);
    try {
      // Lade Versuche
      const { data, error } = await supabase
        .from("attempts")
        .select("id, email, score, total, created_at, details")
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      setRows(data || []);

      // Aggregation: Nutzer
      const m = new Map();
      (data || []).forEach((a) => {
        const key = a.email || "unbekannt";
        const arr = m.get(key) || [];
        arr.push(a);
        m.set(key, arr);
      });
      const users = Array.from(m.entries()).map(([email, arr]) => {
        const count = arr.length;
        const avg = Math.round((arr.reduce((s, x) => s + x.score / x.total, 0) / count) * 100);
        const best = Math.max(...arr.map((x) => pct(x.score, x.total)));
        const lastAt = arr[0]?.created_at;
        return { email, count, avg, best, lastAt };
      });
      users.sort((a, b) => b.avg - a.avg || b.best - a.best);
      setByUser(users);

      // Hardest Questions (aus details)
      const qstats = new Map(); // qid -> {seen, ok, text?}
      (data || []).forEach((a) => {
        (a.details || []).forEach((d) => {
          const key = String(d.qid);
          const s = qstats.get(key) || { seen: 0, ok: 0 };
          s.seen += 1;
          if (d.ok) s.ok += 1;
          qstats.set(key, s);
        });
      });
      // hole Fragetexte (nur die, die vorkommen)
      const ids = Array.from(qstats.keys());
      if (ids.length) {
        const { data: qdata } = await supabase.from("questions").select("id,text").in("id", ids);
        const textMap = new Map((qdata || []).map((r) => [String(r.id), r.text]));
        const list = ids
          .map((id) => {
            const s = qstats.get(id);
            const acc = pct(s.ok, s.seen);
            return { qid: id, text: textMap.get(id) || `Frage ${id}`, seen: s.seen, acc };
          })
          .filter((x) => x.seen >= 3) // nur genügend Daten
          .sort((a, b) => a.acc - b.acc)
          .slice(0, 5);
        setHardest(list);
      } else {
        setHardest([]);
      }
    } catch (e) {
      alert("Admin-Daten laden fehlgeschlagen: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function resetAll() {
    if (!window.confirm("Wirklich ALLE Versuche löschen?")) return;
    const { error } = await supabase.from("attempts").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) {
      alert(error.message);
      return;
    }
    load();
  }
  async function resetUser(email) {
    if (!window.confirm(`Alle Versuche von ${email} löschen?`)) return;
    const { error } = await supabase.from("attempts").delete().eq("email", email);
    if (error) {
      alert(error.message);
      return;
    }
    load();
  }

  // Gesamtverlauf (Durchschnitt pro Versuch in Zeit)
  const points = rows
    .slice()
    .reverse()
    .map((a, i) => `${i * 12},${100 - pct(a.score, a.total)}`)
    .join(" ");

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={load}
          style={{ padding: "10px 12px", background: "#0B1220", border: `1px solid ${HILITE}`, color: "#E5E7EB", borderRadius: 10, cursor: "pointer" }}
        >
          🔄 Neu laden
        </button>
        <button
          onClick={resetAll}
          style={{ padding: "10px 12px", background: "#DC2626", color: "white", border: "none", borderRadius: 10, cursor: "pointer" }}
        >
          Reset: Alle Statistiken
        </button>
        <div style={{ marginLeft: "auto", color: "#9CA3AF" }}>{loading ? "Lade…" : `${rows.length} Versuche`}</div>
      </div>

      {/* Verlauf gesamt */}
      <div style={{ background: CARD, border: `1px solid ${HILITE}`, borderRadius: 12, padding: 14 }}>
        <div style={{ color: "#E5E7EB", fontWeight: 800, marginBottom: 8 }}>Gesamtverlauf</div>
        <svg width="100%" height="140" viewBox={`0 0 ${Math.max(1, rows.length - 1) * 12 + 2} 100`} preserveAspectRatio="none">
          <polyline fill="none" stroke={ACCENT} strokeWidth="2.5" points={points} />
        </svg>
      </div>

      {/* Hardest Questions */}
      <div style={{ background: CARD, border: `1px solid ${HILITE}`, borderRadius: 12, padding: 14 }}>
        <div style={{ color: "#E5E7EB", fontWeight: 800, marginBottom: 8 }}>Schwierigste Fragen (Top-5)</div>
        <div style={{ display: "grid", gap: 8 }}>
          {hardest.map((h) => (
            <div key={h.qid} style={{ background: "#0B1220", border: `1px solid ${HILITE}`, borderRadius: 10, padding: 10 }}>
              <div style={{ color: "#E5E7EB", marginBottom: 6 }}>{h.text}</div>
              <div style={{ height: 10, background: "#111827", borderRadius: 999, overflow: "hidden" }}>
                <div style={{ width: `${h.acc}%`, height: "100%", background: h.acc >= 60 ? "#16A34A" : "#DC2626" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", color: "#9CA3AF", marginTop: 4 }}>
                <span>{h.seen} Antworten</span>
                <span>{h.acc}% korrekt</span>
              </div>
            </div>
          ))}
          {hardest.length === 0 && <div style={{ color: "#9CA3AF" }}>Noch keine ausreichenden Daten.</div>}
        </div>
      </div>

      {/* Team-Ranking */}
      <div style={{ background: CARD, border: `1px solid ${HILITE}`, borderRadius: 12, padding: 14 }}>
        <div style={{ color: "#E5E7EB", fontWeight: 800, marginBottom: 8 }}>Team-Ranking</div>
        <div style={{ display: "grid", gap: 6 }}>
          {byUser.map((u) => (
            <div
              key={u.email}
              style={{
                display: "grid",
                gridTemplateColumns: "1.4fr .5fr .7fr .8fr 120px",
                gap: 10,
                background: "#0B1220",
                border: `1px solid ${HILITE}`,
                borderRadius: 10,
                padding: "8px 10px",
                alignItems: "center",
              }}
            >
              <div style={{ color: "#E5E7EB" }}>{u.email}</div>
              <div style={{ color: "#CBD5E1" }}>{u.count}×</div>
              <div style={{ color: "#CBD5E1" }}>
                ⌀ {u.avg}% · Best {u.best}%
              </div>
              <div style={{ color: "#9CA3AF" }}>{u.lastAt ? new Date(u.lastAt).toLocaleString() : "–"}</div>
              <button
                onClick={() => resetUser(u.email)}
                style={{ padding: "6px 10px", background: "#1F2937", border: `1px solid ${HILITE}`, color: "#E5E7EB", borderRadius: 8, cursor: "pointer" }}
              >
                Reset Nutzer
              </button>
            </div>
          ))}
          {byUser.length === 0 && <div style={{ color: "#9CA3AF" }}>{loading ? "Lade…" : "Keine Daten."}</div>}
        </div>
      </div>
    </div>
  );
}

/** ===== Reusable Badge ===== */
function Badge({ label, value }) {
  return (
    <div style={{ background: "#0B1220", border: `1px solid ${HILITE}`, borderRadius: 10, padding: "8px 10px", color: "#E5E7EB" }}>
      <div style={{ fontSize: 12, color: "#9CA3AF" }}>{label}</div>
      <div style={{ fontWeight: 800 }}>{value}</div>
    </div>
  );
}

/** ===== App (Router + Auth) ===== */
export default function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data?.user || null;
      setUser(u);
      setRole(u?.app_metadata?.role || "user");
    });
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
    setRole("");
  }

  if (!user) {
    return <Login onLogin={(u) => { setUser(u); setRole(u?.app_metadata?.role || "user"); }} />;
  }

  return (
    <Router>
      <Shell user={user} role={role} onLogout={logout}>
        <Routes>
          <Route path="/" element={<QuizPage user={user} />} />
          <Route path="/meine-statistik" element={<MyStatsPage user={user} />} />
          <Route path="/admin" element={role === "admin" ? <AdminDashboard user={user} role={role} /> : <Denied />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Shell>
    </Router>
  );
}

function Denied() {
  const nav = useNavigate();
  return (
    <div style={{ background: CARD, border: `1px solid ${HILITE}`, borderRadius: 12, padding: 16 }}>
      <div style={{ color: "#F87171", fontWeight: 800, marginBottom: 8 }}>Kein Zugriff</div>
      <button
        onClick={() => nav("/")}
        style={{ padding: "10px 12px", background: ACCENT, color: "#111827", borderRadius: 10, fontWeight: 800, border: "none", cursor: "pointer" }}
      >
        Zurück zum Quiz
      </button>
    </div>
  );
}
function NotFound() {
  const nav = useNavigate();
  return (
    <div style={{ background: CARD, border: `1px solid ${HILITE}`, borderRadius: 12, padding: 16 }}>
      <div style={{ color: "#E5E7EB", fontWeight: 800, marginBottom: 8 }}>Seite nicht gefunden</div>
      <button
        onClick={() => nav("/")}
        style={{ padding: "10px 12px", background: ACCENT, color: "#111827", borderRadius: 10, fontWeight: 800, border: "none", cursor: "pointer" }}
      >
        Zum Quiz
      </button>
    </div>
  );
}
