import type { ReactNode } from 'react';
import { PRIVATE_PAGE } from '@/lib/seo';

/**
 * A layout that exists only to carry metadata: `cart/page.tsx` is a client
 * component, and a client component cannot export any.
 *
 * A cart is one visitor's, has nothing to rank for, and is different every time
 * it is fetched.
 */
export const metadata = PRIVATE_PAGE;

export default function CartLayout({ children }: { children: ReactNode }) {
  return children;
}
