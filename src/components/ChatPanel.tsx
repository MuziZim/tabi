import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, Send, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatPanelProps {
  tripId: string;
  tripName: string;
}

export function ChatPanel({ tripId, tripName }: ChatPanelProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMessage: Message = { role: 'user', content: text };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      // Get the current session for auth
      const { data: { session } } = await supabase.auth.getSession();

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const tabiApiKey = import.meta.env.VITE_TABI_API_KEY;

      const res = await fetch(`${supabaseUrl}/functions/v1/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(tabiApiKey
            ? { 'x-api-key': tabiApiKey }
            : { 'Authorization': `Bearer ${session?.access_token || ''}` }),
        },
        body: JSON.stringify({
          messages: newMessages,
          trip_id: tripId,
        }),
      });

      if (!res.ok) {
        throw new Error(`Request failed: ${res.status}`);
      }

      const data = await res.json();

      if (data.reply) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: data.reply },
        ]);
      } else if (data.error) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `Something went wrong: ${data.error}` },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Couldn't reach the assistant. ${err instanceof Error ? err.message : ''}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-30 bg-indigo text-white p-3.5 rounded-full shadow-lg
          hover:bg-indigo-dark active:scale-95 transition-all"
        title="Chat with AI assistant"
      >
        <MessageCircle size={22} />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-30 sm:inset-auto sm:bottom-6 sm:right-6 sm:w-96 sm:h-[32rem]
      flex flex-col bg-white sm:rounded-2xl sm:shadow-2xl sm:border sm:border-cream-dark overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-cream-dark bg-cream/50">
        <div className="flex items-center gap-2">
          <MessageCircle size={16} className="text-indigo" />
          <span className="font-display text-sm text-sumi">Tabi AI</span>
          <span className="text-[10px] text-sumi-muted bg-cream-dark px-1.5 py-0.5 rounded-full">
            beta
          </span>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="p-1.5 text-sumi-muted hover:text-sumi rounded-lg hover:bg-cream transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8 text-sumi-muted/60">
            <div className="text-2xl mb-2">✨</div>
            <p className="text-sm mb-1">Hi! I can help plan your trip.</p>
            <p className="text-xs text-sumi-muted/40">
              Try "Add a ramen lunch on day 3" or "What's planned for tomorrow?"
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap
                ${msg.role === 'user'
                  ? 'bg-indigo text-white rounded-br-md'
                  : 'bg-cream text-sumi rounded-bl-md'
                }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-cream text-sumi-muted px-3 py-2 rounded-2xl rounded-bl-md">
              <Loader2 size={16} className="animate-spin" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-cream-dark p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Ask about ${tripName}...`}
            disabled={loading}
            className="flex-1 bg-cream rounded-xl px-3 py-2 text-sm text-sumi placeholder:text-sumi-muted/40
              focus:outline-none focus:ring-2 focus:ring-indigo/20 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="p-2 text-indigo hover:bg-cream rounded-xl transition-colors
              disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
