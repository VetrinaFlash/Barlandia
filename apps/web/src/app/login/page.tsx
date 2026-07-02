'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

type Mode = 'login' | 'register';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await fetch(mode === 'login' ? '/api/auth/login' : '/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          mode === 'login' ? { email, password } : { email, username, password },
        ),
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        setError(data.message ?? 'Qualcosa è andato storto');
        return;
      }
      router.replace('/bar');
    } catch {
      setError('Errore di rete, riprova');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <div style={{ textAlign: 'center' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/logo-barlandia.png"
          alt="Barlandia"
          style={{ width: 'min(70vw, 300px)', height: 'auto' }}
        />
        <p className="auth-tagline">Il bar è aperto. Entra e fatti un giro.</p>
      </div>

      <form className="auth-card" onSubmit={onSubmit}>
        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => setMode('login')}
          >
            Accedi
          </button>
          <button
            type="button"
            className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
            onClick={() => setMode('register')}
          >
            Registrati
          </button>
        </div>

        {mode === 'register' && (
          <input
            placeholder="Username (3-20 caratteri)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            required
          />
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <input
          type="password"
          placeholder={mode === 'register' ? 'Password (min 8 caratteri)' : 'Password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
          required
        />

        <div className="auth-error">{error}</div>

        <button className="auth-submit" disabled={busy} type="submit">
          {busy ? 'Un attimo…' : mode === 'login' ? 'Entra nel bar' : 'Crea account'}
        </button>
      </form>
    </main>
  );
}
