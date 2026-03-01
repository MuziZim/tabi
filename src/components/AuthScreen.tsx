import { useState, type FormEvent } from 'react';

interface AuthScreenProps {
  onSignIn: (email: string) => Promise<{ error: unknown }>;
}

export function AuthScreen({ onSignIn }: AuthScreenProps) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await onSignIn(email);
    if (error) {
      const message =
        error instanceof Error ? error.message :
        (typeof error === 'object' && error !== null && 'message' in error) ? String((error as Record<string, unknown>).message) :
        'Something went wrong. Please try again.';
      setError(message);
    } else {
      setSent(true);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="text-6xl mb-3">⛩️</div>
          <h1 className="font-display text-4xl text-sumi mb-1">旅 Tabi</h1>
          <p className="font-body text-sumi-muted text-sm tracking-wide">
            Your journey companion
          </p>
        </div>

        {sent ? (
          <div className="bg-white rounded-2xl p-8 shadow-card text-center animate-fade-in">
            <div className="text-4xl mb-4">✉️</div>
            <h2 className="font-display text-xl text-sumi mb-2">Check your email</h2>
            <p className="text-sumi-light text-sm leading-relaxed">
              We sent a magic link to <strong className="text-sumi">{email}</strong>.
              Click it to sign in — no password needed.
            </p>
            <button
              onClick={() => { setSent(false); setEmail(''); }}
              className="mt-6 text-sm text-indigo hover:text-indigo-dark transition-colors"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-8 shadow-card animate-slide-up">
            <h2 className="font-display text-xl text-sumi mb-1">Welcome</h2>
            <p className="text-sumi-muted text-sm mb-6">Sign in with a magic link</p>

            <label className="block mb-4">
              <span className="text-xs font-medium text-sumi-light uppercase tracking-wider">
                Email address
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="mt-1.5 w-full px-4 py-3 rounded-xl border border-cream-dark bg-cream/50
                  text-sumi placeholder:text-sumi-muted/50 text-sm
                  focus:outline-none focus:ring-2 focus:ring-indigo/20 focus:border-indigo
                  transition-all"
              />
            </label>

            {error && (
              <p className="text-vermillion text-sm mb-4">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full py-3 px-4 rounded-xl bg-indigo text-white font-medium text-sm
                hover:bg-indigo-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending...' : 'Send magic link'}
            </button>
          </form>
        )}

        <p className="text-center text-xs text-sumi-muted/60 mt-8">
          No account needed — we'll create one automatically
        </p>
      </div>
    </div>
  );
}
