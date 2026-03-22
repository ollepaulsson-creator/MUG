import { debounce, requestIdleCallback, viewTransition } from '@theme/utilities';

const OFFSET = 40;

/**
 * A custom element that manages a floating panel.
 */
export class FloatingPanelComponent extends HTMLElement {
  #updatePosition = async () => {
    // Wait for any view transitions to finish
    if (viewTransition.current) await viewTransition.current;

    const details = this.closest('details');
    const summary = details?.querySelector('summary');

    if (summary) {
      const summaryRect = summary.getBoundingClientRect();
      const viewportWidth = window.innerWidth;

      this.style.position = 'fixed';
      this.style.zIndex = '9999';
      this.style.top = summaryRect.bottom + 'px';
      this.style.left = 'auto';
      this.style.right = (viewportWidth - summaryRect.right) + 'px';

      // Check if panel overflows left edge and correct
      const rect = this.getBoundingClientRect();
      if (rect.left < 0) {
        this.style.right = 'auto';
        this.style.left = '0px';
      }
    } else {
      const rect = this.getBoundingClientRect();
      const viewportWidth = window.innerWidth;

      this.style.top = OFFSET + 'px';

      if (rect.right > viewportWidth) {
        const overflowAmount = rect.right - viewportWidth + OFFSET;
        this.style.left = `-${overflowAmount}px`;
      }

      if (rect.left < 0) {
        const overflowAmount = Math.abs(rect.left) + OFFSET;
        this.style.left = `${overflowAmount}px`;
      }
    }

    this.#mutationObserver.takeRecords();
  };

  #mutationObserver = new MutationObserver(this.#updatePosition);

  #resizeListener = debounce(() => {
    const parent = this.closest('details');
    const closeOnResize = this.dataset.closeOnResize === 'true';
    if (parent instanceof HTMLDetailsElement && closeOnResize) {
      parent.open = false;
      parent.removeAttribute('open');
      this.#updatePosition();
    }
  }, 100);

  connectedCallback() {
    window.addEventListener('resize', this.#resizeListener);

    requestIdleCallback(() => {
      this.#updatePosition();
      this.#mutationObserver.observe(this, { attributes: true });
    });
  }

  disconnectedCallback() {
    window.removeEventListener('resize', this.#resizeListener);
    this.#mutationObserver.disconnect();
  }
}

if (!customElements.get('floating-panel-component')) {
  customElements.define('floating-panel-component', FloatingPanelComponent);
}
