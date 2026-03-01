import { useState, useEffect } from 'react';
import { X, Users, Crown, UserCheck, Eye } from 'lucide-react';
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

const roleIcons: Record<string, typeof Crown> = {
  owner: Crown,
  editor: UserCheck,
  viewer: Eye,
};

export function ShareModal({ tripId, onClose }: ShareModalProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  // Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    loadMembers();
  }, [tripId]);

  const loadMembers = async () => {
    setLoading(true);
    try {
      // Fetch members with their user profiles
      const { data } = await supabase
        .from('trip_members')
        .select('user_id, role')
        .eq('trip_id', tripId);

      if (data) {
        // Try to enrich with emails from auth — this may not work
        // depending on RLS, but we handle it gracefully
        const enriched: Member[] = [];
        for (const m of data) {
          // Get current user's email if it matches
          const { data: { user } } = await supabase.auth.getUser();
          if (user && user.id === m.user_id) {
            enriched.push({ ...m, email: user.email || undefined });
          } else {
            enriched.push(m);
          }
        }
        setMembers(enriched);
      }
    } catch {
      // Silently fail — members list is non-critical
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-sumi/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-md p-6 shadow-xl animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-xl text-sumi flex items-center gap-2">
            <Users size={20} />
            Trip Members
          </h2>
          <button onClick={onClose} className="p-1.5 text-sumi-muted hover:text-sumi rounded-lg hover:bg-cream">
            <X size={18} />
          </button>
        </div>

        {/* Current members */}
        <div className="mb-6">
          <span className="text-xs font-medium text-sumi-light uppercase tracking-wider">
            Members ({members.length})
          </span>
          <div className="mt-2 space-y-2">
            {loading ? (
              <div className="py-4 text-center">
                <p className="text-sm text-sumi-muted animate-pulse">Loading members...</p>
              </div>
            ) : members.length === 0 ? (
              <div className="py-4 text-center">
                <p className="text-sm text-sumi-muted">No members found</p>
              </div>
            ) : (
              members.map((m) => {
                const RoleIcon = roleIcons[m.role] || Eye;
                return (
                  <div key={m.user_id} className="flex items-center justify-between py-2.5 px-3 bg-cream/50 rounded-lg">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-indigo-faint flex items-center justify-center shrink-0">
                        <span className="text-xs font-medium text-indigo">
                          {(m.email || '?')[0].toUpperCase()}
                        </span>
                      </div>
                      <span className="text-sm text-sumi truncate">
                        {m.email || 'Team member'}
                      </span>
                    </div>
                    <span className="flex items-center gap-1 text-[10px] text-sumi-muted uppercase tracking-wider bg-cream px-2 py-0.5 rounded-full shrink-0">
                      <RoleIcon size={10} />
                      {m.role}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Coming soon notice */}
        <div className="bg-cream rounded-xl p-4 text-center">
          <p className="text-sm font-medium text-sumi mb-1">Invite members coming soon</p>
          <p className="text-xs text-sumi-muted leading-relaxed">
            We're working on the ability to invite travel companions by email.
            For now, trips are private to the creator.
          </p>
        </div>
      </div>
    </div>
  );
}
