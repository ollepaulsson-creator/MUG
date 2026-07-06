import { morph } from '@theme/morph';

/**
 * A class to re-render sections using the Section Rendering API
 */
class SectionRenderer {
  /**
   * The cache of section HTML
   * @type {Map<string, string>}
   */
  #cache = new Map();

  /**
   * The abort controllers by section ID
   * @type {Map<string, AbortController>}
   */
  #abortControllersBySectionId = new Map();

  /**
   * The pending promises
   * @type {Map<string, Promise<string>>}
   */
  #pendingPromises = new Map();

  constructor() {
    window.addEventListener('load', this.#cachePageSections.bind(this));
  }

  /**
   * Renders a section
   * @param {string} sectionId - The section ID
   * @param {Object} [options] - The options
   * @param {boolean} [options.cache] - Whether to use the cache
   * @param {URL} [options.url] - The URL to render the section from
   * @returns {Promise<string>} The rendered section HTML
   */
  async renderSection(sectionId, options) {
    const { cache = !Shopify.designMode } = options ?? {};
    const { url } = options ?? {};
    this.#abortPendingMorph(sectionId);

    const abortController = new AbortController();
    this.#abortControllersBySectionId.set(sectionId, abortController);

    const sectionHTML = await this.getSectionHTML(sectionId, cache, url);

    if (!abortController.signal.aborted) {
      this.#abortControllersBySectionId.delete(sectionId);

      morphSection(sectionId, sectionHTML);
    }

    return sectionHTML;
  }

  /**
   * Aborts an existing morph for a section
   * @param {string} sectionId - The section ID
   */
  #abortPendingMorph(sectionId) {
    const existingAbortController = this.#abortControllersBySectionId.get(sectionId);
    if (existingAbortController) {
      existingAbortController.abort();
    }
  }

  /**
   * Gets the HTML for a section
   * @param {string} sectionId - The section ID
   * @param {boolean} useCache - Whether to use the cache
   * @param {URL} url - The URL to render the section for
   * @returns {Promise<string>} The rendered section HTML
   */
  async getSectionHTML(sectionId, useCache = true, url = new URL(window.location.href)) {
    const sectionUrl = buildSectionRenderingURL(sectionId, url);

    let pendingPromise = this.#pendingPromises.get(sectionUrl);
    if (pendingPromise) return pendingPromise;

    if (useCache) {
      const cachedHTML = this.#cache.get(sectionUrl);

      if (cachedHTML) return cachedHTML;
    }

    pendingPromise = fetch(sectionUrl).then((response) => {
      return response.text();
    });

    this.#pendingPromises.set(sectionUrl, pendingPromise);

    const sectionHTML = await pendingPromise;
    this.#pendingPromises.delete(sectionUrl);

    this.#cache.set(sectionUrl, sectionHTML);
    return sectionHTML;
  }

  /**
   * Caches the page sections
   */
  #cachePageSections() {
    for (const section of document.querySelectorAll('.shopify-section')) {
      const url = buildSectionRenderingURL(section.id);
      if (this.#cache.get(url)) return;
      if (containsShadowRoot(section)) return;

      this.#cache.set(url, section.outerHTML);
    }
  }
}

const SECTION_ID_PREFIX = 'shopify-section-';

/**
 * Builds a section rendering URL
 * @param {string} sectionId - The section ID
 * @param {URL} url - The URL to render the section for
 * @returns {string} The section rendering URL
 */
function buildSectionRenderingURL(sectionId, url = new URL(window.location.href)) {
  url.searchParams.set('section_id', normalizeSectionId(sectionId));
  url.searchParams.sort();

  return url.toString();
}

/**
 * Builds a section selector
 * @param {string} sectionId - The section ID
 * @returns {string} The section selector
 */
export function buildSectionSelector(sectionId) {
  return `${SECTION_ID_PREFIX}${sectionId}`;
}

/**
 * Normalizes a section ID
 * @param {string} sectionId - The section ID
 * @returns {string} The normalized section ID
 */
export function normalizeSectionId(sectionId) {
  return sectionId.replace(new RegExp(`^${SECTION_ID_PREFIX}`), '');
}

/**
 * Checks if an element contains a shadow root
 * @param {Element} element - The element to check
 * @returns {boolean} Whether the element contains a shadow root
 */
function containsShadowRoot(element) {
  return !!element.shadowRoot || Array.from(element.children).some(containsShadowRoot);
}

/**
 * @typedef {(previousElement: HTMLElement, newElement: HTMLElement) => void} UpdateCallback
 */

/**
 * Morphs the existing section element with the new section contents
 *
 * @param {string} sectionId - The section ID
 * @param {string} html - The new markup the section should morph into
 */
export async function morphSection(sectionId, html) {
  const fragment = new DOMParser().parseFromString(html, 'text/html');
  const existingElement = document.getElementById(buildSectionSelector(sectionId));
  const newElement = fragment.getElementById(buildSectionSelector(sectionId));

  if (!existingElement) {
    throw new Error(`Section ${sectionId} not found`);
  }

  if (!newElement) {
    throw new Error(`Section ${sectionId} not found in the section rendering response`);
  }

  preserveFilterAccordions(existingElement, newElement);
  preserveAccordionOpenState(existingElement, newElement);
  morph(existingElement, newElement);
}

/**
 * The server never renders the `open` attribute on filter accordion
 * <details> — it is set client-side by accordion-custom on connect. When a
 * filter change morphs the section, the diff sees the attribute missing in
 * the incoming HTML and strips it, randomly collapsing groups the user had
 * open. Copy each accordion's current open state onto the incoming markup so
 * the morph preserves it (both open and user-collapsed states survive).
 *
 * @param {HTMLElement} existingElement - The current section element in the DOM
 * @param {HTMLElement} newElement - The parsed new section element (not yet in DOM)
 */
function preserveAccordionOpenState(existingElement, newElement) {
  const accordions = existingElement.querySelectorAll('accordion-custom[data-filter-param-name]');

  for (const accordion of accordions) {
    const key = accordion.getAttribute('data-filter-param-name');
    const details = accordion.querySelector('details');
    if (!key || !details) continue;

    // Scope the match to the same form so the horizontal bar and the drawer
    // (which render the same filters) don't cross-contaminate.
    const formId = accordion.closest('form')?.id;
    const scope = formId ? newElement.querySelector(`#${CSS.escape(formId)}`) : newElement;
    const target = scope?.querySelector(
      `accordion-custom[data-filter-param-name="${CSS.escape(key)}"] details`
    );
    if (!target) continue;

    if (details.open) {
      target.setAttribute('open', '');
    } else {
      target.removeAttribute('open');
    }
  }
}

/**
 * When a Shopify filter combination yields zero products, the Section Rendering API
 * returns only the price_range filter in the `filters` array — omitting list filters
 * (availability, brand, etc.). This causes morph to remove those sections from the DOM.
 *
 * We fix this by copying any missing filter accordion items from the existing DOM into
 * the new element before morphing, so they are preserved rather than removed.
 *
 * @param {HTMLElement} existingElement - The current section element in the DOM
 * @param {HTMLElement} newElement - The parsed new section element (not yet in DOM)
 */
function preserveFilterAccordions(existingElement, newElement) {
  const existingWrappers = existingElement.querySelectorAll('.facets__filters-wrapper');

  for (const existingWrapper of existingWrappers) {
    const form = existingWrapper.closest('form');
    if (!form?.id) continue;

    const newWrapper = newElement.querySelector(`#${CSS.escape(form.id)} .facets__filters-wrapper`);
    if (!newWrapper) continue;

    const existingAccordions = Array.from(
      existingWrapper.querySelectorAll(':scope > accordion-custom.facets__item')
    );
    const newAccordions = Array.from(
      newWrapper.querySelectorAll(':scope > accordion-custom.facets__item')
    );

    if (newAccordions.length >= existingAccordions.length) continue;

    // Restore missing filter accordions and re-sort to match original order.
    const getLabel = (el) => el.querySelector('.facets__label')?.textContent?.trim() ?? '';

    for (const accordion of existingAccordions) {
      const label = getLabel(accordion);
      const alreadyPresent = newAccordions.some((a) => getLabel(a) === label);
      if (!alreadyPresent) {
        newWrapper.appendChild(accordion.cloneNode(true));
      }
    }

    // Re-order to match the original sequence so morph doesn't reorder them.
    const labelOrder = existingAccordions.map(getLabel);
    Array.from(newWrapper.querySelectorAll(':scope > accordion-custom.facets__item'))
      .sort((a, b) => labelOrder.indexOf(getLabel(a)) - labelOrder.indexOf(getLabel(b)))
      .forEach((el) => newWrapper.appendChild(el));
  }
}

export const sectionRenderer = new SectionRenderer();

window.__sectionRenderer = sectionRenderer;
