import { useState, useEffect } from 'react';
import { X, Users, Crown, UserCheck, Eye, UserPlus, Trash2, Mail } from 'lucide-react';
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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);

  // Invite form state
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'editor' | 'viewer'>('editor');
  const [inviting, setInviting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const loadMembers = async () => {
    setLoading(true);
    try {
      const [{ data: memberRows, error: rpcError }, { data: authData }] = await Promise.all([
        supabase.rpc('get_trip_member_emails', { p_trip_id: tripId }),
        supabase.auth.getUser(),
      ]);

      if (rpcError) throw rpcError;

      const uid = authData.user?.id || null;
      setCurrentUserId(uid);

      const memberList: Member[] = (memberRows || []).map((row: { user_id: string; email: string; role: string }) => ({
        user_id: row.user_id,
        email: row.email,
        role: row.role,
      }));

      setMembers(memberList);
      setIsOwner(memberList.some((m) => m.user_id === uid && m.role === 'owner'));
    } catch (error) {
      console.error('loadMembers error:', error);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
  }, [tripId]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) return;

    setInviting(true);
    setMessage(null);

    try {
      const { data, error } = await supabase.rpc('invite_trip_member', {
        p_trip_id: tripId,
        p_email: trimmedEmail,
        p_role: role,
      });

      if (error) throw error;

      if (data?.error) {
        setMessage({ text: data.error, type: 'error' });
      } else {
        setMessage({ text: `Invited ${trimmedEmail} as ${role}`, type: 'success' });
        setEmail('');
        await loadMembers();
      }
    } catch (error) {
      console.error('invite error:', error);
      setMessage({ text: 'Failed to invite member. Please try again.', type: 'error' });
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (userId: string, memberEmail?: string) => {
    const label = memberEmail || 'this member';
    if (!confirm(`Remove ${label} from this trip?`)) return;

    try {
      const { data, error } = await supabase.rpc('remove_trip_member', {
        p_trip_id: tripId,
        p_user_id: userId,
      });

      if (error) throw error;

      if (data?.error) {
        setMessage({ text: data.error, type: 'error' });
      } else {
        setMessage({ text: `Removed ${label}`, type: 'success' });
        await loadMembers();
      }
    } catch (error) {
      console.error('remove error:', error);
      setMessage({ text: 'Failed to remove member.', type: 'error' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-sumi/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-md p-6 shadow-xl animate-slide-up max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-xl text-sumi flex items-center gap-2">
            <Users size={20} />
            Trip Members
          </h2>
          <button onClick={onClose} className="p-1.5 text-sumi-muted hover:text-sumi rounded-lg hover:bg-cream">
            <X size={18} />
          </button>
        </div>

        {/* Invite form (owners only) */}
        {isOwner && (
          <form onSubmit={handleInvite} className="mb-6">
            <span className="text-xs font-medium text-sumi-light uppercase tracking-wider">
              Invite by email
            </span>
            <div className="mt-2 flex gap-2">
              <div className="relative flex-1">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-sumi-muted" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo/30 focus:border-indigo bg-cream/30"
                />
              </div>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'editor' | 'viewer')}
                className="text-xs px-2 py-2.5 border border-gray-200 rounded-xl bg-cream/30 text-sumi focus:outline-none focus:ring-2 focus:ring-indigo/30"
              >
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
              <button
                type="submit"
                disabled={inviting || !email.trim()}
                className="flex items-center gap-1 px-4 py-2.5 bg-indigo text-white text-sm font-medium rounded-xl hover:bg-indigo/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
              >
                <UserPlus size={14} />
                {inviting ? '...' : 'Invite'}
              </button>
            </div>
          </form>
        )}

        {/* Status message */}
        {message && (
          <div className={`mb-4 px-3 py-2 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {message.text}
          </div>
        )}

        {/* Current members */}
        <div>
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
                const isSelf = m.user_id === currentUserId;
                const canRemove = isOwner && m.role !== 'owner';
                return (
                  <div key={m.user_id} className="flex items-center justify-between py-2.5 px-3 bg-cream/50 rounded-lg group">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-indigo-faint flex items-center justify-center shrink-0">
                        <span className="text-xs font-medium text-indigo">
                          {(m.email || '?')[0].toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm text-sumi truncate block">
                          {m.email || 'Team member'}
                          {isSelf && <span className="text-sumi-muted"> (you)</span>}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="flex items-center gap-1 text-[10px] text-sumi-muted uppercase tracking-wider bg-cream px-2 py-0.5 rounded-full">
                        <RoleIcon size={10} />
                        {m.role}
                      </span>
                      {canRemove && (
                        <button
                          onClick={() => handleRemove(m.user_id, m.email)}
                          className="p-1 text-sumi-muted hover:text-red-500 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Remove member"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
