import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

/** ====== Branding / Konfiguration ====== */
const MERKUR_LOGO_URL = ""; // << hier optional eine echte Bild-URL eintragen (PNG/SVG). Leer lassen = Fallback-Sonne.
const ACCENT = "#FFD300";    // Merkur-Gelb
const DEEP = "#0F172A";      // Slate-900
const CARD = "#111827D9";    // transparenter Dark-Card
const HILITE = "#1F2937";    // Slate-800

/** ====== Utility ====== */
const asEmail = (name) => {
  const s = name.trim();
  return s.includes("@") ? s : `${s.toUpperCase()}@quiz.local`;
};

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Eine einzelne Frage-Karte mit Auswahl */
function QuestionCard({ index, q, selected, onSelect, showResult }) {
  const isCorrect = showResult && selected === q.correct_idx;
  const isWrong = showResult && selected != null && selected !== q.correct_idx;

  return (
    <div
      style={{
        background: CARD,
        borderRadius: 14,
        padding: 18,
        border: `2px solid ${
          isCorrect ? "#16A34A" : isWrong ? "#DC2626" : "transparent"
        }`,
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
                border: `2px solid ${
                  correct ? "#16A34A"
                  : wrong ? "#DC2626"
                  : chosen ? ACCENT
                  : "#1F2937"
                }`,
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

export default function App() {
  /** Auth */
  const [name, setName] = useState("");
  const [pwd, setPwd] = useState("");
  const [first, setFirst] = useState(false);
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(""); // 'admin' | 'user'
  const [authMsg, setAuthMsg] = useState("");

  /** Quiz */
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState([]); // [{id, text, options[], correct_idx}]
  const [answers, setAnswers] = useState({}); // {questionId: idx}
  const [showResult, setShowResult] = useState(false);

  /** Ergebnis-Seite */
  const solved = useMemo(
    () =>
      questions.map((q) => ({
        id: q.id,
        correct: answers[q.id] === q.correct_idx,
      })),
    [answers, questions]
  );
  const score = useMemo(
    () => solved.filter((s) => s.correct).length,
    [solved]
  );

  useEffect(() => {
    // Session laden (falls vorhanden)
    supabase.auth.getUser().then(({ data }) => {
      const u = data?.user || null;
      setUser(u);
      setRole(u?.app_metadata?.role || "user");
      if (u) {
        fetchQuestions();
      }
    });
  }, []);

  /** ====== Auth Handlers ====== */
  async function handleSubmit(e) {
    e.preventDefault();
    setAuthMsg("");
    const email = asEmail(name);

    if (first) {
      const { error } = await supabase.auth.signUp({
        email,
        password: pwd,
        options: { data: { role: "user" } },
      });
      if (error) {
        setAuthMsg(error.message);
        return;
      }
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: pwd,
    });
    if (error) {
      if (/invalid login|user not found|email not confirmed/i.test(error.message)) {
        setFirst(true);
      } else {
        setAuthMsg(error.message);
      }
      return;
    }

    setUser(data.user);
    setRole(data.user?.app_metadata?.role || "user");
    fetchQuestions();
  }

  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
    setRole("");
    setQuestions([]);
    setAnswers({});
    setShowResult(false);
    setName("");
    setPwd("");
  }

  /** ====== Daten laden ====== */
  async function fetchQuestions() {
    setLoading(true);
    setAnswers({});
    setShowResult(false);

    // 1) Versuch über RPC (empfohlen)
    let rpcErr = null;
    try {
      const { data, error } = await supabase.rpc("get_random_questions_mc", {
        limit_count: 20,
      });
      if (error) rpcErr = error;
      if (data && Array.isArray(data) && data.length) {
        const sanitized = data.map((r) => ({
          id: r.id,
          text: r.text,
          options: r.options || [],
          correct_idx: r.correct_idx ?? null,
        }));
        setQuestions(sanitized);
        setLoading(false);
        return;
      }
    } catch (e) {
      rpcErr = e;
    }

    // 2) Fallback: direkt aus Tabelle lesen, lokal mischen
    try {
      const { data, error } = await supabase
        .from("questions")
        .select("id, text, options, correct_idx, active, qtype")
        .eq("qtype", "mc")
        .eq("active", true);

      if (error) throw error;

      const pool = (data || []).filter(
        (r) =>
          Array.isArray(r.options) &&
          typeof r.correct_idx === "number" &&
          r.correct_idx >= 0 &&
          r.correct_idx < r.options.length
      );
      const picked = shuffle(pool).slice(0, 20);
      setQuestions(
        picked.map((r) => ({
          id: r.id,
          text: r.text,
          options: r.options,
          correct_idx: r.correct_idx,
        }))
      );
    } catch (e2) {
      setAuthMsg(
        "Fehler beim Laden der Fragen. RPC und Fallback fehlgeschlagen:\n" +
          (rpcErr?.message || "") +
          "\n" +
          e2.message
      );
    } finally {
      setLoading(false);
    }
  }

  /** ====== UI ====== */
  const headerBadge = (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      {MERKUR_LOGO_URL ? (
        <img
          src={MERKUR_LOGO_URL}
          alt="Merkur"
          style={{ width: 28, height: 28, borderRadius: "50%" }}
        />
      ) : (
        // Fallback: simple Sonne
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
      )}
      <div style={{ fontWeight: 800, fontSize: 20, color: "#E5E7EB" }}>MaQuiz</div>
    </div>
  );

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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {headerBadge}
          </div>

          <h2 style={{ marginTop: 20, marginBottom: 12, color: "#F3F4F6" }}>
            Login
          </h2>

          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
            <input
              placeholder="Benutzername (z. B. ADMIN) oder E-Mail"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                padding: "12px 14px",
                background: "#0B1220",
                color: "#E5E7EB",
                borderRadius: 12,
                border: `1px solid ${HILITE}`,
              }}
              required
            />
            <input
              type="password"
              placeholder={first ? "Neues Passwort" : "Passwort"}
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              style={{
                padding: "12px 14px",
                background: "#0B1220",
                color: "#E5E7EB",
                borderRadius: 12,
                border: `1px solid ${HILITE}`,
              }}
              required
            />
            <button
              type="submit"
              style={{
                padding: "12px 14px",
                background: ACCENT,
                color: "#111827",
                fontWeight: 700,
                border: "none",
                borderRadius: 12,
                cursor: "pointer",
              }}
            >
              {first ? "Konto anlegen & einloggen" : "Einloggen"}
            </button>
          </form>

          {authMsg && (
            <p style={{ marginTop: 10, color: "#F87171", whiteSpace: "pre-wrap" }}>
              {authMsg}
            </p>
          )}
        </div>
      </div>
    );
  }

  /** Quiz-Ansicht oder Auswertung */
  const allAnswered = questions.length > 0 && questions.every((q) => answers[q.id] != null);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: `radial-gradient(1200px 700px at 105% -10%, rgba(255,211,0,.12), transparent 55%), ${DEEP}`,
        padding: 20,
        color: "#E5E7EB",
      }}
    >
      <div
        style={{
          width: "min(980px, 94vw)",
          margin: "0 auto",
          display: "grid",
          gap: 18,
        }}
      >
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
          {headerBadge}

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ color: "#9CA3AF", fontSize: 14 }}>
              Angemeldet als <b style={{ color: "#E5E7EB" }}>{user.email}</b>
              {role === "admin" ? " · Admin" : ""}
            </span>

            <button
              onClick={logout}
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
          </div>
        </div>

        {/* Werkzeugleiste */}
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            onClick={fetchQuestions}
            disabled={loading}
            title="Neue 20 Zufallsfragen laden"
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

          {!showResult ? (
            <button
              onClick={() => setShowResult(true)}
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
          ) : (
            <button
              onClick={() => {
                setAnswers({});
                setShowResult(false);
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
          )}

          {showResult && (
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
          )}

          <div style={{ marginLeft: "auto", color: "#9CA3AF" }}>
            {loading
              ? "Lade Fragen…"
              : `${questions.length} Fragen geladen${showResult ? ` · Ergebnis: ${score}/${questions.length}` : ""}`}
          </div>
        </div>

        {/* Inhalt */}
        {!showResult ? (
          <div style={{ display: "grid", gap: 14 }}>
            {questions.map((q, i) => (
              <QuestionCard
                key={q.id}
                index={i}
                q={q}
                selected={answers[q.id]}
                onSelect={(idx) => setAnswers((prev) => ({ ...prev, [q.id]: idx }))}
                showResult={false}
              />
            ))}
          </div>
        ) : (
          // Auswertungsseite
          <div
            style={{
              background: CARD,
              border: `1px solid ${HILITE}`,
              borderRadius: 16,
              padding: 18,
            }}
          >
            <h2 style={{ margin: "4px 0 12px 0", color: "#F3F4F6" }}>Auswertung</h2>
            <div
              style={{
                display: "flex",
                gap: 12,
                alignItems: "center",
                marginBottom: 14,
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  background: "#0B1220",
                  border: `1px solid ${HILITE}`,
                  padding: "10px 12px",
                  borderRadius: 10,
                  color: "#E5E7EB",
                }}
              >
                Punktzahl: <b>{score}</b> / {questions.length}
              </div>
              <div
                style={{
                  background: "#0B1220",
                  border: `1px solid ${HILITE}`,
                  padding: "10px 12px",
                  borderRadius: 10,
                  color: "#E5E7EB",
                }}
              >
                Quote: <b>{Math.round((score / (questions.length || 1)) * 100)}%</b>
              </div>
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              {questions.map((q, i) => (
                <QuestionCard
                  key={q.id}
                  index={i}
                  q={q}
                  selected={answers[q.id]}
                  onSelect={() => {}}
                  showResult={true}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
