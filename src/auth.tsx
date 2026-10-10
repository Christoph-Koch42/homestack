import { useEffect, useState, type FormEvent } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { auth } from './firebase';
import Composition from './ui/Composition';
import Field from './ui/Field';
import Button from './ui/Button';
import './auth.css';

export function useAuthUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  return { user, loading };
}

export function signOutUser(): Promise<void> {
  return signOut(auth);
}

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch {
      setError(
        navigator.onLine
          ? 'Sign in failed. Check your email and password.'
          : 'No connection. Sign in once upstairs; after that HomeStack works offline.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login">
      <div className="login__art swiss-grid">
        <Composition size={220} />
      </div>
      <form className="login__form" onSubmit={handleSubmit}>
        <p className="label login__kicker">
          <span className="login__num">01.</span> Inventory
        </p>
        <h1 className="login__title">Home&shy;Stack</h1>
        <Field
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          required
        />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
        {error && <p className="login__error" role="alert">{error}</p>}
        <Button type="submit" variant="accent" size="lg" block disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </div>
  );
}
