type SupabaseLikeError = {
  message?: string;
  details?: string | null;
  hint?: string | null;
  code?: string;
};

function isSupabaseLikeError(error: unknown): error is SupabaseLikeError {
  return typeof error === 'object' && error !== null && 'message' in error;
}

export function formatErrorMessage(error: unknown): string {
  if (isSupabaseLikeError(error)) {
    const message = error.message?.trim() || 'Unknown error';
    const details = error.details?.trim();
    const hint = error.hint?.trim();
    const code = error.code?.trim();

    const sections = [message];

    if (details && details !== message) {
      sections.push(`Details: ${details}`);
    }

    if (hint) {
      sections.push(`Hint: ${hint}`);
    }

    if (code) {
      sections.push(`Code: ${code}`);
    }

    return sections.join(' · ');
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Something went wrong';
}
