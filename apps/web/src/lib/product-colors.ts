import type { ProductColorDto, ProductVariantDto } from '@imix/types';

/**
 * The rules tying a chosen finish to what the detail page shows.
 *
 * Kept out of the components because two of them read it — the gallery on the
 * left and the variant list on the right — and they must not each decide for
 * themselves what "Lavender is selected" means.
 */

/**
 * Which swatch is ringed when the page opens.
 *
 * The first colour that can actually be bought, so a product whose lead finish
 * is sold out does not open on a picker with nothing under it. If every colour
 * is out of stock the first one still wins: the page has to show something, and
 * "sold out" is the honest thing for it to be showing.
 */
export function initialColorId(
  colors: readonly ProductColorDto[],
  variants: readonly ProductVariantDto[],
): string | null {
  const firstInStock = colors.find((color) =>
    variants.some((variant) => variant.colorId === color.id && variant.stock > 0),
  );

  return firstInStock?.id ?? colors[0]?.id ?? null;
}

/**
 * The photographs to show for a finish.
 *
 * A colour with no images of its own falls back to the product's. That is the
 * common case in a catalogue that has one photograph per product, and it is why
 * the swatch row is safe to turn on before every finish has been shot.
 */
export function imagesForColor(
  color: ProductColorDto | undefined,
  productImages: readonly string[],
): string[] {
  return color && color.images.length > 0 ? [...color.images] : [...productImages];
}

/**
 * The variants a shopper may pick once a finish is chosen.
 *
 * A product with no colours keeps its whole list — the picker is not shown, so
 * filtering by it would silently empty the page.
 */
export function variantsForColor(
  variants: readonly ProductVariantDto[],
  colorId: string | null,
): ProductVariantDto[] {
  if (colorId === null) {
    return [...variants];
  }

  const matching = variants.filter((variant) => variant.colorId === colorId);

  // A colour no variant claims should not blank the picker. It means the data is
  // inconsistent, and showing everything is the failure a shopper can still act
  // on.
  return matching.length > 0 ? matching : [...variants];
}

/** True when the swatch row is a real choice rather than a single chip. */
export function shouldShowColorPicker(colors: readonly ProductColorDto[]): boolean {
  return colors.length > 1;
}
