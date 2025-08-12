import React, { useState } from 'react'
import { supabase } from './supabaseClient'

export default function App() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')

  async function handleLogin(e) {
    e.preventDefault()
    const { error } = await supabase.auth.signInWithOtp({ email })
    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Login-Link wurde gesendet! Bitte prüfe deine E-Mails.')
    }
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h1>Willkommen bei MaQuiz</h1>
      <form onSubmit={handleLogin}>
        <input
          type="email"
          placeholder="E-Mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button type="submit">Login-Link senden</button>
      </form>
      {message && <p>{message}</p>}
    </div>
  )
}