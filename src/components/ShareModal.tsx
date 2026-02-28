import { useState, useEffect, type FormEvent } from 'react';
import { X, UserPlus, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ShareModalProps {
  tripId: string;
  onClose: () => void;
}

interface Member {
  user_id: string;
  role: string;
  email?: string;
}

export function ShareModal({ tripId, onClose }: ShareModalProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadMembers();
  }, [tripId]);

  const loadMembers = async () => {
    const { data } = await supabase
      .from('trip_members')
      .select('user_id, role')
      .eq('trip_id', tripId);
    if (data) setMembers(data);
  };

  const handleInvite = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setMessage('');

    try {
      // Look up user by email — they must have signed in at least once
      const { data: _users } = await supabase
        .from('trip_members')
        .select('user_id')
        .eq('trip_id', tripId);

      // For simplicity, we'll use Supabase's admin user lookup via RPC
      // In practice you'd create a Supabase Edge Function for this
      // For now, share via the email invite approach

      setMessage(
        `To invite ${email}: ask them to sign into Tabi with that email first, ` +
        `then you can add them as an editor. We'll add a proper invite flow soon!`
      );

      // TODO: Implement proper invite flow via Supabase Edge Function
      // This would:
      // 1. Look up user by email in auth.users
      // 2. If found, add to trip_members
      // 3. If not found, send invite email

    } catch {
      setMessage('Something went wrong. Please try again.');
    }

    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-sumi/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-md p-6 shadow-xl animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-xl text-sumi flex items-center gap-2">
            <Users size={20} />
            Share Trip
          </h2>
          <button onClick={onClose} className="p-1.5 text-sumi-muted hover:text-sumi rounded-lg hover:bg-cream">
            <X size={18} />
          </button>
        </div>

        {/* Current members */}
        <div className="mb-4">
          <span className="text-xs font-medium text-sumi-light uppercase tracking-wider">
            Members ({members.length})
          </span>
          <div className="mt-2 space-y-2">
            {members.map((m) => (
              <div key={m.user_id} className="flex items-center justify-between py-2 px-3 bg-cream/50 rounded-lg">
                <span className="text-sm text-sumi truncate">{m.user_id.substring(0, 8)}...</span>
                <span className="text-[10px] text-sumi-muted uppercase tracking-wider bg-cream px-2 py-0.5 rounded-full">
                  {m.role}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Invite form */}
        <form onSubmit={handleInvite} className="mt-4">
          <span className="text-xs font-medium text-sumi-light uppercase tracking-wider">
            Invite by email
          </span>
          <div className="flex gap-2 mt-1.5">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="partner@example.com"
              className="flex-1 px-3 py-2 rounded-lg border border-cream-dark bg-cream/30
                text-sumi text-sm focus:outline-none focus:ring-2 focus:ring-indigo/20 focus:border-indigo"
            />
            <button
              type="submit"
              disabled={loading || !email}
              className="px-4 py-2 bg-indigo text-white rounded-lg text-sm font-medium
                hover:bg-indigo-dark transition-colors disabled:opacity-50"
            >
              <UserPlus size={16} />
            </button>
          </div>
        </form>

        {message && (
          <p className="mt-3 text-xs text-sumi-muted bg-cream p-3 rounded-lg">{message}</p>
        )}
      </div>
    </div>
  );
}
