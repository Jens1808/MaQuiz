import React, { useState } from 'react'
import { supabase } from './supabaseClient'

const asEmail = (name) => {
  const s = name.trim()
  return s.includes('@') ? s : `${s.toUpperCase()}@quiz.local`
}

export default function App() {
  const [name, setName] = useState('')
  const [pwd, setPwd] = useState('')
  const [first, setFirst] = useState(false)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false) // NEU

  async function handleSubmit(e) {
    e.preventDefault()
    setMsg('')
    setBusy(true) // NEU
    const email = asEmail(name)

    try {
      if (first) {
        const { error } = await supabase.auth.signUp({
          email, password: pwd, options: { data: { role: 'user' } }
        })
        if (error) { setMsg(`SignUp: ${error.message}`); return }
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password: pwd })
      if (error) {
        // Nur bei typischen Login-Problemen in den "Erstpasswort"-Modus
        const em = error.message.toLowerCase()
        if (em.includes('invalid login') || em.includes('user not found') || em.includes('email not confirmed')) {
          setFirst(true)
        } else {
          setMsg(`Login: ${error.message}`)
        }
        return
      }
      setMsg(`Angemeldet als ${data.user.email}`)
    } catch (err) {
      setMsg(`Netzwerkfehler: ${String(err)}`)
    } finally {
      setBusy(false) // NEU
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui, Arial' }}>
      <h1>MaQuiz – Login</h1>
      <form onSubmit={handleSubmit} style={{ display:'grid', gap:12, maxWidth:360 }}>
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
        <button disabled={busy}>
          {busy ? '…' : (first? 'Konto anlegen & einloggen' : 'Einloggen')}
        </button>
      </form>
      {msg && <p style={{marginTop:12}}>{msg}</p>}
    </div>
  )
}
