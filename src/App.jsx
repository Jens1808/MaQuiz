import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

/** ===== Branding ===== */
const MERKUR_LOGO_URL = ""; // echte Logo-URL einsetzen oder leer lassen
const ACCENT = "#FFD300";
const DEEP = "#0F172A";
const CARD = "#111827D9";
const HILITE = "#1F2937";

const asEmail = (name) => (name.includes("@") ? name.trim() : `${name.trim().toUpperCase()}@quiz.local`);
const range = (n) => Array.from({ length: n }, (_, i) => i);
const shuffle = (arr) => { const a = arr.slice(); for (let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a; };

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
      const payload = { id: editing?.id, text: text.trim(), qtype: "mc", options: clean, correct_idx: correct, active };
      const { error } = await supabase.from("questions").upsert(payload).select("id").single();
      if (error) throw error;
      onSaved?.();
    } catch (e) { setErr(e.message); } finally { setSaving(false); }
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

  /** Tabs */
  const [tab, setTab] = useState("quiz"); // 'quiz' | 'admin' | 'stat'

  /** Quiz */
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [showResult, setShowResult] = useState(false);
  const [startedAt, setStartedAt] = useState(null);
  const allAnswered = questions.length > 0 && questions.every((q) => answers[q.id] != null);
  const score = useMemo(() => questions.filter((q) => answers[q.id] === q.correct_idx).length, [answers, questions]);

  /** Statistik */
  const [myAttempts, setMyAttempts] = useState([]);
  const [teamAttempts, setTeamAttempts] = useState([]);
  const [statsLoading, setStatsLoading] = useState(false);

  /** Admin */
  const [adminList, setAdminList] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data?.user || null;
      setUser(u);
      setRole(u?.app_metadata?.role || "user");
      if (u) fetchQuestions();
    });
  }, []);

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
    setUser(null); setRole(""); setQuestions([]); setAnswers({}); setShowResult(false); setTab("quiz"); setName(""); setPwd("");
  }

  async function fetchQuestions() {
    setLoading(true); setAnswers({}); setShowResult(false); setStartedAt(Date.now());
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
    } catch (e2) { setAuthMsg("Fehler beim Laden der Fragen:\n" + (rpcErr?.message || "") + "\n" + e2.message); }
    finally { setLoading(false); }
  }

  /** Auswertung speichern */
  async function saveAttempt() {
    if (!user) return;
    const payload = {
      user_id: user.id,
      email: user.email,
      score: questions.filter((q) => answers[q.id] === q.correct_idx).length,
      total: questions.length,
      started_at: startedAt ? new Date(startedAt).toISOString() : null,
      finished_at: new Date().toISOString(),
      duration_seconds: startedAt ? Math.max(0, Math.round((Date.now() - startedAt) / 1000)) : null,
      details: {
        question_ids: questions.map((q) => q.id),
        answers,
      },
    };
    const { error } = await supabase.from("attempts").insert(payload);
    if (error) setAuthMsg("Speichern der Statistik fehlgeschlagen: " + error.message);
  }

  /** Statistik laden */
  async function loadMyStats() {
    if (!user) return;
    setStatsLoading(true);
    try {
      const { data, error } = await supabase
        .from("attempts")
        .select("id, score, total, finished_at, duration_seconds")
        .eq("user_id", user.id)
        .order("finished_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      setMyAttempts(data || []);
    } catch (e) { setAuthMsg("Meine Statistik konnte nicht geladen werden: " + e.message); }
    finally { setStatsLoading(false); }
  }

  async function loadTeamStats() {
    if (role !== "admin") return;
    setStatsLoading(true);
    try {
      // hole letzte 180 Tage
      const since = new Date(Date.now() - 180*24*3600*1000).toISOString();
      const { data, error } = await supabase
        .from("attempts")
        .select("user_id, email, score, total, finished_at")
        .gte("finished_at", since)
        .order("finished_at", { ascending: false })
        .limit(5000);
      if (error) throw error;
      setTeamAttempts(data || []);
    } catch (e) { setAuthMsg("Team-Statistik konnte nicht geladen werden: " + e.message); }
    finally { setStatsLoading(false); }
  }

  // Tabs wechseln → ggf. Statistik nachladen
  useEffect(() => {
    if (tab === "stat") {
      loadMyStats();
      if (role === "admin") loadTeamStats();
    }
  }, [tab, role, user?.id]);

  /** Admin: Fragen-Liste laden */
  async function loadAdminList() {
    setAdminLoading(true);
    try {
      const { data, error } = await supabase
        .from("questions")
        .select("id, text, options, correct_idx, active, qtype")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      setAdminList(data || []);
    } catch (e) { setAuthMsg("Admin-Laden fehlgeschlagen: " + e.message); }
    finally { setAdminLoading(false); }
  }

  async function removeQuestion(id) {
    if (!window.confirm("Diese Frage wirklich löschen?")) return;
    const { error } = await supabase.from("questions").delete().eq("id", id);
    if (error) { alert(error.message); return; }
    await loadAdminList();
  }

  const header = (
    <div style={{ background: CARD, padding: 16, borderRadius: 16, border: `1px solid ${HILITE}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
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
      <div style={{ minHeight: "100vh", background: `radial-gradient(1000px 600px at -10% -10%, rgba(255,211,0,.15), transparent 50%), ${DEEP}`,
        display: "grid", placeItems: "center", color: "#E5E7EB", padding: 20 }}>
        <div style={{ width: "min(680px, 94vw)", background: CARD, padding: 26, borderRadius: 18, boxShadow: "0 6px 26px rgba(0,0,0,.45)", border: `1px solid ${HILITE}` }}>
          {header}
          <h2 style={{ marginTop: 20, marginBottom: 12, color: "#F3F4F6" }}>Login</h2>
          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
            <input placeholder="Benutzername (z. B. ADMIN) oder E-Mail" value={name} onChange={(e) => setName(e.target.value)}
              style={{ padding: "12px 14px", background: "#0B1220", color: "#E5E7EB", borderRadius: 12, border: `1px solid ${HILITE}` }} required />
            <input type="password" placeholder={first ? "Neues Passwort" : "Passwort"} value={pwd} onChange={(e) => setPwd(e.target.value)}
              style={{ padding: "12px 14px", background: "#0B1220", color: "#E5E7EB", borderRadius: 12, border: `1px solid ${HILITE}` }} required />
            <button type="submit" style={{ padding: "12px 14px", background: ACCENT, color: "#111827", fontWeight: 700, border: "none", borderRadius: 12, cursor: "pointer" }}>
              {first ? "Konto anlegen & einloggen" : "Einloggen"}
            </button>
          </form>
          {authMsg && <p style={{ marginTop: 10, color: "#F87171", whiteSpace: "pre-wrap" }}>{authMsg}</p>}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: `radial-gradient(1200px 700px at 105% -10%, rgba(255,211,0,.12), transparent 55%), ${DEEP}`,
      padding: 20, color: "#E5E7EB" }}>
      <div style={{ width: "min(1100px, 94vw)", margin: "0 auto", display: "grid", gap: 18 }}>
        {header}

        {/* Tabs */}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setTab("quiz")} style={{ padding: "10px 12px", borderRadius: 10, background: tab === "quiz" ? ACCENT : "#0B1220",
            color: tab === "quiz" ? "#111827" : "#E5E7EB", border: tab === "quiz" ? "none" : `1px solid ${HILITE}`, fontWeight: 800, cursor: "pointer" }}>Quiz</button>
          <button onClick={() => setTab("stat")} style={{ padding: "10px 12px", borderRadius: 10, background: tab === "stat" ? ACCENT : "#0B1220",
            color: tab === "stat" ? "#111827" : "#E5E7EB", border: tab === "stat" ? "none" : `1px solid ${HILITE}`, fontWeight: 800, cursor: "pointer" }}>Statistik</button>
          {role === "admin" && (
            <button onClick={() => { setTab("admin"); loadAdminList(); }} style={{ padding: "10px 12px", borderRadius: 10, background: tab === "admin" ? ACCENT : "#0B1220",
              color: tab === "admin" ? "#111827" : "#E5E7EB", border: tab === "admin" ? "none" : `1px solid ${HILITE}`, fontWeight: 800, cursor: "pointer" }}>Admin</button>
          )}
          <div style={{ marginLeft: "auto", color: "#9CA3AF" }}>
            {tab === "quiz" && (loading ? "Lade Fragen…" : `${questions.length} Fragen geladen${showResult ? ` · Ergebnis: ${score}/${questions.length}` : ""}`)}
            {tab === "admin" && (adminLoading ? "Lade…" : `${adminList.length} Fragen`)}
            {tab === "stat" && (statsLoading ? "Lade…" : `${myAttempts.length} Versuche`)}
          </div>
        </div>

        {/* Inhalt */}
        {tab === "quiz" ? (
          <>
            {/* OBERER Bereich – nur „Neu laden“ bleibt oben */}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={fetchQuestions} disabled={loading}
                style={{ padding: "10px 12px", background: "#0B1220", border: `1px solid ${HILITE}`, color: "#E5E7EB", borderRadius: 10, cursor: "pointer" }}>🔄 Neu laden</button>

              {showResult ? (
                <>
                  <button onClick={() => { setAnswers({}); setShowResult(false); setStartedAt(Date.now()); }}
                    style={{ padding: "10px 12px", background: "#1F2937", border: `1px solid ${HILITE}`, color: "#E5E7EB", borderRadius: 10, cursor: "pointer" }}>Auswahl zurücksetzen</button>
                  <button onClick={fetchQuestions}
                    style={{ padding: "10px 12px", background: ACCENT, color: "#111827", borderRadius: 10, fontWeight: 800, border: "none", cursor: "pointer" }}>▶︎ Neue Runde</button>
                </>
              ) : null}
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

                {/* AUSWERTEN – jetzt UNTEN unter der Liste; speichert auch */}
                <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                  <button onClick={async () => { setShowResult(true); await saveAttempt(); }} disabled={!allAnswered}
                    style={{ padding: "10px 12px", background: allAnswered ? ACCENT : "#6B7280", color: "#111827", borderRadius: 10, fontWeight: 800, border: "none", cursor: allAnswered ? "pointer" : "not-allowed" }}>Auswerten</button>
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
          </>
        ) : tab === "stat" ? (
          // ===== Statistik =====
          <div style={{ display: "grid", gap: 14 }}>
            {/* Eigene Kennzahlen */}
            <div style={{ background: CARD, border: `1px solid ${HILITE}`, borderRadius: 12, padding: 14 }}>
              <div style={{ fontWeight: 700, marginBottom: 10 }}>Meine Statistik</div>
              {myAttempts.length === 0 ? (
                <div style={{ color: "#9CA3AF" }}>Noch keine Versuche gespeichert. Spiele ein Quiz und werte es aus.</div>
              ) : (
                <>
                  {(() => {
                    const total = myAttempts.length;
                    const sumPct = myAttempts.reduce((acc, a) => acc + (a.total ? a.score / a.total : 0), 0);
                    const best = myAttempts.reduce((m, a) => Math.max(m, a.total ? Math.round(100 * a.score / a.total) : 0), 0);
                    const avg = Math.round((sumPct / total) * 100);
                    const last = myAttempts[0]?.finished_at;
                    return (
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <Badge label={`Versuche: ${total}`} />
                        <Badge label={`Ø Quote: ${avg}%`} />
                        <Badge label={`Bestleistung: ${best}%`} />
                        <Badge label={`Letzter: ${new Date(last).toLocaleString()}`} />
                      </div>
                    );
                  })()}

                  <div style={{ marginTop: 12, overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ textAlign: "left", color: "#CBD5E1" }}>
                          <th style={{ padding: 8 }}>Datum</th>
                          <th style={{ padding: 8 }}>Score</th>
                          <th style={{ padding: 8 }}>Quote</th>
                          <th style={{ padding: 8 }}>Dauer</th>
                        </tr>
                      </thead>
                      <tbody>
                        {myAttempts.map((a) => (
                          <tr key={a.id} style={{ borderTop: `1px solid ${HILITE}` }}>
                            <td style={{ padding: 8 }}>{new Date(a.finished_at).toLocaleString()}</td>
                            <td style={{ padding: 8 }}>{a.score} / {a.total}</td>
                            <td style={{ padding: 8 }}>{a.total ? Math.round(100 * a.score / a.total) : 0}%</td>
                            <td style={{ padding: 8 }}>{a.duration_seconds ? `${a.duration_seconds}s` : "–"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            {/* Team (nur Admin) */}
            {role === "admin" && (
              <div style={{ background: CARD, border: `1px solid ${HILITE}`, borderRadius: 12, padding: 14 }}>
                <div style={{ fontWeight: 700, marginBottom: 10 }}>Team-Statistik (letzte 180 Tage)</div>
                {teamAttempts.length === 0 ? (
                  <div style={{ color: "#9CA3AF" }}>Keine Daten vorhanden.</div>
                ) : (
                  <>
                    {(() => {
                      // Aggregation pro Email
                      const byEmail = new Map();
                      for (const a of teamAttempts) {
                        const key = (a.email || "").toUpperCase();
                        if (!byEmail.has(key)) byEmail.set(key, []);
                        byEmail.get(key).push(a);
                      }
                      const rows = Array.from(byEmail.entries()).map(([email, arr]) => {
                        const total = arr.length;
                        const sumPct = arr.reduce((acc, a) => acc + (a.total ? a.score / a.total : 0), 0);
                        const avg = Math.round((sumPct / total) * 100);
                        const best = arr.reduce((m, a) => Math.max(m, a.total ? Math.round(100 * a.score / a.total) : 0), 0);
                        const last = arr.sort((x,y) => new Date(y.finished_at) - new Date(x.finished_at))[0]?.finished_at;
                        return { email, total, avg, best, last };
                      }).sort((a,b) => a.email.localeCompare(b.email));

                      return (
                        <div style={{ overflowX: "auto" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                              <tr style={{ textAlign: "left", color: "#CBD5E1" }}>
                                <th style={{ padding: 8 }}>Mitarbeiter</th>
                                <th style={{ padding: 8 }}>Versuche</th>
                                <th style={{ padding: 8 }}>Ø Quote</th>
                                <th style={{ padding: 8 }}>Bestleistung</th>
                                <th style={{ padding: 8 }}>Letzter Versuch</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map((r) => (
                                <tr key={r.email} style={{ borderTop: `1px solid ${HILITE}` }}>
                                  <td style={{ padding: 8 }}>{r.email.split("@")[0]}</td>
                                  <td style={{ padding: 8 }}>{r.total}</td>
                                  <td style={{ padding: 8 }}>{r.avg}%</td>
                                  <td style={{ padding: 8 }}>{r.best}%</td>
                                  <td style={{ padding: 8 }}>{new Date(r.last).toLocaleString()}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            )}
          </div>
        ) : (
          // ===== Admin =====
          <div style={{ display: "grid", gap: 14 }}>
            <AdminEditor editing={editing} onCancel={() => setEditing(null)} onSaved={async () => { setEditing(null); await loadAdminList(); }} />
            <div style={{ background: CARD, border: `1px solid ${HILITE}`, borderRadius: 12, padding: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Fragen (neueste zuerst)</div>
              <div style={{ display: "grid", gap: 8 }}>
                {adminList.map((q) => (
                  <div key={q.id} style={{ border: `1px solid ${HILITE}`, borderRadius: 10, padding: 10, background: "#0B1220" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ color: "#E5E7EB", fontWeight: 600 }}>{q.text}</div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <span style={{ color: "#9CA3AF" }}>{q.active ? "aktiv" : "inaktiv"}</span>
                        <button onClick={() => setEditing(q)} style={{ padding: "6px 10px", background: "#1F2937", border: `1px solid ${HILITE}`, color: "#E5E7EB", borderRadius: 8, cursor: "pointer" }}>Bearbeiten</button>
                        <button onClick={() => removeQuestion(q.id)} style={{ padding: "6px 10px", background: "#DC2626", color: "white", border: "none", borderRadius: 8, cursor: "pointer" }}>Löschen</button>
                      </div>
                    </div>
                    <div style={{ marginTop: 6, color: "#CBD5E1", fontSize: 14 }}>
                      {q.options?.map((o, i) => (
                        <span key={i} style={{ padding: "2px 8px", borderRadius: 999, marginRight: 6, border: `1px solid ${i === q.correct_idx ? "#16A34A" : HILITE}`, color: i === q.correct_idx ? "#16A34A" : "#CBD5E1" }}>
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

function Badge({ label }) {
  return (
    <span style={{ background: "#0B1220", border: `1px solid ${HILITE}", padding: "8px 10px", borderRadius: 10, color: "#E5E7EB" }}>
      {label}
    </span>
  );
}
