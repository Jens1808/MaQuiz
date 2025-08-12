import React, { useState } from 'react'
import { supabase } from './supabaseClient'

const asEmail = (name) => `${name.trim().toUpperCase()}@quiz.local`

export default function App() {
  const [name, setName] = useState('')
  const [pwd, setPwd] = useState('')
  const [first, setFirst] = useState(false)
  const [msg, setMsg] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setMsg('')
    const email = asEmail(name)

    // Erstes Login? -> Account anlegen, sonst normales Sign-In
    if (first) {
      const { error } = await supabase.auth.signUp({
        email,
        password: pwd,
        options: { data: { role: 'user' } }
      })
      if (error) { setMsg(error.message); return }
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pwd })
    if (error) {
      // Wenn Nutzer noch nicht existiert oder PW falsch -> Umschalten auf Erstpasswort
      if (/invalid login|user not found|email not confirmed/i.test(error.message)) {
        setFirst(true)
      } else {
        setMsg(error.message)
      }
      return
    }
    setMsg(`Angemeldet als ${data.user.email}`)
  }

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui, Arial' }}>
      <h1>MaQuiz – Login</h1>
      <form onSubmit={handleSubmit} style={{ display:'grid', gap:12, maxWidth:360 }}>
        <input
          placeholder="Benutzername (z. B. ADMIN, BEA …)"
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
        <button>{first? 'Konto anlegen & einloggen' : 'Einloggen'}</button>
      </form>
      {msg && <p style={{ marginTop:12 }}>{msg}</p>}
    </div>
  )
}
