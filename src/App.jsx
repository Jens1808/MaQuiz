import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabaseClient'

const asEmail = (nameOrEmail) => {
  const s = (nameOrEmail || '').trim()
  return s.includes('@') ? s : `${s.toUpperCase()}@quiz.local`
}
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
  const [tab, setTab] = useState('quiz') // 'quiz' | 'admin'
  const [view, setView] = useState('quiz') // 'quiz' | 'results'
  const [emailInput, setEmailInput] = useState('')
  const [pwd, setPwd] = useState('')
  const [first, setFirst] = useState(false)
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  // Quiz state
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({}) // {id: idx}
  const [evaluated, setEvaluated] = useState(false)
  const [startedAt, setStartedAt] = useState(null)

  // Results state
  const [results, setResults] = useState(null) // {score,total,seconds,details:[{q,chosenIdx,correctIdx}]}

  // Admin state
  const [adminList, setAdminList] = useState([])
  const [adminLoading, setAdminLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [editItem, setEditItem] = useState(null)
  const [newQ, setNewQ] = useState({ text: '', optionsText: '', correctIdx: 0, active: true })

  const isAdmin = useMemo(() => user?.app_metadata?.role === 'admin', [user])

  // ---------- Auth ----------
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null))
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
      if (first) {
        const { error: signErr } = await supabase.auth.signUp({
          email,
          password: pwd,
          options: { data: { role: 'user' } },
        })
        if (signErr) throw signErr
      }
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: pwd })
      if (error) {
        if (/invalid login|user not found|email not confirmed/i.test(error.message)) {
          setFirst(true)
          setMsg('Kein Konto gefunden – Konto anlegen und erneut versuchen.')
        } else throw error
        return
      }
      setUser(data.user)
    } catch (err) {
      setMsg(err.message || String(err))
    } finally {
      setLoading(false)
    }
  }
  async function handleLogout() {
    await supabase.auth.signOut()
    setUser(null)
    // reset state
    setQuestions([]); setAnswers({}); setEvaluated(false); setResults(null)
    setView('quiz'); setTab('quiz'); setMsg('')
  }

  // ---------- Fragen laden (20 zufällige MC) ----------
  async function loadQuestions() {
    setLoading(true)
    setEvaluated(false); setAnswers({}); setResults(null); setView('quiz'); setMsg('')
    setQuestions([])
    setStartedAt(Date.now())

    const tryRpc = async () => {
      try {
        const { data, error } = await supabase.rpc('get_random_questions_mc', { limit_count: 20 })
        if (error) throw error
        return data
      } catch { return null }
    }
    const tryDirect = async () => {
      const { data, error } = await supabase
        .from('questions')
        .select('id,text,options,correct_idx,qtype,active')
        .eq('qtype','mc').eq('active', true)
      if (error) throw error
      return shuffle(data).slice(0,20)
    }
    try {
      const viaRpc = await tryRpc()
      const data = viaRpc ?? (await tryDirect())
      setQuestions(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error(e); setMsg('Fragen konnten nicht geladen werden.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { if (user) loadQuestions() }, [user])

  // ---------- Auswertung / Ergebnisse ----------
  function evaluateNow() {
    const total = questions.length
    const score = questions.reduce((n,q)=> n + (answers[q.id]===q.correct_idx ? 1 : 0), 0)
    const seconds = startedAt ? Math.round((Date.now() - startedAt)/1000) : null
    const details = questions.map(q => ({
      q,
      chosenIdx: answers[q.id],
      correctIdx: q.correct_idx
    }))
    setResults({ score, total, seconds, details })
    setEvaluated(true)
    setView('results')
  }

  // ---------- Admin (CRUD) ----------
  async function adminFetch() {
    if (!isAdmin) return
    setAdminLoading(true)
    try {
      const { data, error } = await supabase.from('questions')
        .select('id,text,options,correct_idx,active,created_at')
        .order('created_at', { ascending:false })
        .limit(500)
      if (error) throw error
      setAdminList(data || [])
    } catch (e) {
      console.error(e); setMsg('Admin: Konnte Fragenliste nicht laden.')
    } finally {
      setAdminLoading(false)
    }
  }
  useEffect(() => { if (user && isAdmin && tab==='admin') adminFetch() }, [user, isAdmin, tab])

  function parseOptions(text) {
    const raw = (text || '').split(/\r?\n|;/).map(s=>s.trim()).filter(Boolean)
    return raw.slice(0,8)
  }

  async function adminCreate(e) {
    e.preventDefault()
    const opts = parseOptions(newQ.optionsText)
    if (!newQ.text.trim() || opts.length<2) { setMsg('Mind. 2 Optionen erforderlich.'); return }
    const correct = Number(newQ.correctIdx)
    if (!Number.isInteger(correct) || correct<0 || correct>=opts.length) {
      setMsg('Korrekte Option: Index außerhalb des Bereichs.'); return
    }
    try {
      setAdminLoading(true)
      const { error } = await supabase.from('questions').insert({
        text: newQ.text.trim(), qtype:'mc', options: opts, correct_idx: correct, active: newQ.active,
      })
      if (error) throw error
      setNewQ({ text:'', optionsText:'', correctIdx:0, active:true })
      await adminFetch()
    } catch (e) {
      console.error(e); setMsg('Frage konnte nicht angelegt werden.')
    } finally {
      setAdminLoading(false)
    }
  }
  async function adminSaveEdit() {
    if (!editItem) return
    const opts = parseOptions(editItem.optionsText ?? (editItem.options||[]).join('\n'))
    const correct = Number(editItem.correct_idx ?? 0)
    if (!editItem.text?.trim()) { setMsg('Fragetext ist leer.'); return }
    if (opts.length<2) { setMsg('Mind. 2 Optionen erforderlich.'); return }
    if (!Number.isInteger(correct) || correct<0 || correct>=opts.length) {
      setMsg('Korrekte Option: Index außerhalb des Bereichs.'); return
    }
    try {
      setAdminLoading(true)
      const { error } = await supabase.from('questions')
        .update({ text: editItem.text.trim(), options: opts, correct_idx: correct, active: !!editItem.active, qtype:'mc' })
        .eq('id', editItem.id)
      if (error) throw error
      setEditItem(null)
      await adminFetch()
    } catch (e) {
      console.error(e); setMsg('Frage konnte nicht gespeichert werden.')
    } finally {
      setAdminLoading(false)
    }
  }
  async function adminDelete(id) {
    if (!confirm('Frage wirklich löschen?')) return
    try {
      setAdminLoading(true)
      const { error } = await supabase.from('questions').delete().eq('id', id)
      if (error) throw error
      await adminFetch()
    } catch (e) {
      console.error(e); setMsg('Frage konnte nicht gelöscht werden.')
    } finally {
      setAdminLoading(false)
    }
  }

  // ---------- UI ----------
  if (!user) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <Header />
          <h2 style={styles.h2}>Login</h2>
          <form onSubmit={handleLogin} style={{ display:'grid', gap:12 }}>
            <input style={styles.input} placeholder="Benutzername (z. B. ADMIN) oder E-Mail"
                   value={emailInput} onChange={(e)=>setEmailInput(e.target.value)} required />
            <input style={styles.input} type="password"
                   placeholder={first?'Neues Passwort':'Passwort'}
                   value={pwd} onChange={(e)=>setPwd(e.target.value)} required />
            <button disabled={loading} style={styles.primaryBtn}>
              {first? 'Konto anlegen & einloggen' : 'Einloggen'}
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
          <div>Angemeldet als <strong>{user.email}</strong> {isAdmin && <em style={{opacity:.8}}>(Admin)</em>}</div>
          <div style={{display:'flex', gap:8, alignItems:'center'}}>
            <button onClick={()=>{ setView('quiz'); setTab('quiz') }} style={{...styles.tabBtn, ...(tab==='quiz'?styles.tabActive:{})}}>Quiz</button>
            {isAdmin && (
              <button onClick={()=>{ setTab('admin'); setView('quiz') }} style={{...styles.tabBtn, ...(tab==='admin'?styles.tabActive:{})}}>Admin</button>
            )}
            <button onClick={handleLogout} style={styles.linkBtn}>Abmelden</button>
          </div>
        </div>

        {tab==='quiz' && view==='quiz' && (
          <QuizView
            loading={loading}
            questions={questions}
            answers={answers}
            setAnswers={setAnswers}
            evaluated={evaluated}
            evaluateNow={evaluateNow}
            reload={loadQuestions}
            startedAt={startedAt}
          />
        )}

        {tab==='quiz' && view==='results' && results && (
          <ResultsView
            results={results}
            onNewRound={()=>loadQuestions()}
            onBack={()=>{ setView('quiz'); setEvaluated(false) }}
            toAdmin={()=> setTab('admin')}
          />
        )}

        {tab==='admin' && (
          <AdminView
            adminLoading={adminLoading}
            adminList={adminList}
            search={search}
            setSearch={setSearch}
            newQ={newQ}
            setNewQ={setNewQ}
            adminCreate={adminCreate}
            editItem={editItem}
            setEditItem={setEditItem}
            adminSaveEdit={adminSaveEdit}
            adminDelete={adminDelete}
          />
        )}

        {msg && <p style={styles.note}>{msg}</p>}
      </div>
    </div>
  )
}

function QuizView({ loading, questions, answers, setAnswers, evaluated, evaluateNow, reload }) {
  const allAnswered = questions.length>0 && questions.every(q => Number.isInteger(answers[q.id]))
  return (
    <>
      <h2 style={styles.h2}>20 Zufallsfragen</h2>
      {loading && <p style={styles.note}>Lade Fragen…</p>}
      {!loading && questions.length===0 && <p style={styles.note}>Keine Fragen gefunden.</p>}
      <div style={{ display:'grid', gap:12 }}>
        {questions.map((q, idx)=>(
          <div key={q.id} style={styles.qItem}>
            <div style={styles.qHead}>
              <span style={styles.qBadge}>{idx+1}</span>
              <span style={{fontWeight:600}}>{q.text}</span>
            </div>
            <div style={styles.optionWrap}>
              {(q.options||[]).map((opt,i)=>{
                const selected = answers[q.id]===i
                return (
                  <button key={i} type="button"
                    onClick={()=>{ if (!evaluated) setAnswers(prev=>({...prev, [q.id]: i})) }}
                    style={{...styles.optionBtn, ...(selected?styles.optionSelected:{})}}>
                    {opt}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      <div style={{display:'flex', gap:12, marginTop:16}}>
        <button style={{...styles.primaryBtn, opacity: allAnswered?1:.6}} disabled={!allAnswered}
                onClick={evaluateNow}>
          Auswerten
        </button>
        <button style={styles.secondaryBtn} onClick={reload}>Neue Runde</button>
      </div>
    </>
  )
}

function ResultsView({ results, onNewRound, onBack, toAdmin }) {
  const [showOnlyWrong, setShowOnlyWrong] = useState(false)
  const pct = results.total ? Math.round((results.score / results.total) * 100) : 0
  const list = showOnlyWrong
    ? results.details.filter(d => d.chosenIdx !== d.correctIdx)
    : results.details

  return (
    <>
      <h2 style={styles.h2}>Auswertung</h2>
      <div style={styles.resultsGrid}>
        <div style={styles.kpi}><div className="k">Score</div><div className="v">{results.score} / {results.total}</div></div>
        <div style={styles.kpi}><div className="k">Quote</div><div className="v">{pct}%</div></div>
        <div style={styles.kpi}><div className="k">Zeit</div><div className="v">{results.seconds ?? '–'} s</div></div>
      </div>

      <div style={{display:'flex', gap:8, alignItems:'center', margin:'8px 0 12px'}}>
        <label style={{display:'flex', gap:8, alignItems:'center', fontSize:14}}>
          <input type="checkbox" checked={showOnlyWrong} onChange={e=>setShowOnlyWrong(e.target.checked)} />
          Nur falsche Antworten anzeigen
        </label>
        <span style={{opacity:.7, fontSize:13}}>({list.length} Einträge)</span>
      </div>

      <div style={{display:'grid', gap:10}}>
        {list.map((d, i)=>(
          <div key={i} style={styles.qItem}>
            <div style={{...styles.qHead, marginBottom:6}}>
              <span style={styles.qBadge}>{i+1}</span>
              <span style={{fontWeight:700}}>{d.q.text}</span>
            </div>
            <div style={{display:'grid', gap:6, fontSize:14}}>
              <div><b>Deine Auswahl:</b> {idxLabel(d.chosenIdx, d.q.options)}</div>
              <div><b>Korrekt:</b> {idxLabel(d.correctIdx, d.q.options)}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{display:'flex', gap:10, marginTop:16}}>
        <button style={styles.primaryBtn} onClick={onNewRound}>Neue Runde</button>
        <button style={styles.secondaryBtn} onClick={onBack}>Zurück zum Quiz</button>
        <button style={styles.secondaryBtn} onClick={toAdmin}>Admin</button>
      </div>
    </>
  )
}
const idxLabel = (idx, options=[]) => {
  if (!Number.isInteger(idx) || idx < 0 || idx >= options.length) return '—'
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
  return `${letters[idx]}) ${options[idx]}`
}

function AdminView({
  adminLoading, adminList, search, setSearch,
  newQ, setNewQ, adminCreate,
  editItem, setEditItem, adminSaveEdit, adminDelete
}) {
  const filtered = useMemo(()=>{
    const s = search.trim().toLowerCase()
    if (!s) return adminList
    return adminList.filter(q => (q.text||'').toLowerCase().includes(s))
  }, [search, adminList])

  return (
    <>
      <h2 style={styles.h2}>Fragen verwalten</h2>

      <form onSubmit={adminCreate} style={{display:'grid', gap:8, marginBottom:16}}>
        <label style={styles.label}>Fragetext</label>
        <textarea value={newQ.text} onChange={e=>setNewQ(p=>({...p, text:e.target.value}))}
                  style={styles.textarea} rows={2} required />
        <label style={styles.label}>Optionen (eine pro Zeile oder mit „;“ trennen)</label>
        <textarea value={newQ.optionsText} onChange={e=>setNewQ(p=>({...p, optionsText:e.target.value}))}
                  style={styles.textarea} rows={3} placeholder={"Ja\nNein\nNur auf Anfrage"} required />
        <label style={styles.label}>Index korrekte Option (0-basiert)</label>
        <input type="number" min="0" value={newQ.correctIdx}
               onChange={e=>setNewQ(p=>({...p, correctIdx:Number(e.target.value)}))}
               style={styles.input} />
        <label style={{...styles.label, display:'flex', gap:8, alignItems:'center'}}>
          <input type="checkbox" checked={newQ.active}
                 onChange={e=>setNewQ(p=>({...p, active:e.target.checked}))} />
          Aktiv
        </label>
        <button disabled={adminLoading} style={styles.primaryBtn}>Frage anlegen</button>
      </form>

      <div style={{display:'flex', gap:8, alignItems:'center', marginBottom:8}}>
        <input style={styles.input} placeholder="Suche im Fragetext…"
               value={search} onChange={e=>setSearch(e.target.value)} />
        <span style={{opacity:.8,fontSize:12}}>{filtered.length} Einträge</span>
      </div>

      {adminLoading && <p style={styles.note}>Lade…</p>}
      <div style={{display:'grid', gap:8}}>
        {filtered.map(q=>(
          <div key={q.id} style={styles.adminRow}>
            <div style={{display:'grid', gap:6}}>
              <div style={{fontWeight:600, display:'flex', gap:8, alignItems:'center'}}>
                {q.text}
                {!q.active && <span style={styles.badgeMuted}>inaktiv</span>}
              </div>
              <div style={{fontSize:13, opacity:.85}}>
                {(q.options||[]).map((o,i)=>(
                  <span key={i} style={{marginRight:10}}>
                    {i===q.correct_idx ? <b>[{i}] {o}</b> : `[${i}] ${o}`}
                  </span>
                ))}
              </div>
            </div>
            <div style={{display:'flex', gap:8}}>
              <button style={styles.secondaryBtn} onClick={()=>{
                setEditItem({
                  ...q,
                  optionsText: (q.options||[]).join('\n')
                })
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}>Bearbeiten</button>
              <button style={{...styles.secondaryBtn, borderColor:'#ef4444'}} onClick={()=>adminDelete(q.id)}>Löschen</button>
            </div>
          </div>
        ))}
      </div>

      {editItem && (
        <div style={{...styles.card, marginTop:16}}>
          <h3 style={{...styles.h2, marginTop:0}}>Frage bearbeiten</h3>
          <label style={styles.label}>Fragetext</label>
          <textarea value={editItem.text} onChange={e=>setEditItem(p=>({...p, text:e.target.value}))}
                    style={styles.textarea} rows={2} />
          <label style={styles.label}>Optionen</label>
          <textarea value={editItem.optionsText}
                    onChange={e=>setEditItem(p=>({...p, optionsText:e.target.value}))}
                    style={styles.textarea} rows={3} />
          <label style={styles.label}>Index korrekte Option</label>
          <input type="number" min="0" value={editItem.correct_idx}
                 onChange={e=>setEditItem(p=>({...p, correct_idx:Number(e.target.value)}))}
                 style={styles.input} />
          <label style={{...styles.label, display:'flex', gap:8, alignItems:'center'}}>
            <input type="checkbox" checked={!!editItem.active}
                   onChange={e=>setEditItem(p=>({...p, active:e.target.checked}))} />
            Aktiv
          </label>
          <div style={{display:'flex', gap:8, marginTop:8}}>
            <button style={styles.primaryBtn} onClick={adminSaveEdit}>Speichern</button>
            <button style={styles.secondaryBtn} onClick={()=>setEditItem(null)}>Abbrechen</button>
          </div>
        </div>
      )}
    </>
  )
}

function Header() {
  return (
    <div style={styles.header}>
      <MerkurSun />
      <div style={{ fontWeight: 800, fontSize: 22 }}>MaQuiz</div>
    </div>
  )
}

/**
 * Merkurnahe Sonne als inline-SVG (stilisiert, keine Marken-Grafik)
 * Gelb, leichte Strahlen, Glow – leichtgewichtig und ohne Asset-Datei.
 */
function MerkurSun() {
  return (
    <svg width="26" height="26" viewBox="0 0 64 64" aria-hidden focusable="false"
      style={{ filter:'drop-shadow(0 0 6px rgba(250,204,21,.8))', marginRight:8 }}>
      <defs>
        <radialGradient id="g" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff59e"/>
          <stop offset="60%" stopColor="#fde047"/>
          <stop offset="100%" stopColor="#eab308"/>
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="14" fill="url(#g)" stroke="#f59e0b" strokeWidth="2"/>
      {Array.from({length:16}).map((_,i)=>{
        const a = (i/16)*Math.PI*2
        const x1 = 32 + Math.cos(a)*18
        const y1 = 32 + Math.sin(a)*18
        const x2 = 32 + Math.cos(a)*28
        const y2 = 32 + Math.sin(a)*28
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#facc15" strokeWidth="3" strokeLinecap="round"/>
      })}
    </svg>
  )
}

// ---------- Styles ----------
const styles = {
  page: {
    minHeight:'100svh',
    background:
      'radial-gradient(1200px 600px at -10% -20%, rgba(252,211,77,.25), transparent), radial-gradient(1000px 500px at 110% -10%, rgba(234,179,8,.15), transparent), #0b1420',
    display:'grid', placeItems:'start center', padding:24
  },
  card: {
    width:'min(1000px,100%)', background:'rgba(9,16,26,0.8)', backdropFilter:'blur(6px)',
    border:'1px solid rgba(255,255,255,0.06)', borderRadius:16, padding:20, color:'#e5e7eb',
    boxShadow:'0 10px 30px rgba(0,0,0,0.35)'
  },
  header: { display:'flex', gap:8, alignItems:'center', marginBottom:12 },
  topbar: { display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:14, marginBottom:8 },
  h2: { fontSize:18, margin:'8px 0 12px', color:'#fef08a', fontWeight:700 },
  input: {
    background:'#0f1b2b', border:'1px solid #1f2c3f', color:'#e5e7eb',
    borderRadius:10, padding:'10px 12px', outline:'none'
  },
  textarea: {
    background:'#0f1b2b', border:'1px solid #1f2c3f', color:'#e5e7eb',
    borderRadius:10, padding:'10px 12px', outline:'none', resize:'vertical'
  },
  primaryBtn: {
    background:'linear-gradient(180deg, #fde047, #eab308)', color:'#1a1a1a', border:'none',
    borderRadius:10, padding:'10px 14px', fontWeight:700, cursor:'pointer'
  },
  secondaryBtn: {
    background:'transparent', border:'1px solid rgba(255,255,255,.25)', color:'#e5e7eb',
    borderRadius:10, padding:'10px 14px', cursor:'pointer'
  },
  linkBtn: { background:'transparent', border:'none', color:'#facc15', fontWeight:700, cursor:'pointer' },
  note: { marginTop:10, color:'#f8fafc', opacity:0.8, fontSize:14 },

  tabBtn: {
    background:'transparent', border:'1px solid rgba(255,255,255,.25)', color:'#e5e7eb',
    borderRadius:999, padding:'6px 12px', cursor:'pointer', fontWeight:700
  },
  tabActive: { borderColor:'#facc15', boxShadow:'0 0 0 3px rgba(250,204,21,.18) inset', color:'#fde047' },

  qItem: { background:'#0f1b2b', border:'1px solid #1f2c3f', borderRadius:14, padding:12 },
  qHead: { display:'flex', gap:10, alignItems:'center', marginBottom:8 },
  qBadge: {
    width:24, height:24, borderRadius:999, background:'rgba(250,204,21,.15)',
    border:'1px solid rgba(250,204,21,.35)', color:'#fde047', display:'grid', placeItems:'center',
    fontSize:12, fontWeight:800
  },
  optionWrap: { display:'grid', gap:8 },
  optionBtn: {
    textAlign:'left', background:'#0b1420', border:'1px solid #263244', color:'#e5e7eb',
    borderRadius:10, padding:'10px 12px', cursor:'pointer'
  },
  optionSelected: { borderColor:'#facc15', boxShadow:'0 0 0 3px rgba(250,204,21,.18) inset' },

  resultsGrid: {
    display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))',
    gap:10, marginBottom:12
  },
  kpi: {
    background:'rgba(250,204,21,.1)', border:'1px solid rgba(250,204,21,.35)',
    borderRadius:12, padding:'10px 12px'
  },

  feedback: { marginTop:6, fontSize:13, opacity:0.9 },
  scoreBox: {
    background:'rgba(250,204,21,.12)', border:'1px solid rgba(250,204,21,.4)',
    color:'#fde047', borderRadius:10, padding:'10px 12px'
  },

  adminRow: {
    display:'flex', justifyContent:'space-between', alignItems:'flex-start',
    gap:12, background:'#0f1b2b', border:'1px solid #1f2c3f', borderRadius:12, padding:12
  },
  label: { fontSize:12, opacity:.9 },
  badgeMuted: {
    border:'1px solid #475569', color:'#94a3b8', padding:'2px 6px', borderRadius:999, fontSize:11
  }
}
