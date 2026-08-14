import type {
  AdminProductDto,
  AdminVariantDto,
  CreateProductRequest,
  ProductWriteRequest,
  VariantWriteRequest,
} from '@imix/types';
import { formatMoneyInput, parseMoneyInput } from './money-input';

/**
 * The product form's drafts, and the conversion to what the API accepts.
 *
 * Kept free of React so it can be tested on its own — the same split as
 * `checkout.ts`. Every field is a string here, because that is what an `<input>`
 * holds; the API's integers and nulls are produced at the boundary below.
 *
 * Validation here duplicates the API's, on purpose and in one direction only: it
 * exists so a missing English label is pointed at *in the field* instead of
 * coming back as a sentence about a request. The API is still the one that
 * decides, and it checks everything again.
 */
export type VariantDraft = {
  /** Absent until the variant exists in the database. */
  id?: string;
  sku: string;
  labelRu: string;
  labelEn: string;
  color: string;
  config: string;
  /** Major units as typed — roubles, not kopecks. */
  priceRub: string;
  priceUsd: string;
  stock: string;
  /** Ordered at least once, so it may be edited but not deleted. */
  sold?: boolean;
};

export type ProductDraft = {
  slug: string;
  nameRu: string;
  nameEn: string;
  descriptionRu: string;
  descriptionEn: string;
  /** Optional, unlike the name and the description — see `WriteProductDto`. */
  taglineRu: string;
  taglineEn: string;
  brand: string;
  categoryId: string;
  /** Empty when the category has no tabs, or the model is filed under none. */
  groupId: string;
  images: string[];
  navImageUrl: string;
  model3dUrl: string;
  featured: boolean;
};

export type VariantField = keyof Omit<VariantDraft, 'id' | 'sold'>;
export type ProductField = keyof Omit<ProductDraft, 'images' | 'featured'>;

export type DraftResult<TValue, TField extends string> =
  | { ok: true; value: TValue }
  | { ok: false; fields: Partial<Record<TField, DraftProblem>> };

/**
 * What is wrong with a field, as a code rather than a sentence: the messages are
 * translated and this module has no locale.
 */
export type DraftProblem = 'required' | 'amount';

/** iMIX resells one manufacturer today; pre-filling it saves typing it every time. */
const DEFAULT_BRAND = 'Apple';

export function emptyVariantDraft(): VariantDraft {
  return {
    sku: '',
    labelRu: '',
    labelEn: '',
    color: '',
    config: '',
    priceRub: '',
    priceUsd: '',
    stock: '0',
  };
}

export function variantDraftFrom(variant: AdminVariantDto): VariantDraft {
  return {
    id: variant.id,
    sku: variant.sku,
    labelRu: variant.labelRu,
    labelEn: variant.labelEn,
    color: variant.color ?? '',
    config: variant.config ?? '',
    priceRub: formatMoneyInput(variant.priceRub),
    priceUsd: formatMoneyInput(variant.priceUsd),
    stock: String(variant.stock),
    sold: variant.sold,
  };
}

export function emptyProductDraft(categoryId: string): ProductDraft {
  return {
    slug: '',
    nameRu: '',
    nameEn: '',
    descriptionRu: '',
    descriptionEn: '',
    taglineRu: '',
    taglineEn: '',
    brand: DEFAULT_BRAND,
    categoryId,
    groupId: '',
    images: [],
    navImageUrl: '',
    model3dUrl: '',
    featured: false,
  };
}

export function productDraftFrom(product: AdminProductDto): ProductDraft {
  return {
    slug: product.slug,
    nameRu: product.nameRu,
    nameEn: product.nameEn,
    descriptionRu: product.descriptionRu,
    descriptionEn: product.descriptionEn,
    taglineRu: product.taglineRu ?? '',
    taglineEn: product.taglineEn ?? '',
    brand: product.brand,
    categoryId: product.category.id,
    groupId: product.groupId ?? '',
    images: product.images,
    navImageUrl: product.navImageUrl ?? '',
    model3dUrl: product.model3dUrl ?? '',
    featured: product.featured,
  };
}

/**
 * A variant, ready to send.
 *
 * Both labels and both prices are required — that is the rule this whole slice
 * exists to hold. An empty colour or config becomes `null`: "not set" and "set
 * to nothing" are different things, and only one of them is representable in the
 * database.
 */
export function toVariantRequest(
  draft: VariantDraft,
): DraftResult<VariantWriteRequest, VariantField> {
  const fields: Partial<Record<VariantField, DraftProblem>> = {};

  for (const field of ['sku', 'labelRu', 'labelEn'] as const) {
    if (draft[field].trim().length === 0) {
      fields[field] = 'required';
    }
  }

  const priceRub = parseMoneyInput(draft.priceRub);
  const priceUsd = parseMoneyInput(draft.priceUsd);
  const stock = parseCount(draft.stock);

  if (priceRub === null) fields.priceRub = draft.priceRub.trim() ? 'amount' : 'required';
  if (priceUsd === null) fields.priceUsd = draft.priceUsd.trim() ? 'amount' : 'required';
  if (stock === null) fields.stock = 'amount';

  if (priceRub === null || priceUsd === null || stock === null || hasAny(fields)) {
    return { ok: false, fields };
  }

  return {
    ok: true,
    value: {
      sku: draft.sku.trim().toUpperCase(),
      labelRu: draft.labelRu.trim(),
      labelEn: draft.labelEn.trim(),
      color: blankToNull(draft.color),
      config: blankToNull(draft.config),
      priceRub,
      priceUsd,
      stock,
    },
  };
}

export function toProductRequest(
  draft: ProductDraft,
): DraftResult<ProductWriteRequest, ProductField> {
  const fields: Partial<Record<ProductField, DraftProblem>> = {};

  for (const field of [
    'slug',
    'nameRu',
    'nameEn',
    'descriptionRu',
    'descriptionEn',
    'brand',
    'categoryId',
  ] as const) {
    if (draft[field].trim().length === 0) {
      fields[field] = 'required';
    }
  }

  if (hasAny(fields)) {
    return { ok: false, fields };
  }

  return {
    ok: true,
    value: {
      slug: draft.slug.trim().toLowerCase(),
      nameRu: draft.nameRu.trim(),
      nameEn: draft.nameEn.trim(),
      descriptionRu: draft.descriptionRu.trim(),
      descriptionEn: draft.descriptionEn.trim(),
      taglineRu: blankToNull(draft.taglineRu),
      taglineEn: blankToNull(draft.taglineEn),
      brand: draft.brand.trim(),
      categoryId: draft.categoryId,
      groupId: blankToNull(draft.groupId),
      images: draft.images,
      navImageUrl: blankToNull(draft.navImageUrl),
      model3dUrl: blankToNull(draft.model3dUrl),
      featured: draft.featured,
    },
  };
}

/**
 * The whole thing, for creating. The variants come with the product because its
 * prices are derived from them — see `CreateProductRequest`.
 *
 * Variant problems come back indexed, so the form can point at the third row
 * rather than saying "a variant is wrong".
 */
export function toCreateProductRequest(
  draft: ProductDraft,
  variants: readonly VariantDraft[],
):
  | { ok: true; value: CreateProductRequest }
  | {
      ok: false;
      fields: Partial<Record<ProductField, DraftProblem>>;
      variants: Record<number, Partial<Record<VariantField, DraftProblem>>>;
    } {
  const product = toProductRequest(draft);
  const variantFields: Record<number, Partial<Record<VariantField, DraftProblem>>> = {};
  const converted: VariantWriteRequest[] = [];

  variants.forEach((variant, index) => {
    const result = toVariantRequest(variant);

    if (result.ok) {
      converted.push(result.value);
    } else {
      variantFields[index] = result.fields;
    }
  });

  if (!product.ok || Object.keys(variantFields).length > 0) {
    return {
      ok: false,
      fields: product.ok ? {} : product.fields,
      variants: variantFields,
    };
  }

  return { ok: true, value: { ...product.value, variants: converted } };
}

/** A whole, non-negative count. Blank reads as zero — an empty stock is none. */
function parseCount(input: string): number | null {
  const trimmed = input.trim();

  if (trimmed.length === 0) {
    return 0;
  }

  return /^\d+$/.test(trimmed) ? Number(trimmed) : null;
}

function blankToNull(value: string): string | null {
  const trimmed = value.trim();

  return trimmed.length === 0 ? null : trimmed;
}

function hasAny(fields: Record<string, unknown>): boolean {
  return Object.keys(fields).length > 0;
}
