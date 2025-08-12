import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabaseClient';

const asEmail = (nameOrMail) => {
  const s = nameOrMail.trim();
  return s.includes('@') ? s : `${s.toUpperCase()}@quiz.local`;
};

export default function App() {
  const [name, setName] = useState('');
  const [pwd, setPwd] = useState('');
  const [first, setFirst] = useState(false);
  const [msg, setMsg] = useState('');
  const [user, setUser] = useState(null);

  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [attemptId, setAttemptId] = useState(null);
  const [result, setResult] = useState(null);

  // Session wiederherstellen
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setUser(data.session.user);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Nach Login: Fragen + Versuch anlegen
  useEffect(() => {
    if (!user) return;
    (async () => {
      setMsg('');
      setLoading(true);
      try {
        const { data: attempt, error: aErr } = await supabase
          .from('quiz_attempts')
          .insert({ user_id: user.id })
          .select()
          .single();
        if (aErr) throw aErr;
        setAttemptId(attempt.id);

        const { data: qs, error: qErr } = await supabase
          .rpc('get_random_questions', { limit_count: 20 });
        if (qErr) throw qErr;

        setQuestions(qs ?? []);
        setAnswers({});
      } catch (e) {
        setMsg(`Fehler beim Laden: ${e.message}`);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  async function handleSubmitLogin(e) {
    e.preventDefault();
    setMsg('');
    const email = asEmail(name);

    try {
      setLoading(true);
      if (first) {
        const { error: sErr } = await supabase.auth.signUp({
          email, password: pwd, options: { data: { role: 'user' } }
        });
        if (sErr) {
          setMsg(sErr.message);
          setLoading(false);
          return;
        }
      }
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: pwd });
      if (error) {
        if (/invalid login|user not found|email not confirmed/i.test(error.message)) {
          setFirst(true);
        } else {
          setMsg(error.message);
        }
        return;
      }
      setMsg(`Angemeldet als ${data.user.email}`);
    } finally {
      setLoading(false);
    }
  }

  const allAnswered = useMemo(() => {
    if (!questions.length) return false;
    return questions.every(q => (answers[q.id] ?? '').trim().length > 0);
  }, [questions, answers]);

  async function submitQuiz() {
    if (!user || !attemptId) return;
    setLoading(true);
    setMsg('');
    try {
      let correct = 0;
      const rows = [];

      // Antworten prüfen (serverseitig über check_answer -> akzeptiert Synonyme / Kleinschreibung)
      for (const q of questions) {
        const given = (answers[q.id] ?? '').trim();
        const { data: ok, error: cErr } = await supabase
          .rpc('check_answer', { q_id: q.id, user_answer: given });
        if (cErr) throw cErr;
        if (ok) correct += 1;
        rows.push({
          attempt_id: attemptId,
          question_id: q.id,
          given_answer: given,
          is_correct: !!ok,
        });
      }

      // Antworten speichern
      const { error: insErr } = await supabase.from('quiz_answers').insert(rows);
      if (insErr) throw insErr;

      // Versuch abschließen
      const { error: updErr } = await supabase
        .from('quiz_attempts')
        .update({ score: correct, finished_at: new Date().toISOString() })
        .eq('id', attemptId);
      if (updErr) throw updErr;

      const wrong = rows.filter(r => !r.is_correct).map(r => r.question_id);
      setResult({
        total: questions.length,
        correct,
        wrongIds: new Set(wrong),
      });
    } catch (e) {
      setMsg(`Fehler beim Auswerten: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  function resetForNewAttempt() {
    setQuestions([]);
    setAnswers({});
    setAttemptId(null);
    setResult(null);
    // Neue Fragen laden wird durch user-effect oben automatisch passieren,
    // wenn wir einfach user "ticken": wir setzen ihn kurz null und wieder ...
    setUser({ ...user }); // noop, aber triggert keinen Reload -> deshalb manuell:
    (async () => {
      setLoading(true);
      try {
        const { data: attempt } = await supabase
          .from('quiz_attempts')
          .insert({ user_id: user.id })
          .select()
          .single();
        setAttemptId(attempt.id);
        const { data: qs } = await supabase.rpc('get_random_questions', { limit_count: 20 });
        setQuestions(qs ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }

  if (!user) {
    return (
      <div style={{ padding: 24, fontFamily: 'system-ui, Arial', maxWidth: 520 }}>
        <h1>MaQuiz – Login</h1>
        <form onSubmit={handleSubmitLogin} style={{ display: 'grid', gap: 10 }}>
          <input
            placeholder="Benutzername (z. B. ADMIN, BEA …) oder E‑Mail"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder={first ? 'Neues Passwort' : 'Passwort'}
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            required
          />
          <button disabled={loading}>{first ? 'Konto anlegen & einloggen' : 'Einloggen'}</button>
        </form>
        {msg && <p style={{ marginTop: 12 }}>{msg}</p>}
      </div>
    );
  }

  // Nach Login: Quizansicht
  return (
    <div style={{ padding: 24, fontFamily: 'system-ui, Arial', maxWidth: 900 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
        <strong>Eingeloggt:</strong>
        <span>{user.email}</span>
        <button
          onClick={async () => { await supabase.auth.signOut(); }}
          style={{ marginLeft: 'auto' }}
        >
          Abmelden
        </button>
      </div>

      {loading && <p>Lade …</p>}
      {msg && <p style={{ color: 'crimson' }}>{msg}</p>}

      {!loading && questions.length > 0 && !result && (
        <>
          <h2>Quiz – 20 Zufallsfragen</h2>
          <div style={{ display: 'grid', gap: 16 }}>
            {questions.map((q, idx) => (
              <div key={q.id} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>
                  {idx + 1}. {q.text}
                </div>
                <input
                  placeholder="Antwort eingeben"
                  value={answers[q.id] ?? ''}
                  onChange={(e) => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
                  style={{ width: '100%' }}
                />
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <button onClick={submitQuiz} disabled={!allAnswered || loading}>
              Abgeben & Auswerten
            </button>
            <button onClick={resetForNewAttempt} disabled={loading}>
              Neu starten
            </button>
          </div>
        </>
      )}

      {result && (
        <div style={{ marginTop: 24 }}>
          <h2>Auswertung</h2>
          <p>
            Ergebnis: <strong>{result.correct}</strong> von {result.total} korrekt.
          </p>
          <h3>Falsche Antworten</h3>
          {questions.filter(q => result.wrongIds.has(q.id)).length === 0 ? (
            <p>Alles richtig – stark!</p>
          ) : (
            <ul>
              {questions.filter(q => result.wrongIds.has(q.id)).map(q => (
                <li key={q.id}>
                  <div style={{ fontWeight: 600 }}>{q.text}</div>
                  <div>Korrekt: {q.correct_answer}</div>
                </li>
              ))}
            </ul>
          )}
          <div style={{ marginTop: 12 }}>
            <button onClick={resetForNewAttempt}>Noch einmal</button>
          </div>
        </div>
      )}

      {!loading && !result && questions.length === 0 && (
        <p>Keine Fragen gefunden. Lege Fragen in <code>public.questions</code> an.</p>
      )}
    </div>
  );
}
