import { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="fixed inset-0 bg-sumi/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl w-full max-w-xs p-5 shadow-xl animate-fade-in mx-4">
        <div className="flex items-center gap-3 mb-3">
          {destructive && (
            <div className="w-8 h-8 rounded-full bg-vermillion-faint flex items-center justify-center shrink-0">
              <AlertTriangle size={16} className="text-vermillion" />
            </div>
          )}
          <h3 className="font-display text-lg text-sumi">{title}</h3>
        </div>
        <p className="text-sm text-sumi-muted mb-5">{message}</p>
        <div className="flex gap-2">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="flex-1 py-2.5 px-4 rounded-xl border border-cream-dark text-sm font-medium
              text-sumi hover:bg-cream transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-colors
              ${destructive
                ? 'bg-vermillion text-white hover:bg-vermillion/90'
                : 'bg-indigo text-white hover:bg-indigo-dark'
              }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
