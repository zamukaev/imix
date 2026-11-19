import { describe, expect, it } from 'vitest';
import { isServedAsStored } from './image-source';

describe('isServedAsStored', () => {
  it('serves an admin upload as stored, so the browser fetches it from nginx', () => {
    expect(isServedAsStored('/uploads/6f314dfc0c6d8d17.jpg')).toBe(true);
  });

  it('serves a vector as stored, whatever the case of its extension', () => {
    expect(isServedAsStored('/products/nav/iphone.svg')).toBe(true);
    expect(isServedAsStored('/products/nav/iphone.SVG')).toBe(true);
  });

  it('optimises the seeded photography that ships in public/', () => {
    expect(isServedAsStored('/products/iphone-17-pro-1.jpg')).toBe(false);
  });

  it('optimises an absolute Cloudinary URL', () => {
    expect(
      isServedAsStored('https://res.cloudinary.com/imix/image/upload/v1/banner.jpg'),
    ).toBe(false);
  });

  it('does not mistake a path that merely contains "uploads" for an upload', () => {
    expect(isServedAsStored('/products/uploads-banner.jpg')).toBe(false);
  });
});
