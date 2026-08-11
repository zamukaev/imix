'use client';

import { useTransition } from 'react';
import { useRouter } from '@/i18n/navigation';

/**
 * Ends the session.
 *
 * A button rather than a link: signing out changes state, and a GET that logs
 * somebody out can be triggered by a prefetch or an image tag. The label is
 * passed in so the enclosing Server Component keeps ownership of the
 * translation.
 */
export function SignOutButton({ label }: { label: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const signOut = () => {
    startTransition(async () => {
      await fetch('/api/auth/logout', { method: 'POST' });
      // The cookie is gone; `refresh` is what makes the Server Components
      // notice, and `push` gets the shopper off any page that assumed a session.
      router.push('/');
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={isPending}
      className="hover:text-ink text-ink-muted text-sm disabled:opacity-50"
    >
      {label}
    </button>
  );
}
