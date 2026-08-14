'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { uploadAsset } from '@/lib/admin-api';
import { toUserMessage } from '@/lib/api';

type ImageUploaderProps = {
  images: string[];
  onChange: (images: string[]) => void;
  disabled?: boolean;
  /** A home tile has exactly one image; a product has a gallery. */
  max?: number;
};

/**
 * Picks files, uploads them one at a time, and keeps the resulting list of URLs.
 *
 * The list is ordered and the order matters: the first image is the one the
 * catalogue grid and the cart show, so the UI says so rather than leaving an
 * admin to discover it. Reordering is a move to the front — enough for a gallery
 * of three or four, and it needs no drag-and-drop library to be usable on a
 * phone.
 */
export function ImageUploader({
  images,
  onChange,
  disabled,
  max,
}: ImageUploaderProps) {
  const t = useTranslations('admin');
  const tErrors = useTranslations('errors');
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      // Sequential rather than parallel: the failure of one upload should leave
      // the ones before it in place, and an admin adding four photographs is not
      // waiting on throughput.
      const added: string[] = [];

      for (const file of Array.from(files)) {
        const { url } = await uploadAsset(file);
        added.push(url);
      }

      // Duplicates collapse on their own: the API names a file after its
      // contents, so the same photograph twice is the same URL twice.
      const merged = [...new Set([...images, ...added])];

      // Past the cap, the newest wins — picking a file when one slot is full
      // reads as "replace it", not "that did nothing".
      onChange(max === undefined ? merged : merged.slice(-max));
    } catch (uploadError) {
      setError(toUserMessage(uploadError, tErrors('fallback')));
    } finally {
      setBusy(false);

      if (input.current) {
        // Cleared so choosing the same file again still fires a change event.
        input.current.value = '';
      }
    }
  };

  return (
    <div className="space-y-3">
      {images.length > 0 ? (
        <ul className="flex flex-wrap gap-3">
          {images.map((url, index) => (
            <li
              key={url}
              className="border-line bg-surface-alt relative w-24 overflow-hidden rounded-xl border"
            >
              <Image
                src={url}
                alt=""
                width={192}
                height={192}
                sizes="96px"
                className="h-24 w-24 object-cover"
              />
              <div className="flex items-center justify-between gap-1 px-1.5 py-1">
                <span className="text-ink-muted text-[0.625rem] leading-tight">
                  {max === 1 ? '' : index === 0 ? t('mainImage') : index + 1}
                </span>
                <div className="flex gap-1">
                  {index > 0 ? (
                    <button
                      type="button"
                      disabled={disabled || busy}
                      onClick={() =>
                        onChange([url, ...images.filter((other) => other !== url)])
                      }
                      className="text-ink-muted hover:text-ink text-[0.625rem]"
                      title={t('makeMainImage')}
                    >
                      ↑
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={disabled || busy}
                    onClick={() => onChange(images.filter((other) => other !== url))}
                    className="text-danger text-[0.625rem]"
                    aria-label={t('removeImage')}
                  >
                    ✕
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-ink-muted text-sm">{t('noImages')}</p>
      )}

      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        multiple
        hidden
        onChange={(event) => void handleFiles(event.target.files)}
      />

      <Button
        type="button"
        variant="ghost"
        disabled={disabled || busy}
        onClick={() => input.current?.click()}
      >
        {busy ? t('uploading') : t('uploadImage')}
      </Button>

      {error ? (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
