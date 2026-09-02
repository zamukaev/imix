import { describe, expect, it } from 'vitest';
import { planProductMedia, shouldShowModeSwitcher } from './product-media';

describe('planProductMedia', () => {
  it('offers photos only when the product has no model', () => {
    const plan = planProductMedia({ images: ['/a.jpg', '/b.jpg'], model3dUrl: null });

    expect(plan.modes).toEqual(['photo']);
    expect(plan.initialMode).toBe('photo');
    expect(shouldShowModeSwitcher(plan)).toBe(false);
  });

  it('offers both, opening on the photo, when the product has a model', () => {
    const plan = planProductMedia({
      images: ['/a.jpg'],
      model3dUrl: '/models/placeholder-phone.glb',
    });

    expect(plan.modes).toEqual(['photo', 'model']);
    expect(plan.initialMode).toBe('photo');
    expect(shouldShowModeSwitcher(plan)).toBe(true);
  });

  it('leads with the model only when there is no photo to lead with', () => {
    const plan = planProductMedia({ images: [], model3dUrl: '/models/x.glb' });

    expect(plan.modes).toEqual(['model']);
    expect(plan.initialMode).toBe('model');
    expect(shouldShowModeSwitcher(plan)).toBe(false);
  });

  it('treats a whitespace-only model url as no model', () => {
    const plan = planProductMedia({ images: ['/a.jpg'], model3dUrl: '   ' });

    expect(plan.modes).toEqual(['photo']);
    expect(plan.modelUrl).toBeNull();
  });

  it('trims the model url it hands to the loader', () => {
    const plan = planProductMedia({ images: [], model3dUrl: ' /models/x.glb ' });

    expect(plan.modelUrl).toBe('/models/x.glb');
  });

  it('has nothing to show, and no switcher, for a product with neither', () => {
    const plan = planProductMedia({ images: [], model3dUrl: null });

    expect(plan.modes).toEqual([]);
    expect(plan.posterImage).toBeNull();
    expect(plan.modelUrl).toBeNull();
    expect(shouldShowModeSwitcher(plan)).toBe(false);
  });

  it('falls back to the photo well, not a dead canvas, when there is nothing', () => {
    // The empty gallery renders a blank well; the viewer would have no url to
    // load. So a product with neither must never open on the model.
    expect(planProductMedia({ images: [], model3dUrl: null }).initialMode).toBe('photo');
  });

  it('posters the canvas with the first image', () => {
    const plan = planProductMedia({
      images: ['/first.jpg', '/second.jpg'],
      model3dUrl: '/models/x.glb',
    });

    expect(plan.posterImage).toBe('/first.jpg');
  });
});
