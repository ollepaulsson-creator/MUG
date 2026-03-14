/**
 * Progressive image loading.
 * Fades out the blur-up placeholder once the full image has decoded.
 * Uses capture-phase event delegation so it catches lazy-loaded and
 * dynamically inserted images without per-element listeners.
 */
if (!window.__imgBlurUpSetup) {
  window.__imgBlurUpSetup = true;
  document.addEventListener(
    'load',
    (e) => {
      const img = e.target;
      if (!(img instanceof HTMLImageElement) || !img.dataset.mainImage) return;
      img.parentElement?.querySelector('.img-blur-up')?.classList.add('img-blur-up--done');
    },
    true
  );
}
