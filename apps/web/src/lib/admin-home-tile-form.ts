import type { AdminHomeTileDto, HomeTileWriteRequest } from '@imix/types';

/**
 * The home tile form's draft, and the conversion to what the API accepts.
 *
 * Kept free of React so it can be tested on its own. Every field is a string
 * here because that is what an `<input>` holds; the API's nulls are produced at
 * the boundary below.
 */
export type HomeTileDraft = {
  key: string;
  published: boolean;
  width: 'FULL' | 'HALF';
  surface: 'LIGHT' | 'WHITE' | 'DARK';
  headlineRu: string;
  headlineEn: string;
  subheadRu: string;
  subheadEn: string;
  imageUrl: string;
  imageAltRu: string;
  imageAltEn: string;
  primaryLabelRu: string;
  primaryLabelEn: string;
  primaryHref: string;
  secondaryLabelRu: string;
  secondaryLabelEn: string;
  secondaryHref: string;
};

export type HomeTileField = keyof Omit<HomeTileDraft, 'published' | 'width' | 'surface'>;

export type HomeTileFieldErrors = Partial<Record<HomeTileField, 'required'>>;

export type HomeTileDraftResult =
  | { ok: true; value: HomeTileWriteRequest }
  | { ok: false; fields: HomeTileFieldErrors };

export function emptyHomeTileDraft(): HomeTileDraft {
  return {
    key: '',
    // A new tile starts as a draft. The shop window should change when somebody
    // decides it does, not the moment they start typing.
    published: false,
    width: 'FULL',
    surface: 'LIGHT',
    headlineRu: '',
    headlineEn: '',
    subheadRu: '',
    subheadEn: '',
    imageUrl: '',
    imageAltRu: '',
    imageAltEn: '',
    primaryLabelRu: '',
    primaryLabelEn: '',
    primaryHref: '',
    secondaryLabelRu: '',
    secondaryLabelEn: '',
    secondaryHref: '',
  };
}

export function homeTileDraftFrom(tile: AdminHomeTileDto): HomeTileDraft {
  return {
    key: tile.key,
    published: tile.published,
    width: tile.width,
    surface: tile.surface,
    headlineRu: tile.headlineRu,
    headlineEn: tile.headlineEn,
    subheadRu: tile.subheadRu ?? '',
    subheadEn: tile.subheadEn ?? '',
    imageUrl: tile.imageUrl,
    imageAltRu: tile.imageAltRu ?? '',
    imageAltEn: tile.imageAltEn ?? '',
    primaryLabelRu: tile.primaryLabelRu ?? '',
    primaryLabelEn: tile.primaryLabelEn ?? '',
    primaryHref: tile.primaryHref ?? '',
    secondaryLabelRu: tile.secondaryLabelRu ?? '',
    secondaryLabelEn: tile.secondaryLabelEn ?? '',
    secondaryHref: tile.secondaryHref ?? '',
  };
}

/** The three fields of one CTA, which stand or fall together. */
const ACTION_SLOTS = ['primary', 'secondary'] as const;

/**
 * Converts a draft, refusing what the API would refuse anyway.
 *
 * Two rules, both mirrored from the server. The headlines and the image are
 * required in both languages; and an action is **all or nothing** — a label
 * without a link is a button the storefront will never render, so it is pointed
 * at here rather than saved and silently dropped.
 *
 * The href itself is not checked here: whether `/phones` is a page this shop has
 * is a question only the database can answer, and the API answers it.
 */
export function toHomeTileRequest(draft: HomeTileDraft): HomeTileDraftResult {
  const fields: HomeTileFieldErrors = {};

  for (const field of ['key', 'headlineRu', 'headlineEn', 'imageUrl'] as const) {
    if (draft[field].trim().length === 0) {
      fields[field] = 'required';
    }
  }

  for (const slot of ACTION_SLOTS) {
    const parts = [
      `${slot}LabelRu`,
      `${slot}LabelEn`,
      `${slot}Href`,
    ] as const satisfies readonly HomeTileField[];
    const filled = parts.filter((field) => draft[field].trim().length > 0);

    if (filled.length === 0 || filled.length === parts.length) {
      continue;
    }

    for (const field of parts) {
      if (draft[field].trim().length === 0) {
        fields[field] = 'required';
      }
    }
  }

  if (Object.keys(fields).length > 0) {
    return { ok: false, fields };
  }

  return {
    ok: true,
    value: {
      key: draft.key.trim().toLowerCase(),
      published: draft.published,
      width: draft.width,
      surface: draft.surface,
      headlineRu: draft.headlineRu.trim(),
      headlineEn: draft.headlineEn.trim(),
      subheadRu: blankToNull(draft.subheadRu),
      subheadEn: blankToNull(draft.subheadEn),
      imageUrl: draft.imageUrl.trim(),
      imageAltRu: blankToNull(draft.imageAltRu),
      imageAltEn: blankToNull(draft.imageAltEn),
      primaryLabelRu: blankToNull(draft.primaryLabelRu),
      primaryLabelEn: blankToNull(draft.primaryLabelEn),
      primaryHref: blankToNull(draft.primaryHref),
      secondaryLabelRu: blankToNull(draft.secondaryLabelRu),
      secondaryLabelEn: blankToNull(draft.secondaryLabelEn),
      secondaryHref: blankToNull(draft.secondaryHref),
    },
  };
}

function blankToNull(value: string): string | null {
  const trimmed = value.trim();

  return trimmed.length === 0 ? null : trimmed;
}
