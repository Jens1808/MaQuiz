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

  // Nach Login: Versuch + Fragen
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
        setResult(null);
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
          setMsg(`SignUp: ${sErr.message}`);
          setLoading(false);
          return;
        }
      }
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: pwd });
      if (error) {
        const m = error.message.toLowerCase();
        if (m.includes('invalid login') || m.includes('user not found') || m.includes('email not confirmed')) {
          setFirst(true);
        } else {
          setMsg(`Login: ${error.message}`);
        }
        return;
      }
      setMsg(`Angemeldet als ${data.user.email}`);
    } catch (err) {
      setMsg(`Netzwerk: ${String(err)}`);
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

      for (const q of questions) {
        const given = (answers[q.id] ?? '').trim();
        const { data: ok, error: cErr } = await supabase
          .rpc('check_answer', { q_id: q.id, user_answer: given });
        if (cErr) throw cErr;
        if (ok) correct += 1;
        rows.push({ attempt_id: attemptId, question_id: q.id, given_answer: given, is_correct: !!ok });
      }

      const { error: insErr } = await supabase.from('quiz_answers').insert(rows);
      if (insErr) throw insErr;

      const { error: updErr } = await supabase
        .from('quiz_attempts')
        .update({ score: correct, finished_at: new Date().toISOString() })
        .eq('id', attemptId);
      if (updErr) throw updErr;

      const wrong = rows.filter(r => !r.is_correct).map(r => r.question_id);
      setResult({ total: questions.length, correct, wrongIds: new Set(wrong) });
    } catch (e) {
      setMsg(`Fehler beim Auswerten: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function restart() {
    if (!user) return;
    setQuestions([]); setAnswers({}); setAttemptId(null); setResult(null);
    setLoading(true);
    try {
      const { data: attempt } = await supabase
        .from('quiz_attempts')
        .insert({ user_id: user.id })
        .select().single();
      setAttemptId(attempt.id);
      const { data: qs } = await supabase.rpc('get_random_questions', { limit_count: 20 });
      setQuestions(qs ?? []);
    } finally { setLoading(false); }
  }

  const logout = async () => { await supabase.auth.signOut(); };

  return (
    <div className="container">
      <div className="card">
        <div className="header">
          <div className="logo" aria-hidden="true"></div>
          <div className="title">MaQuiz</div>
          <div style={{marginLeft:'auto'}} className="badge">
            <span className="dot"></span>
            <span>Merkur‑Style</span>
          </div>
        </div>

        {!user && (
          <>
            <p className="subtle">Bitte anmelden, um das Quiz zu starten.</p>
            <form onSubmit={handleSubmitLogin} className="grid" style={{maxWidth:440}}>
              <input
                placeholder="Benutzername (z. B. ADMIN, BEA …) oder E‑Mail"
                value={name}
                onChange={(e)=>setName(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder={first? 'Neues Passwort' : 'Passwort'}
                value={pwd}
                onChange={(e)=>setPwd(e.target.value)}
                required
              />
              <div className="row">
                <button className="btn btn-primary" disabled={loading}>
                  {first? 'Konto anlegen & einloggen' : 'Einloggen'}
                </button>
              </div>
              {msg && <p className="subtle" style={{color:'#ffd200'}}>{msg}</p>}
            </form>
          </>
        )}

        {user && (
          <>
            <div className="row split" style={{marginBottom:10}}>
              <div className="subtle">Angemeldet als <b style={{color:'#e9eef6'}}>{user.email}</b></div>
              <button className="btn btn-link" onClick={logout}>Abmelden</button>
            </div>

            <hr className="sep" />

            {!result && (
              <>
                <div className="row" style={{justifyContent:'space-between', marginBottom:6}}>
                  <div className="kpi"><span className="dot"></span><span>20 Zufallsfragen</span></div>
                  <div className="subtle">{loading ? 'Lade Fragen…' : questions.length ? `${questions.length} geladen` : 'Keine Fragen gefunden'}</div>
                </div>

                {questions.length > 0 && (
                  <form className="grid" onSubmit={(e)=>{e.preventDefault(); submitQuiz();}}>
                    {questions.map((q, idx) => (
                      <div key={q.id} className="q">
                        <div className="qhead">
                          <span className="qnum">{idx+1}</span>
                          <span>{q.text}</span>
                        </div>
                        <input
                          placeholder="Deine Antwort"
                          value={answers[q.id] ?? ''}
                          onChange={(e)=>setAnswers(a => ({...a, [q.id]: e.target.value}))}
                        />
                      </div>
                    ))}
                    <div className="row" style={{gap:10}}>
                      <button className="btn btn-primary" disabled={!allAnswered || loading}>Abgeben & Auswerten</button>
                      <button type="button" className="btn btn-secondary" onClick={restart} disabled={loading}>Neue Fragen</button>
                    </div>
                    {msg && <p className="subtle" style={{color:'#ffd200'}}>{msg}</p>}
                  </form>
                )}
              </>
            )}

            {result && (
              <div className="grid" style={{marginTop:8}}>
                <div className="row" style={{gap:10}}>
                  <div className="badge">
                    <strong>Score:</strong>
                    <span>{result.correct} / {result.total}</span>
                  </div>
                  <button className="btn btn-secondary" onClick={restart}>Noch einmal</button>
                </div>

                <div className="table">
                  <table>
                    <thead>
                      <tr><th>#</th><th>Frage</th><th>Erwartet</th><th>OK</th></tr>
                    </thead>
                    <tbody>
                      {questions.map((q, i) => {
                        const wrong = result.wrongIds.has(q.id);
                        return (
                          <tr key={q.id}>
                            <td style={{opacity:.7}}>{i+1}</td>
                            <td>{q.text}</td>
                            <td><code>{q.correct_answer}</code></td>
                            <td className={wrong ? 'danger' : 'success'}>{wrong ? '✗' : '✓'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
