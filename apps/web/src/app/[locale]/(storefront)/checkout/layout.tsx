import type { ReactNode } from 'react';
import { PRIVATE_PAGE } from '@/lib/seo';

/** Same reason as the cart: a client page cannot export metadata of its own. */
export const metadata = PRIVATE_PAGE;

export default function CheckoutLayout({ children }: { children: ReactNode }) {
  return children;
}
