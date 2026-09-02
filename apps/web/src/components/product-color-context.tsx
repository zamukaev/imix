'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { ProductColorDto, ProductVariantDto } from '@imix/types';
import { initialColorId } from '@/lib/product-colors';

/**
 * The chosen finish, shared by the two halves of the detail page.
 *
 * The gallery is in the left column and the variant picker in the right, and a
 * colour has to move both — so the state cannot live in either. A provider
 * rather than a store because it is scoped to one page and dies with it; a
 * Zustand store would outlive the product and hand the next one a colour id
 * belonging to the last.
 *
 * The provider is a Client Component that takes `children`, so the page around
 * it stays server-rendered: only the two pickers become client code, not the
 * description and the price.
 */
type ProductColorState = {
  colors: readonly ProductColorDto[];
  selectedId: string | null;
  selected: ProductColorDto | undefined;
  select: (colorId: string) => void;
};

const ProductColorContext = createContext<ProductColorState | null>(null);

export function ProductColorProvider({
  colors,
  variants,
  children,
}: {
  colors: readonly ProductColorDto[];
  variants: readonly ProductVariantDto[];
  children: ReactNode;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    initialColorId(colors, variants),
  );

  const value = useMemo<ProductColorState>(
    () => ({
      colors,
      selectedId,
      selected: colors.find((color) => color.id === selectedId),
      select: setSelectedId,
    }),
    [colors, selectedId],
  );

  return (
    <ProductColorContext.Provider value={value}>{children}</ProductColorContext.Provider>
  );
}

/**
 * Reads the chosen finish.
 *
 * Throws outside a provider rather than returning a null-shaped default: a
 * gallery that silently showed the wrong photographs would be a much quieter
 * bug than one that fails on the first render.
 */
export function useProductColor(): ProductColorState {
  const value = useContext(ProductColorContext);

  if (value === null) {
    throw new Error('useProductColor must be used inside a ProductColorProvider');
  }

  return value;
}
