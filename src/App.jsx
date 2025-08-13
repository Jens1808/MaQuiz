import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabaseClient'

const asEmail = (name) => {
  const s = name.trim()
  return s.includes('@') ? s : `${s.toUpperCase()}@quiz.local`
}

function Login({ onLogin }) {
  const [name, setName] = useState('')
  const [pwd, setPwd] = useState('')
  const [first, setFirst] = useState(false)
  const [msg, setMsg] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setMsg('')
    const email = asEmail(name)

    if (first) {
      const { error } = await supabase.auth.signUp({
        email, password: pwd, options: { data: { role: 'user' } }
      })
      if (error) { setMsg(error.message); return }
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pwd })
    if (error) {
      if (/invalid login|user not found|email not confirmed/i.test(error.message)) {
        setFirst(true)
      } else setMsg(error.message)
      return
    }
    onLogin(data.user)
  }

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui, Arial', maxWidth: 420 }}>
      <h1>MaQuiz – Login</h1>
      <form onSubmit={handleSubmit} style={{ display:'grid', gap:12 }}>
        <input placeholder="Benutzername (z. B. ADMIN, BEA …) oder E‑Mail"
               value={name} onChange={e=>setName(e.target.value)} required />
        <input type="password" placeholder={first? 'Neues Passwort' : 'Passwort'}
               value={pwd} onChange={e=>setPwd(e.target.value)} required />
        <button>{first? 'Konto anlegen & einloggen' : 'Einloggen'}</button>
      </form>
      {msg && <p style={{marginTop:12, color:'#c00'}}>{msg}</p>}
    </div>
  )
}

function Card({ children }) {
  return (
    <div style={{
      background:'#0f172a', border:'1px solid #334155', borderRadius:16,
      padding:16, boxShadow:'0 10px 30px rgba(0,0,0,.25)'
    }}>{children}</div>
  )
}

export default function App() {
  const [user, setUser] = useState(null)
  const [questions, setQuestions] = useState([])
  const [choices, setChoices] = useState({}) // id -> selected index
  const [status, setStatus] = useState('idle') // idle | loading | grading | done
  const [result, setResult] = useState(null)
  const isAdmin = useMemo(() => user?.app_metadata?.role === 'admin', [user])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null))
  }, [])

  async function loadQuestions() {
    setStatus('loading')
    const { data, error } = await supabase.rpc('get_random_questions_mc', { limit_count: 20 })
    if (error) { console.error(error); setStatus('idle'); return }
    setQuestions(data || [])
    setChoices({})
    setStatus('idle')
  }

  useEffect(() => {
    if (user) loadQuestions()
  }, [user])

  function setChoice(qid, idx) {
    setChoices(prev => ({ ...prev, [qid]: idx }))
  }

  async function submit() {
    const answers = questions.map(q => ({
      question_id: q.id,
      selected_idx: Number.isInteger(choices[q.id]) ? choices[q.id] : -1
    }))
    setStatus('grading')
    const { data, error } = await supabase.rpc('grade_attempt_mc', { answers })
    if (error) { console.error(error); setStatus('idle'); return }
    setResult(data)
    setStatus('done')
  }

  async function logout() {
    await supabase.auth.signOut()
    setUser(null)
    setQuestions([])
    setChoices({})
    setResult(null)
  }

  return !user ? (
    <Login onLogin={setUser} />
  ) : (
    <div style={{
      minHeight:'100dvh',
      padding:24,
      fontFamily:'system-ui, Arial',
      color:'#e2e8f0',
      background:'radial-gradient(1200px 700px at 20% 0%, #1f2937, #0b1220)'
    }}>
      <div style={{maxWidth:900, margin:'0 auto', display:'grid', gap:16}}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
          <h1 style={{display:'flex', gap:12, alignItems:'center'}}>
            <span style={{
              width:18, height:18, borderRadius:'50%', background:'#ffd700',
              boxShadow:'0 0 20px #ffd700aa'
            }} />
            MaQuiz {isAdmin && <small style={{marginLeft:8, color:'#94a3b8'}}>(Admin)</small>}
          </h1>
          <button onClick={logout}>Abmelden</button>
        </div>

        <Card>
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
            <strong>20 Zufallsfragen (Multiple Choice)</strong>
            <button onClick={loadQuestions} disabled={status==='loading'}>Neu ziehen</button>
          </div>
          <div style={{marginTop:8, color:'#94a3b8'}}>{questions.length} geladen</div>
        </Card>

        {questions.map((q, i) => (
          <Card key={q.id}>
            <div style={{display:'grid', gap:10}}>
              <div style={{fontWeight:600}}>{i+1}. {q.text}</div>
              <div style={{display:'grid', gap:8}}>
                {(q.options || []).map((opt, idx) => (
                  <label key={idx} style={{
                    display:'flex', alignItems:'center', gap:10,
                    padding:'8px 10px', border:'1px solid #334155', borderRadius:12,
                    background: (choices[q.id]===idx)?'#1e293b':'transparent'
                  }}>
                    <input
                      type="radio"
                      name={`q-${q.id}`}
                      checked={choices[q.id]===idx}
                      onChange={()=>setChoice(q.id, idx)}
                    />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            </div>
          </Card>
        ))}

        <div style={{display:'flex', gap:12}}>
          <button onClick={submit} disabled={questions.length===0 || status!=='idle'}>
            Antworten abgeben
          </button>
          {result && (
            <div style={{alignSelf:'center', color:'#facc15', fontWeight:700}}>
              Ergebnis: {result.score} / {result.total}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
