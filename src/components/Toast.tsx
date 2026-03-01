import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from 'react';
import { X, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { cn } from '../lib/utils';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-full max-w-sm px-4">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const icons = {
    success: <CheckCircle2 size={16} className="text-bamboo shrink-0" />,
    error: <AlertCircle size={16} className="text-vermillion shrink-0" />,
    info: <Info size={16} className="text-indigo shrink-0" />,
  };

  const bgColors = {
    success: 'bg-bamboo-faint border-bamboo/20',
    error: 'bg-vermillion-faint border-vermillion/20',
    info: 'bg-indigo-faint border-indigo/20',
  };

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-4 py-3 rounded-xl border shadow-card-hover animate-slide-up',
        bgColors[toast.type]
      )}
    >
      {icons[toast.type]}
      <span className="text-sm text-sumi flex-1">{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        className="p-0.5 text-sumi-muted hover:text-sumi shrink-0"
      >
        <X size={14} />
      </button>
    </div>
  );
}
