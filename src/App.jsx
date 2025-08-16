// src/App.jsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

/** ===== Branding ===== */
const MERKUR_LOGO_URL = ""; // echte Logo-URL einsetzen oder leer lassen
const ACCENT = "#FFD300";
const DEEP = "#0F172A";
const CARD = "#111827D9";
const HILITE = "#1F2937";

/** ===== Utils ===== */
const asEmail = (name) => (name.includes("@") ? name.trim() : `${name.trim().toUpperCase()}@quiz.local`);
const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const pct = (num, den) => (den ? Math.round((num / den) * 100) : 0);

/** ===== Level / Badges ===== */
function levelFor(avgPct) {
  if (avgPct >= 95) return { label: "Diamant", color: "#22d3ee" };
  if (avgPct >= 85) return { label: "Platin", color: "#a78bfa" };
  if (avgPct >= 70) return { label: "Gold", color: "#fbbf24" };
  if (avgPct >= 50) return { label: "Silber", color: "#9ca3af" };
  return { label: "Bronze", color: "#a16207" };
}

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
        {q.category && (
          <span
            style={{
              marginLeft: "auto",
              fontSize: 12,
              color: "#9CA3AF",
              background: "#0B1220",
              border: `1px solid ${HILITE}`,
              padding: "3px 8px",
              borderRadius: 999,
            }}
          >
            {q.category}
          </span>
        )}
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

/** ===== Admin-Form für eine Frage (unverändert) ===== */
function AdminEditor({ editing, onCancel, onSaved }) {
  const [text, setText] = useState(editing?.text || "");
  const [opts, setOpts] = useState(() => {
    const base = editing?.options || ["", "", "", ""];
    return [...base, "", "", ""].slice(0, 4);
  });
  const [correct, setCorrect] = useState(editing?.correct_idx ?? 0);
  const [active, setActive] = useState(editing?.active ?? true);
  const [category, setCategory] = useState(editing?.category || "Allgemein");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    setErr("");
    if (!text.trim()) return setErr("Fragetext fehlt");
    const clean = opts.map((o) => o.trim()).filter(Boolean);
    if (clean.length < 2) return setErr("Mindestens 2 Optionen erforderlich");
    if (correct < 0 || correct >= clean.length) return setErr("Korrekter Index außerhalb des Bereichs");

    setSaving(true);
    try {
      const payload = {
        id: editing?.id,
        text: text.trim(),
        qtype: "mc",
        options: clean,
        correct_idx: correct,
        active,
        category: category?.trim() || null,
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
      <div style={{ fontWeight: 700, color: "#E5E7EB" }}>{editing ? "Frage bearbeiten" : "Neue Frage anlegen"}</div>
      <input
        placeholder="Fragetext"
        value={text}
        onChange={(e) => setText(e.target.value)}
        style={{ padding: "10px 12px", background: "#0B1220", color: "#E5E7EB", borderRadius: 10, border: `1px solid ${HILITE}` }}
      />
      <input
        placeholder="Kategorie (optional, z. B. Geräte, Prozesse …)"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        style={{ padding: "10px 12px", background: "#0B1220", color: "#E5E7EB", borderRadius: 10, border: `1px solid ${HILITE}` }}
      />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} style={{ display: "flex", gap: 10 }}>
          <input
            placeholder={`Option ${i + 1}`}
            value={opts[i] || ""}
            onChange={(e) => setOpts((p) => {
              const c = p.slice();
              c[i] = e.target.value;
              return c;
            })}
            style={{ flex: 1, padding: "10px 12px", background: "#0B1220", color: "#E5E7EB", borderRadius: 10, border: `1px solid ${HILITE}` }}
          />
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
        <button
          onClick={save}
          disabled={saving}
          style={{ padding: "10px 12px", background: ACCENT, color: "#111827", fontWeight: 800, border: "none", borderRadius: 10, cursor: "pointer" }}
        >
          {editing ? "Speichern" : "Anlegen"}
        </button>
        <button
          onClick={onCancel}
          style={{ padding: "10px 12px", background: "#1F2937", border: `1px solid ${HILITE}`, color: "#E5E7EB", borderRadius: 10, cursor: "pointer" }}
        >
          Abbrechen
        </button>
      </div>
    </div>
  );
}

/** ===== App ===== */
export default function App() {
  /** Auth */
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

  /** Meine Statistik */
  const [myAttempts, setMyAttempts] = useState([]);
  const [mySummary, setMySummary] = useState({ count: 0, avg: 0, best: 0 });
  const [statsLoading, setStatsLoading] = useState(false);

  /** Admin */
  const [adminList, setAdminList] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [leaderboardAvg, setLeaderboardAvg] = useState([]); // {email,count,avg,best,lastAt,level}
  const [leaderboardBest, setLeaderboardBest] = useState([]); // {email,best}
  const [hardest, setHardest] = useState([]); // {qid,text,seen,acc}

  /** ===== Auth Init ===== */
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data?.user || null;
      setUser(u);
      setRole(u?.app_metadata?.role || "user");
      if (u) {
        fetchQuestions();
        loadMyStats();
        if (u?.app_metadata?.role === "admin") loadAdminData();
      }
    });
  }, []);

  async function handleLogin(e, name, pwd, first) {
    e.preventDefault();
    setAuthMsg("");
    const email = asEmail(name);

    if (first) {
      const { error } = await supabase.auth.signUp({ email, password: pwd, options: { data: { role: "user" } } });
      if (error) return setAuthMsg(error.message);
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pwd });
    if (error) {
      if (/invalid login|user not found|email not confirmed/i.test(error.message)) setAuthMsg("Nutzer nicht gefunden – bitte noch einmal auf „Konto anlegen & einloggen“ drücken.");
      else setAuthMsg(error.message);
      return;
    }
    setUser(data.user);
    setRole(data.user?.app_metadata?.role || "user");
    fetchQuestions();
    loadMyStats();
    if (data.user?.app_metadata?.role === "admin") loadAdminData();
  }

  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
    setRole("");
    setTab("quiz");
  }

  /** ===== Quiz Laden ===== */
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
        setQuestions(data.map((r) => ({
          id: r.id,
          text: r.text,
          options: r.options || [],
          correct_idx: r.correct_idx ?? null,
          category: r.category || null,
        })));
        setLoading(false);
        return;
      }
    } catch (e) {
      rpcErr = e;
    }
    try {
      const { data, error } = await supabase
        .from("questions")
        .select("id,text,options,correct_idx,active,qtype,category")
        .eq("qtype", "mc")
        .eq("active", true);
      if (error) throw error;
      const pool = (data || []).filter((r) => Array.isArray(r.options) && typeof r.correct_idx === "number");
      const picked = shuffle(pool).slice(0, 20);
      setQuestions(picked.map((r) => ({ id: r.id, text: r.text, options: r.options, correct_idx: r.correct_idx, category: r.category || null })));
    } catch (e2) {
      setAuthMsg("Fehler beim Laden der Fragen:\n" + (rpcErr?.message || "") + "\n" + e2.message);
    } finally {
      setLoading(false);
    }
  }

  /** ===== Attempt speichern ===== */
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
          ok: answers[q.id] === q.correct_idx,
          chosen: answers[q.id],
          correct: q.correct_idx,
          category: q.category || null,
        })),
      };
      const { error } = await supabase.from("attempts").insert(payload).select("id").single();
      if (error) throw error;
      setSavedAttempt(true);
      // Stats aktualisieren
      loadMyStats();
      if (role === "admin") loadAdminData();
    } catch (e) {
      console.warn("saveAttempt failed:", e.message);
    }
  }

  /** ===== Meine Statistik laden ===== */
  async function loadMyStats() {
    if (!user) return;
    setStatsLoading(true);
    try {
      const { data, error } = await supabase
        .from("attempts")
        .select("id,score,total,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(500);
      if (error) throw error;
      const attempts = data || [];
      setMyAttempts(attempts);
      const count = attempts.length;
      const avg = count ? Math.round((attempts.reduce((s, a) => s + a.score / a.total, 0) / count) * 100) : 0;
      const best = count ? Math.max(...attempts.map((a) => pct(a.score, a.total))) : 0;
      setMySummary({ count, avg, best });
    } catch (e) {
      setAuthMsg("Konnte Nutzer-Statistik nicht laden: " + e.message);
    } finally {
      setStatsLoading(false);
    }
  }

  /** ===== Admin-Daten laden ===== */
  async function loadAdminData() {
    if (role !== "admin") return;
    setAdminLoading(true);
    try {
      // Fragenliste
      const { data: qData } = await supabase
        .from("questions")
        .select("id,text,options,correct_idx,active,qtype,category")
        .order("created_at", { ascending: false })
        .limit(1000);
      setAdminList(qData || []);

      // Alle Attempts
      const { data: aData } = await supabase
        .from("attempts")
        .select("id,email,score,total,created_at,details")
        .order("created_at", { ascending: false })
        .limit(3000);

      const rows = aData || [];

      // Leaderboard Average & Best
      const byEmail = new Map();
      rows.forEach((a) => {
        const k = a.email || "unbekannt";
        const arr = byEmail.get(k) || [];
        arr.push(a);
        byEmail.set(k, arr);
      });

      const avgRows = Array.from(byEmail.entries()).map(([email, arr]) => {
        const count = arr.length;
        const avg = Math.round((arr.reduce((s, x) => s + x.score / x.total, 0) / count) * 100);
        const best = Math.max(...arr.map((x) => pct(x.score, x.total)));
        const lastAt = arr[0]?.created_at;
        const level = levelFor(avg);
        return { email, count, avg, best, lastAt, level };
      });
      avgRows.sort((a, b) => b.avg - a.avg || b.best - a.best);
      setLeaderboardAvg(avgRows.slice(0, 10));

      const bestRows = Array.from(byEmail.entries()).map(([email, arr]) => ({
        email,
        best: Math.max(...arr.map((x) => pct(x.score, x.total))),
      }));
      bestRows.sort((a, b) => b.best - a.best);
      setLeaderboardBest(bestRows.slice(0, 10));

      // Hardest Questions
      const qStats = new Map(); // qid -> {seen, ok}
      rows.forEach((a) => {
        (a.details || []).forEach((d) => {
          const key = String(d.qid);
          const stats = qStats.get(key) || { seen: 0, ok: 0 };
          stats.seen += 1;
          if (d.ok) stats.ok += 1;
          qStats.set(key, stats);
        });
      });
      const ids = Array.from(qStats.keys());
      let textMap = new Map();
      if (ids.length) {
        const { data: texts } = await supabase.from("questions").select("id,text").in("id", ids);
        textMap = new Map((texts || []).map((r) => [String(r.id), r.text]));
      }
      const hard = ids
        .map((id) => {
          const s = qStats.get(id);
          return { qid: id, text: textMap.get(id) || `Frage ${id}`, seen: s.seen, acc: pct(s.ok, s.seen) };
        })
        .filter((x) => x.seen >= 3)
        .sort((a, b) => a.acc - b.acc)
        .slice(0, 5);
      setHardest(hard);
    } catch (e) {
      setAuthMsg("Admin-Daten laden fehlgeschlagen: " + e.message);
    } finally {
      setAdminLoading(false);
    }
  }

  /** ===== Admin: Frage löschen ===== */
  async function removeQuestion(id) {
    if (!window.confirm("Diese Frage wirklich löschen?")) return;
    const { error } = await supabase.from("questions").delete().eq("id", id);
    if (error) return alert(error.message);
    await loadAdminData();
  }

  /** ===== Admin: Stats reset ===== */
  async function resetAllAttempts() {
    if (!window.confirm("Wirklich ALLE Versuche löschen?")) return;
    const { error } = await supabase.from("attempts").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) return alert(error.message);
    await loadAdminData();
  }
  async function resetUserAttempts(email) {
    if (!window.confirm(`Alle Versuche von ${email} löschen?`)) return;
    const { error } = await supabase.from("attempts").delete().eq("email", email);
    if (error) return alert(error.message);
    await loadAdminData();
  }
  async function resetMyAttempts() {
    if (!window.confirm("Eigene Statistik wirklich zurücksetzen?")) return;
    const { error } = await supabase.from("attempts").delete().eq("user_id", user.id);
    if (error) return alert(error.message);
    await loadMyStats();
    if (role === "admin") await loadAdminData();
  }

  /** ===== Header ===== */
  const header = (
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
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {user && (
          <span style={{ color: "#9CA3AF", fontSize: 14 }}>
            Angemeldet als <b style={{ color: "#E5E7EB" }}>{user.email}</b>
            {role === "admin" ? " · Admin" : ""}
          </span>
        )}
        {user ? (
          <button
            onClick={logout}
            style={{ padding: "8px 12px", background: "#0B1220", border: `1px solid ${HILITE}`, color: "#E5E7EB", borderRadius: 10, cursor: "pointer" }}
          >
            Abmelden
          </button>
        ) : null}
      </div>
    </div>
  );

  /** ===== Login-View ===== */
  const [name, setName] = useState("");
  const [pwd, setPwd] = useState("");
  const [first, setFirst] = useState(false);

  if (!user) {
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
          {header}
          <h2 style={{ marginTop: 20, marginBottom: 12, color: "#F3F4F6" }}>Login</h2>
          <form onSubmit={(e) => handleLogin(e, name, pwd, first)} style={{ display: "grid", gap: 12 }}>
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
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="submit"
                style={{ padding: "12px 14px", background: ACCENT, color: "#111827", fontWeight: 700, border: "none", borderRadius: 12, cursor: "pointer" }}
              >
                {first ? "Konto anlegen & einloggen" : "Einloggen"}
              </button>
              {!first && (
                <button
                  type="button"
                  onClick={() => setFirst(true)}
                  style={{ padding: "12px 14px", background: "#1F2937", border: `1px solid ${HILITE}`, color: "#E5E7EB", borderRadius: 12, cursor: "pointer" }}
                >
                  Konto anlegen
                </button>
              )}
            </div>
          </form>
          {authMsg && <p style={{ marginTop: 10, color: "#F87171", whiteSpace: "pre-wrap" }}>{authMsg}</p>}
        </div>
      </div>
    );
  }

  /** ===== Charts (My Stats & Admin) ===== */
  const myLine = myAttempts.map((a, i) => `${i * 16},${100 - pct(a.score, a.total)}`).join(" ");
  const lastPct = myAttempts.length ? pct(myAttempts[myAttempts.length - 1].score, myAttempts[myAttempts.length - 1].total) : 0;
  const ringLen = Math.PI * 2 * 58;

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
        {header}

        {/* Tabs (keine Router-Links -> kein 404) */}
        <div style={{ display: "flex", gap: 10 }}>
          {["quiz", "stats", ...(role === "admin" ? ["admin"] : [])].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                background: tab === t ? ACCENT : "#0B1220",
                color: tab === t ? "#111827" : "#E5E7EB",
                border: tab === t ? "none" : `1px solid ${HILITE}`,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              {t === "quiz" ? "Quiz" : t === "stats" ? "Meine Statistik" : "Admin"}
            </button>
          ))}
          <div style={{ marginLeft: "auto", color: "#9CA3AF" }}>
            {tab === "quiz" && (loading ? "Lade Fragen…" : `${questions.length} Fragen geladen${showResult ? ` · Ergebnis: ${score}/${questions.length}` : ""}`)}
            {tab === "stats" && (statsLoading ? "Lade Statistik…" : `${mySummary.count} Versuche · ⌀ ${mySummary.avg}%`)}
            {tab === "admin" && (adminLoading ? "Lade…" : `${adminList.length} Fragen · Leaderboard ${leaderboardAvg.length}`)}
          </div>
        </div>

        {/* Inhalte */}
        {tab === "quiz" ? (
          <>
            {/* Top-Leiste */}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={fetchQuestions}
                disabled={loading}
                style={{ padding: "10px 12px", background: "#0B1220", border: `1px solid ${HILITE}`, color: "#E5E7EB", borderRadius: 10, cursor: "pointer" }}
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
                    style={{ padding: "10px 12px", background: "#1F2937", border: `1px solid ${HILITE}`, color: "#E5E7EB", borderRadius: 10, cursor: "pointer" }}
                  >
                    Auswahl zurücksetzen
                  </button>
                  <button
                    onClick={fetchQuestions}
                    style={{ padding: "10px 12px", background: ACCENT, color: "#111827", borderRadius: 10, fontWeight: 800, border: "none", cursor: "pointer" }}
                  >
                    ▶︎ Neue Runde
                  </button>
                </>
              )}
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
                {/* Auswerten unten */}
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
          </>
        ) : tab === "stats" ? (
          <div style={{ display: "grid", gap: 14 }}>
            {/* Kopf mit Kennzahlen + Level + Reset */}
            <div style={{ background: CARD, border: `1px solid ${HILITE}`, borderRadius: 12, padding: 14 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <Badge label="Versuche" value={mySummary.count} />
                  <Badge label="Durchschnitt" value={`${mySummary.avg}%`} />
                  <Badge label="Bestleistung" value={`${mySummary.best}%`} />
                  {/* Level Badge */}
                  <span
                    style={{
                      background: "#0B1220",
                      border: `1px solid ${HILITE}`,
                      borderRadius: 10,
                      padding: "8px 10px",
                      color: levelFor(mySummary.avg).color,
                      fontWeight: 800,
                    }}
                  >
                    Level: {levelFor(mySummary.avg).label}
                  </span>
                </div>
                <button
                  onClick={resetMyAttempts}
                  style={{ padding: "8px 12px", background: "#1F2937", border: `1px solid ${HILITE}`, color: "#E5E7EB", borderRadius: 10, cursor: "pointer" }}
                >
                  Statistik zurücksetzen
                </button>
              </div>

              {/* Diagramme */}
              <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 16, marginTop: 14 }}>
                {/* Donut (letzter Lauf) */}
                <svg width="220" height="160" viewBox="0 0 160 160">
                  <circle cx="80" cy="80" r="58" fill="none" stroke="#1F2937" strokeWidth="18" />
                  <circle
                    cx="80"
                    cy="80"
                    r="58"
                    fill="none"
                    stroke={ACCENT}
                    strokeWidth="18"
                    strokeDasharray={`${(ringLen * lastPct) / 100} ${ringLen}`}
                    transform="rotate(-90 80 80)"
                  />
                  <text x="80" y="80" textAnchor="middle" dominantBaseline="middle" fill="#E5E7EB" fontWeight="800">
                    {lastPct}%
                  </text>
                  <text x="80" y="120" textAnchor="middle" fill="#9CA3AF" fontSize="12">
                    Letzter Run
                  </text>
                </svg>

                {/* Verlauf */}
                <div style={{ background: "#0B1220", border: `1px solid ${HILITE}`, borderRadius: 10, padding: 8 }}>
                  <div style={{ color: "#E5E7EB", fontWeight: 700, margin: "4px 0 6px" }}>Verlauf</div>
                  <svg width="100%" height="120" viewBox={`0 0 ${Math.max(1, myAttempts.length - 1) * 16 + 2} 100`} preserveAspectRatio="none">
                    <polyline fill="none" stroke={ACCENT} strokeWidth="2.5" points={myLine} />
                  </svg>
                </div>
              </div>

              {/* Tabelle */}
              <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
                {[...myAttempts].reverse().map((a) => (
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
                {myAttempts.length === 0 && <div style={{ color: "#9CA3AF" }}>{statsLoading ? "Lade…" : "Noch keine Versuche."}</div>}
              </div>
            </div>
          </div>
        ) : (
          // ===== Admin =====
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                onClick={loadAdminData}
                style={{ padding: "10px 12px", background: "#0B1220", border: `1px solid ${HILITE}`, color: "#E5E7EB", borderRadius: 10, cursor: "pointer" }}
              >
                🔄 Neu laden
              </button>
              <button
                onClick={resetAllAttempts}
                style={{ padding: "10px 12px", background: "#DC2626", color: "white", border: "none", borderRadius: 10, cursor: "pointer" }}
              >
                Reset: Alle Statistiken
              </button>
            </div>

            {/* Leaderboard Durchschnitt */}
            <div style={{ background: CARD, border: `1px solid ${HILITE}`, borderRadius: 12, padding: 14 }}>
              <div style={{ fontWeight: 800, marginBottom: 8 }}>Leaderboard – Durchschnitt</div>
              <div style={{ display: "grid", gap: 6 }}>
                {leaderboardAvg.map((u, idx) => (
                  <div
                    key={u.email}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "40px 1.2fr .4fr .7fr .8fr 120px",
                      gap: 10,
                      background: "#0B1220",
                      border: `1px solid ${HILITE}`,
                      borderRadius: 10,
                      padding: "8px 10px",
                      alignItems: "center",
                    }}
                  >
                    <RankBadge n={idx + 1} />
                    <div style={{ color: "#E5E7EB" }}>{u.email}</div>
                    <div style={{ color: "#CBD5E1" }}>{u.count}×</div>
                    <div style={{ color: "#CBD5E1" }}>⌀ {u.avg}% · Best {u.best}%</div>
                    <div style={{ color: u.level.color, fontWeight: 800 }}>Level {u.level.label}</div>
                    <button
                      onClick={() => resetUserAttempts(u.email)}
                      style={{ padding: "6px 10px", background: "#1F2937", border: `1px solid ${HILITE}`, color: "#E5E7EB", borderRadius: 8, cursor: "pointer" }}
                    >
                      Reset Nutzer
                    </button>
                  </div>
                ))}
                {leaderboardAvg.length === 0 && <div style={{ color: "#9CA3AF" }}>{adminLoading ? "Lade…" : "Keine Daten."}</div>}
              </div>
            </div>

            {/* Highscore (Best-Run) */}
            <div style={{ background: CARD, border: `1px solid ${HILITE}`, borderRadius: 12, padding: 14 }}>
              <div style={{ fontWeight: 800, marginBottom: 8 }}>Highscore – Bester einzelner Run</div>
              <div style={{ display: "grid", gap: 6 }}>
                {leaderboardBest.map((u, idx) => (
                  <div
                    key={u.email}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "40px 1.6fr .6fr",
                      gap: 10,
                      background: "#0B1220",
                      border: `1px solid ${HILITE}`,
                      borderRadius: 10,
                      padding: "8px 10px",
                      alignItems: "center",
                    }}
                  >
                    <RankBadge n={idx + 1} />
                    <div style={{ color: "#E5E7EB" }}>{u.email}</div>
                    <div style={{ color: "#CBD5E1", fontWeight: 800 }}>{u.best}%</div>
                  </div>
                ))}
                {leaderboardBest.length === 0 && <div style={{ color: "#9CA3AF" }}>{adminLoading ? "Lade…" : "Keine Daten."}</div>}
              </div>
            </div>

            {/* Schwierigste Fragen */}
            <div style={{ background: CARD, border: `1px solid ${HILITE}`, borderRadius: 12, padding: 14 }}>
              <div style={{ fontWeight: 800, marginBottom: 8 }}>Schwierigste Fragen (Top-5)</div>
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

            {/* Fragenverwaltung */}
            <AdminEditor
              editing={editing}
              onCancel={() => setEditing(null)}
              onSaved={async () => {
                setEditing(null);
                await loadAdminData();
              }}
            />
            <div style={{ background: CARD, border: `1px solid ${HILITE}`, borderRadius: 12, padding: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Fragen (neueste zuerst)</div>
              <div style={{ display: "grid", gap: 8 }}>
                {adminList.map((q) => (
                  <div key={q.id} style={{ border: `1px solid ${HILITE}`, borderRadius: 10, padding: 10, background: "#0B1220" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ color: "#E5E7EB", fontWeight: 600 }}>{q.text}</div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        {q.category && <span style={{ color: "#9CA3AF", fontSize: 12 }}>{q.category}</span>}
                        <span style={{ color: "#9CA3AF" }}>{q.active ? "aktiv" : "inaktiv"}</span>
                        <button
                          onClick={() => setEditing(q)}
                          style={{ padding: "6px 10px", background: "#1F2937", border: `1px solid ${HILITE}`, color: "#E5E7EB", borderRadius: 8, cursor: "pointer" }}
                        >
                          Bearbeiten
                        </button>
                        <button
                          onClick={() => removeQuestion(q.id)}
                          style={{ padding: "6px 10px", background: "#DC2626", color: "white", border: "none", borderRadius: 8, cursor: "pointer" }}
                        >
                          Löschen
                        </button>
                      </div>
                    </div>
                    <div style={{ marginTop: 6, color: "#CBD5E1", fontSize: 14 }}>
                      {q.options?.map((o, i) => (
                        <span
                          key={i}
                          style={{
                            padding: "2px 8px",
                            borderRadius: 999,
                            marginRight: 6,
                            border: `1px solid ${i === q.correct_idx ? "#16A34A" : HILITE}`,
                            color: i === q.correct_idx ? "#16A34A" : "#CBD5E1",
                          }}
                        >
                          {o}
                          {i === q.correct_idx ? " ✔" : ""}
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

/** ===== Kleine UI-Helper ===== */
function Badge({ label, value }) {
  return (
    <div style={{ background: "#0B1220", border: `1px solid ${HILITE}`, borderRadius: 10, padding: "8px 10px", color: "#E5E7EB" }}>
      <div style={{ fontSize: 12, color: "#9CA3AF" }}>{label}</div>
      <div style={{ fontWeight: 800 }}>{value}</div>
    </div>
  );
}
function RankBadge({ n }) {
  const c = n === 1 ? "#fbbf24" : n === 2 ? "#9ca3af" : n === 3 ? "#a16207" : "#374151";
  return (
    <div
      style={{
        width: 34,
        height: 34,
        borderRadius: "50%",
        display: "grid",
        placeItems: "center",
        fontWeight: 800,
        color: "#111827",
        background: c,
      }}
      title={`Rang ${n}`}
    >
      {n}
    </div>
  );
}
