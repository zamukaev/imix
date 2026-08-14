'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { AdminCategoryDto, AdminProductDto } from '@imix/types';
import { ImageUploader } from '@/components/admin/image-uploader';
import {
  VariantFields,
  type VariantFieldErrors,
} from '@/components/admin/variant-fields';
import { Button } from '@/components/ui/button';
import { FIELD_CLASS, Field, LEGEND_CLASS } from '@/components/ui/form-field';
import { useRouter } from '@/i18n/navigation';
import {
  addAdminVariant,
  createAdminProduct,
  deleteAdminProduct,
  deleteAdminVariant,
  updateAdminProduct,
  updateAdminVariant,
} from '@/lib/admin-api';
import {
  emptyProductDraft,
  emptyVariantDraft,
  productDraftFrom,
  toCreateProductRequest,
  toProductRequest,
  toVariantRequest,
  variantDraftFrom,
  type DraftProblem,
  type ProductDraft,
  type ProductField,
  type VariantDraft,
} from '@/lib/admin-product-form';
import { toUserMessage } from '@/lib/api';

type ProductFormProps = {
  /** The whole DTO rather than the ref: the tab picker reads `groups` off it. */
  categories: AdminCategoryDto[];
  /** Absent when creating. Its presence is what switches the form's behaviour. */
  product?: AdminProductDto;
};

type ProductFieldErrors = Partial<Record<ProductField, DraftProblem>>;

/**
 * Create and edit, in one component — they differ by how variants are saved,
 * and by nothing else worth a second file.
 *
 * **Creating** sends the product and its variants as one request: a product's
 * "from" prices are derived from its variants, so one saved without any would
 * appear in the catalogue at zero.
 *
 * **Editing** saves the product fields on their own, and each variant on its own,
 * because that is how the API models them — and because every variant change
 * moves the product's derived prices, so each answer brings the whole product
 * back and the form restates itself from it. Nothing here diffs two arrays and
 * hopes.
 */
export function ProductForm({ categories, product }: ProductFormProps) {
  const t = useTranslations('admin');
  const tValidation = useTranslations('validation');
  const tErrors = useTranslations('errors');
  const router = useRouter();

  const [draft, setDraft] = useState<ProductDraft>(() =>
    product
      ? productDraftFrom(product)
      : emptyProductDraft(categories[0]?.id ?? ''),
  );
  const [variants, setVariants] = useState<VariantDraft[]>(() =>
    product ? product.variants.map(variantDraftFrom) : [emptyVariantDraft()],
  );

  // Tabs belong to one category, so the picker follows the category select.
  const groups =
    categories.find((category) => category.id === draft.categoryId)?.groups ?? [];
  const [productErrors, setProductErrors] = useState<ProductFieldErrors>({});
  const [variantErrors, setVariantErrors] = useState<Record<number, VariantFieldErrors>>(
    {},
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const isEditing = product !== undefined;

  const patchDraft = (patch: Partial<ProductDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setNotice(null);
  };

  const patchVariant = (index: number, patch: Partial<VariantDraft>) => {
    setVariants((current) =>
      current.map((variant, at) => (at === index ? { ...variant, ...patch } : variant)),
    );
    setNotice(null);
  };

  /** Restates the whole form from an answer, so derived prices are never stale. */
  const adopt = (updated: AdminProductDto, message: string) => {
    setDraft(productDraftFrom(updated));
    setVariants(updated.variants.map(variantDraftFrom));
    setProductErrors({});
    setVariantErrors({});
    setFormError(null);
    setNotice(message);
  };

  const run = async (action: () => Promise<void>) => {
    setPending(true);
    setFormError(null);

    try {
      await action();
    } catch (error) {
      setFormError(toUserMessage(error, tErrors('fallback')));
    } finally {
      setPending(false);
    }
  };

  const submit = () =>
    run(async () => {
      if (isEditing) {
        const parsed = toProductRequest(draft);

        if (!parsed.ok) {
          setProductErrors(parsed.fields);

          return;
        }

        adopt(await updateAdminProduct(product.id, parsed.value), t('savedProduct'));

        return;
      }

      const parsed = toCreateProductRequest(draft, variants);

      if (!parsed.ok) {
        setProductErrors(parsed.fields);
        setVariantErrors(parsed.variants);

        return;
      }

      const created = await createAdminProduct(parsed.value);

      // Straight to the list: the new product is at the top of it, which is the
      // reassurance an admin is looking for after pressing Create.
      router.push('/admin/products');
      router.refresh();
      setNotice(t('createdProduct', { name: created.nameRu }));
    });

  const saveVariant = (index: number) =>
    run(async () => {
      const target = variants[index];

      if (!target) {
        return;
      }

      const parsed = toVariantRequest(target);

      if (!parsed.ok) {
        setVariantErrors({ [index]: parsed.fields });

        return;
      }

      const updated = target.id
        ? await updateAdminVariant(target.id, parsed.value)
        : await addAdminVariant(product?.id ?? '', parsed.value);

      adopt(updated, t('savedVariant'));
      router.refresh();
    });

  const removeVariant = (index: number) =>
    run(async () => {
      const target = variants[index];

      if (!target) {
        return;
      }

      // Not in the database yet — dropping the row is the whole operation.
      if (!target.id) {
        setVariants((current) => current.filter((_variant, at) => at !== index));

        return;
      }

      adopt(await deleteAdminVariant(target.id), t('deletedVariant'));
      router.refresh();
    });

  const removeProduct = () =>
    run(async () => {
      await deleteAdminProduct(product?.id ?? '');
      router.push('/admin/products');
      router.refresh();
    });

  const productMessage = (field: ProductField): string | undefined =>
    productErrors[field] === undefined ? undefined : tValidation('required');

  const textField = (
    field:
      | 'slug'
      | 'nameRu'
      | 'nameEn'
      | 'brand'
      | 'taglineRu'
      | 'taglineEn'
      | 'navImageUrl'
      | 'model3dUrl',
    label: string,
    hint?: string,
  ) => (
    <Field name={field} label={label} hint={hint} error={productMessage(field)}>
      {(props) => (
        <input
          {...props}
          type="text"
          disabled={pending}
          value={draft[field]}
          onChange={(event) => patchDraft({ [field]: event.target.value })}
          className={FIELD_CLASS}
        />
      )}
    </Field>
  );

  const textArea = (field: 'descriptionRu' | 'descriptionEn', label: string) => (
    <Field name={field} label={label} error={productMessage(field)}>
      {(props) => (
        <textarea
          {...props}
          rows={5}
          disabled={pending}
          value={draft[field]}
          onChange={(event) => patchDraft({ [field]: event.target.value })}
          className={FIELD_CLASS}
        />
      )}
    </Field>
  );

  return (
    <div className="space-y-12">
      <section>
        <h2 className={LEGEND_CLASS}>{t('productLegend')}</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          {textField('nameRu', t('nameRu'))}
          {textField('nameEn', t('nameEn'))}
          {textField('slug', t('slug'), t('slugHint'))}
          {textField('brand', t('brand'), t('brandHint'))}

          <Field
            name="categoryId"
            label={t('category')}
            error={productMessage('categoryId')}
          >
            {(props) => (
              <select
                {...props}
                disabled={pending}
                value={draft.categoryId}
                // Moving a product resets its tab: groups belong to one
                // category, and keeping the old id would be a 400 on save.
                onChange={(event) =>
                  patchDraft({ categoryId: event.target.value, groupId: '' })
                }
                className={FIELD_CLASS}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.nameRu} · {category.nameEn}
                  </option>
                ))}
              </select>
            )}
          </Field>

          {/* Only where the category has tabs — most do not. */}
          {groups.length > 0 ? (
            <Field
              name="groupId"
              label={t('group')}
              hint={t('groupHint')}
              error={productMessage('groupId')}
            >
              {(props) => (
                <select
                  {...props}
                  disabled={pending}
                  value={draft.groupId}
                  onChange={(event) => patchDraft({ groupId: event.target.value })}
                  className={FIELD_CLASS}
                >
                  <option value="">{t('groupNone')}</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.nameRu} · {group.nameEn}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          ) : null}

          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                disabled={pending}
                checked={draft.featured}
                onChange={(event) => patchDraft({ featured: event.target.checked })}
                className="border-line size-4 rounded"
              />
              {t('featured')}
            </label>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {textArea('descriptionRu', t('descriptionRu'))}
          {textArea('descriptionEn', t('descriptionEn'))}
        </div>

        {/* Optional in both languages. Left empty, the model card simply shows
            one line fewer — see `ModelCard`. */}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {textField('taglineRu', t('taglineRu'), t('taglineHint'))}
          {textField('taglineEn', t('taglineEn'), t('taglineHint'))}
        </div>
      </section>

      <section>
        <h2 className={LEGEND_CLASS}>{t('imagesLegend')}</h2>
        <ImageUploader
          images={draft.images}
          disabled={pending}
          onChange={(images) => patchDraft({ images })}
        />
        <div className="mt-4 grid max-w-3xl gap-4 sm:grid-cols-2">
          {textField('navImageUrl', t('navImageUrl'), t('navImageHint'))}
          {textField('model3dUrl', t('model3dUrl'), t('model3dHint'))}
        </div>
      </section>

      <section>
        <h2 className={LEGEND_CLASS}>{t('variantsLegend')}</h2>
        <p className="text-ink-muted mb-4 text-sm">{t('variantsNote')}</p>

        <ul className="space-y-6">
          {variants.map((variant, index) => (
            <li
              key={variant.id ?? `draft-${index}`}
              className="border-line bg-surface rounded-card border p-5"
            >
              <VariantFields
                draft={variant}
                errors={variantErrors[index] ?? {}}
                disabled={pending}
                idPrefix={variant.id ?? `new-${index}`}
                onChange={(patch) => patchVariant(index, patch)}
              />

              <div className="mt-4 flex flex-wrap items-center gap-3">
                {isEditing ? (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => void saveVariant(index)}
                  >
                    {variant.id ? t('saveVariant') : t('addVariantSave')}
                  </Button>
                ) : null}

                {variant.sold ? (
                  <span className="text-ink-muted text-xs">{t('variantSold')}</span>
                ) : (
                  <button
                    type="button"
                    disabled={pending || (!isEditing && variants.length === 1)}
                    onClick={() => void removeVariant(index)}
                    className="text-danger text-xs hover:underline disabled:opacity-40"
                  >
                    {t('removeVariant')}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>

        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={() => setVariants((current) => [...current, emptyVariantDraft()])}
          className="mt-4"
        >
          {t('addVariant')}
        </Button>
      </section>

      {formError ? (
        <p role="alert" className="text-danger text-sm">
          {formError}
        </p>
      ) : null}

      {notice ? (
        <p role="status" className="text-success text-sm">
          {notice}
        </p>
      ) : null}

      <div className="border-line flex flex-wrap items-center gap-4 border-t pt-6">
        <Button type="button" disabled={pending} onClick={() => void submit()}>
          {pending ? t('saving') : isEditing ? t('saveProduct') : t('createProduct')}
        </Button>

        {isEditing ? (
          confirmingDelete ? (
            <>
              <button
                type="button"
                disabled={pending}
                onClick={() => void removeProduct()}
                className="text-danger text-sm font-medium hover:underline"
              >
                {t('confirmDeleteProduct')}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="text-ink-muted text-sm hover:underline"
              >
                {t('cancel')}
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirmingDelete(true)}
              className="text-danger ml-auto text-sm hover:underline"
            >
              {t('deleteProduct')}
            </button>
          )
        ) : null}
      </div>
    </div>
  );
}
