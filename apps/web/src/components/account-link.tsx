import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getSession } from '@/lib/session';
import { SignOutButton } from './sign-out-button';

/**
 * Sign in, or who is signed in.
 *
 * A Server Component, so the header is right on first paint rather than
 * flickering from "sign in" to a name once JavaScript arrives. What it shows
 * comes from the session cookie, which is a hint and not a permission — every
 * page and endpoint behind it is guarded on its own.
 */
export async function AccountLink() {
  const [session, t] = await Promise.all([getSession(), getTranslations('nav')]);

  if (!session) {
    return (
      <Link href="/login" className="hover:text-ink text-ink-muted text-sm">
        {t('signIn')}
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span
        // The address rather than the name: it is what they signed in with, and
        // a name is optional at registration.
        title={session.email}
        className="text-ink-muted hidden max-w-[12ch] truncate text-sm sm:inline"
      >
        {session.email}
      </span>
      <SignOutButton label={t('signOut')} />
    </div>
  );
}
