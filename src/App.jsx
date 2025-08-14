import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabaseClient'

// Hilfsfunktion: Username -> Email (ADMIN -> ADMIN@quiz.local)
const asEmail = (nameOrEmail) => {
  const s = (nameOrEmail || '').trim()
  return s.includes('@') ? s : `${s.toUpperCase()}@quiz.local`
}

// Clientseitig mischen
const shuffle = (arr) => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function App() {
  const [user, setUser] = useState(null)
  const [emailInput, setEmailInput] = useState('')
  const [pwd, setPwd] = useState('')
  const [first, setFirst] = useState(false)
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({}) // {question_id: selected_idx}
  const [evaluated, setEvaluated] = useState(false)

  // ---------- Auth ----------
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setUser(data.session.user)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  async function handleLogin(e) {
    e.preventDefault()
    setMsg('')
    const email = asEmail(emailInput)

    try {
      setLoading(true)

      // Erst-Login (Konto anlegen)
      if (first) {
        const { error: signErr } = await supabase.auth.signUp({
          email,
          password: pwd,
          options: { data: { role: 'user' } },
        })
        if (signErr) throw signErr
      }

      // Einloggen
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: pwd,
      })
      if (error) {
        // Falls es den User noch nicht gibt → Umschalten auf "Konto anlegen"
        if (/invalid login|user not found|email not confirmed/i.test(error.message)) {
          setFirst(true)
          setMsg('Kein Konto gefunden – lege schnell eins an und versuche es erneut.')
        } else {
          throw error
        }
        return
      }
      setUser(data.user)
      setMsg('')
    } catch (err) {
      setMsg(err.message || String(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setUser(null)
    setQuestions([])
    setAnswers({})
    setEvaluated(false)
    setMsg('')
  }

  // ---------- Fragen laden (20 zufällige MC) ----------
  useEffect(() => {
    if (!user) return
    ;(async () => {
      setLoading(true)
      setEvaluated(false)
      setAnswers({})
      setQuestions([])
      setMsg('')

      // Versuch 1: RPC (falls du die Funktion in SQL angelegt hast)
      const tryRpc = async () => {
        try {
          const { data, error } = await supabase.rpc('get_random_questions_mc', { limit_count: 20 })
          if (error) throw error
          return data
        } catch (_e) {
          return null
        }
      }

      // Fallback: direkt aus der Tabelle ziehen und clientseitig mischen
      const tryDirect = async () => {
        const { data, error } = await supabase
          .from('questions')
          .select('id,text,options,correct_idx,qtype')
          .eq('qtype', 'mc')
        if (error) throw error
        return shuffle(data).slice(0, 20)
      }

      try {
        const viaRpc = await tryRpc()
        const data = viaRpc ?? (await tryDirect())
        setQuestions(Array.isArray(data) ? data : [])
      } catch (err) {
        console.error(err)
        setMsg('Fragen konnten nicht geladen werden.')
      } finally {
        setLoading(false)
      }
    })()
  }, [user])

  const allAnswered = useMemo(
    () => questions.length > 0 && questions.every((q) => Number.isInteger(answers[q.id])),
    [questions, answers]
  )

  const score = useMemo(() => {
    if (!evaluated) return 0
    return questions.reduce((sum, q) => sum + (answers[q.id] === q.correct_idx ? 1 : 0), 0)
  }, [evaluated, questions, answers])

  // ---------- UI ----------
  if (!user) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <Header />
          <h2 style={styles.h2}>Login</h2>
          <form onSubmit={handleLogin} style={{ display: 'grid', gap: 12 }}>
            <input
              placeholder="Benutzername (z. B. ADMIN) oder E-Mail"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              style={styles.input}
              required
            />
            <input
              type="password"
              placeholder={first ? 'Neues Passwort' : 'Passwort'}
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              style={styles.input}
              required
            />
            <button disabled={loading} style={styles.primaryBtn}>
              {first ? 'Konto anlegen & einloggen' : 'Einloggen'}
            </button>
          </form>
          {msg && <p style={styles.note}>{msg}</p>}
        </div>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <Header />
        <div style={styles.topbar}>
          <div>
            Angemeldet als <strong>{user.email}</strong>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={handleLogout} style={styles.linkBtn}>Abmelden</button>
          </div>
        </div>

        <h2 style={styles.h2}>20 Zufallsfragen</h2>
        {loading && <p style={styles.note}>Lade Fragen…</p>}
        {!loading && questions.length === 0 && (
          <p style={styles.note}>Keine Fragen gefunden (qtype=mc). Prüfe die SQL-Seeddaten.</p>
        )}

        <div style={{ display: 'grid', gap: 12 }}>
          {questions.map((q, idx) => (
            <div key={q.id} style={styles.qItem}>
              <div style={styles.qHead}>
                <span style={styles.qBadge}>{idx + 1}</span>
                <span style={{ fontWeight: 600 }}>{q.text}</span>
              </div>

              <div style={styles.optionWrap}>
                {(q.options ?? []).map((opt, i) => {
                  const selected = answers[q.id] === i
                  const isCorrect = evaluated && i === q.correct_idx
                  const isWrong = evaluated && selected && i !== q.correct_idx

                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        if (evaluated) return
                        setAnswers((prev) => ({ ...prev, [q.id]: i }))
                      }}
                      style={{
                        ...styles.optionBtn,
                        ...(selected ? styles.optionSelected : {}),
                        ...(isCorrect ? styles.optionCorrect : {}),
                        ...(isWrong ? styles.optionWrong : {}),
                      }}
                    >
                      {opt}
                    </button>
                  )
                })}
              </div>

              {evaluated && (
                <div style={styles.feedback}>
                  {answers[q.id] === q.correct_idx ? '✓ Richtig' : '✗ Falsch'}
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          {!evaluated ? (
            <button
              style={{ ...styles.primaryBtn, opacity: allAnswered ? 1 : 0.7 }}
              disabled={!allAnswered}
              onClick={() => setEvaluated(true)}
            >
              Auswerten
            </button>
          ) : (
            <>
              <div style={styles.scoreBox}>
                Ergebnis: <strong>{score}</strong> / {questions.length}
              </div>
              <button
                style={styles.secondaryBtn}
                onClick={() => {
                  // Neue Runde: Fragen neu laden
                  setEvaluated(false)
                  setAnswers({})
                  // einfach erneut triggern: so tun als ob User neu gesetzt wurde
                  setUser({ ...user })
                }}
              >
                Neue Runde
              </button>
            </>
          )}
        </div>

        {msg && <p style={styles.note}>{msg}</p>}
      </div>
    </div>
  )
}

function Header() {
  return (
    <div style={styles.header}>
      <div style={styles.logoDot} />
      <div style={{ fontWeight: 800, fontSize: 22 }}>MaQuiz</div>
    </div>
  )
}

// ---------- Styles (Merkur Look) ----------
const styles = {
  page: {
    minHeight: '100svh',
    background:
      'radial-gradient(1200px 600px at -10% -20%, rgba(252,211,77,.25), transparent), radial-gradient(1000px 500px at 110% -10%, rgba(234,179,8,.15), transparent), #0b1420',
    display: 'grid',
    placeItems: 'start center',
    padding: 24,
  },
  card: {
    width: 'min(960px, 100%)',
    background: 'rgba(9,16,26,0.8)',
    backdropFilter: 'blur(6px)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 20,
    boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
    color: '#e5e7eb',
  },
  header: {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  logoDot: {
    width: 16,
    height: 16,
    borderRadius: '50%',
    background: 'linear-gradient(180deg, #fde047, #eab308)',
    boxShadow: '0 0 0 3px rgba(234,179,8,.25), 0 0 20px #facc15 inset',
  },
  topbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 14,
    marginBottom: 8,
  },
  h2: {
    fontSize: 18,
    margin: '8px 0 12px',
    color: '#fef08a',
    fontWeight: 700,
  },
  input: {
    background: '#0f1b2b',
    border: '1px solid #1f2c3f',
    color: '#e5e7eb',
    borderRadius: 10,
    padding: '10px 12px',
    outline: 'none',
  },
  primaryBtn: {
    background: 'linear-gradient(180deg, #fde047, #eab308)',
    color: '#1a1a1a',
    border: 'none',
    borderRadius: 10,
    padding: '10px 14px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  secondaryBtn: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,.25)',
    color: '#e5e7eb',
    borderRadius: 10,
    padding: '10px 14px',
    cursor: 'pointer',
  },
  linkBtn: {
    background: 'transparent',
    border: 'none',
    color: '#facc15',
    fontWeight: 700,
    cursor: 'pointer',
  },
  note: { marginTop: 10, color: '#f8fafc', opacity: 0.8, fontSize: 14 },

  qItem: {
    background: '#0f1b2b',
    border: '1px solid #1f2c3f',
    borderRadius: 14,
    padding: 12,
  },
  qHead: { display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 },
  qBadge: {
    width: 24,
    height: 24,
    borderRadius: 999,
    background: 'rgba(250,204,21,.15)',
    border: '1px solid rgba(250,204,21,.35)',
    color: '#fde047',
    display: 'grid',
    placeItems: 'center',
    fontSize: 12,
    fontWeight: 800,
  },
  optionWrap: { display: 'grid', gap: 8 },
  optionBtn: {
    textAlign: 'left',
    background: '#0b1420',
    border: '1px solid #263244',
    color: '#e5e7eb',
    borderRadius: 10,
    padding: '10px 12px',
    cursor: 'pointer',
  },
  optionSelected: {
    borderColor: '#facc15',
    boxShadow: '0 0 0 3px rgba(250,204,21,.18) inset',
  },
  optionCorrect: {
    borderColor: '#22c55e',
    boxShadow: '0 0 0 3px rgba(34,197,94,.2) inset',
  },
  optionWrong: {
    borderColor: '#ef4444',
    boxShadow: '0 0 0 3px rgba(239,68,68,.2) inset',
  },
  feedback: { marginTop: 6, fontSize: 13, opacity: 0.9 },
  scoreBox: {
    background: 'rgba(250,204,21,.12)',
    border: '1px solid rgba(250,204,21,.4)',
    color: '#fde047',
    borderRadius: 10,
    padding: '10px 12px',
  },
}
