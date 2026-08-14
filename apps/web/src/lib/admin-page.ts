import type { Locale } from '@imix/types';
import type { Authorization } from './api';
import { redirectLocalised } from './redirect-localised';
import { getAccessToken } from './session';

/**
 * The token an admin Server Component needs to read from the API, or a redirect
 * to the door.
 *
 * The role itself is not checked here — the layout above every admin page has
 * already done that, and the API checks it again on the request this token is
 * about to be used for. What this guards against is the narrower case of a
 * session that aged out between the layout rendering and the page fetching.
 */
export async function requireAdminApi(locale: Locale): Promise<Authorization> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    redirectLocalised('/login', locale);
  }

  return { accessToken };
}
