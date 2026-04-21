import { Component } from '@theme/component';
import { debounce, onAnimationEnd, prefersReducedMotion, onDocumentLoaded } from '@theme/utilities';
import { sectionRenderer } from '@theme/section-renderer';
import { morph } from '@theme/morph';
import { RecentlyViewed } from '@theme/recently-viewed-products';
import { RecentSearches } from '@theme/recent-searches';
import { DialogCloseEvent, DialogComponent } from '@theme/dialog';

/**
 * A custom element that allows the user to search for resources available on the store.
 *
 * @typedef {object} Refs
 * @property {HTMLInputElement} searchInput - The search input element.
 * @property {HTMLElement} predictiveSearchResults - The predictive search results container.
 * @property {HTMLElement} resetButton - The reset button element.
 * @property {HTMLElement[]} [resultsItems] - The search results items elements.
 * @property {HTMLElement} [recentlyViewedWrapper] - The recently viewed products wrapper.
 * @property {HTMLElement[]} [recentlyViewedTitle] - The recently viewed title elements.
 * @property {HTMLElement[]} [recentlyViewedItems] - The recently viewed product items.
 * @extends {Component<Refs>}
 */
class PredictiveSearchComponent extends Component {
  requiredRefs = ['searchInput', 'predictiveSearchResults', 'resetButton'];

  #controller = new AbortController();

  /**
   * @type {AbortController | null}
   */
  #activeFetch = null;

  /**
   * Get the dialog component.
   * @returns {DialogComponent | null} The dialog component.
   */
  get dialog() {
    return this.closest('dialog-component');
  }

  connectedCallback() {
    super.connectedCallback();

    const { dialog } = this;
    const { signal } = this.#controller;

    if (this.refs.searchInput.value.length > 0) {
      this.#showResetButton();
    }

    if (dialog) {
      document.addEventListener('keydown', this.#handleKeyboardShortcut, { signal });
      dialog.addEventListener(DialogCloseEvent.eventName, this.#handleDialogClose, { signal });

      this.addEventListener('click', this.#handleModalClick, { signal });
    }

    // Registered outside if(dialog) so it works in all contexts
    this.addEventListener('click', this.#handleSuggestionClick, { signal });

    onDocumentLoaded(() => {
      this.resetSearch(false); // Pass false to avoid focusing the input
    });
  }

  /**
   * Handles clicks within the predictive search modal to maintain focus on the input
   * @param {MouseEvent} event - The mouse event
   */
  #handleModalClick = (event) => {
    const target = /** @type {HTMLElement} */ (event.target);
    const isInteractiveElement =
      target instanceof HTMLButtonElement ||
      target instanceof HTMLAnchorElement ||
      target instanceof HTMLInputElement ||
      target.closest('button') ||
      target.closest('a') ||
      target.closest('input');

    if (!isInteractiveElement && this.refs.searchInput) {
      this.refs.searchInput.focus();
    }
  };

  /**
   * Records a search term when a suggestion link is clicked.
   * @param {MouseEvent} event
   */
  #handleSuggestionClick = (event) => {
    const link = /** @type {HTMLElement} */ (event.target).closest('#search-suggestions a');
    if (!link) return;
    // Read the text node directly (first child) to avoid including the label span text
    const term = link.firstChild?.textContent?.trim();
    if (term) RecentSearches.addSearch(term);
  };

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#controller.abort();
  }

  /**
   * Handles the CMD+K key combination.
   * @param {KeyboardEvent} event - The keyboard event.
   */
  #handleKeyboardShortcut = (event) => {
    if (event.metaKey && event.key === 'k') {
      this.dialog?.toggleDialog();
    }
  };

  /**
   * Handles the dialog close event.
   */
  #handleDialogClose = () => {
    this.#resetSearch();
    
  };

  get #allResultsItems() {
    const containers = Array.from(
      this.querySelectorAll(
        '.predictive-search-results__wrapper-products, ' +
          '.predictive-search-results__list'
      )
    );

    const allItems = containers
      .flatMap((container) => {
        if (container.classList.contains('predictive-search-results__wrapper-products')) {
          return Array.from(container.querySelectorAll('.predictive-search-results__card'));
        }
        return Array.from(container.querySelectorAll('[ref="resultsItems[]"], .predictive-search-results__card'));
      })
      .filter((item) => item instanceof HTMLElement);

    return /** @type {HTMLElement[]} */ (allItems);
  }

  /**
   * Track whether the last interaction was keyboard-based
   * @type {boolean}
   */
  #isKeyboardNavigation = false;

  get #currentIndex() {
    return this.#allResultsItems?.findIndex((item) => item.getAttribute('aria-selected') === 'true') ?? -1;
  }

  set #currentIndex(index) {
    if (!this.#allResultsItems?.length) return;

    this.#allResultsItems.forEach((item) => {
      item.classList.remove('keyboard-focus');
    });

    for (const [itemIndex, item] of this.#allResultsItems.entries()) {
      if (itemIndex === index) {
        item.setAttribute('aria-selected', 'true');

        if (this.#isKeyboardNavigation) {
          item.classList.add('keyboard-focus');
        }
        item.scrollIntoView({ behavior: prefersReducedMotion() ? 'instant' : 'smooth', block: 'nearest' });
      } else {
        item.removeAttribute('aria-selected');
      }
    }
    this.refs.searchInput.focus();
  }

  get #currentItem() {
    return this.#allResultsItems?.[this.#currentIndex];
  }

  /**
   * Navigate through the predictive search results using arrow keys or close them with the Escape key.
   * @param {KeyboardEvent} event - The keyboard event.
   */
  onSearchKeyDown = (event) => {
    if (event.key === 'Escape') {
      this.#resetSearch();
      return;
    }

    if (!this.#allResultsItems?.length || event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      return;
    }

    const currentIndex = this.#currentIndex;
    const totalItems = this.#allResultsItems.length;

    switch (event.key) {
      case 'ArrowDown':
        this.#isKeyboardNavigation = true;
        event.preventDefault();
        this.#currentIndex = currentIndex < totalItems - 1 ? currentIndex + 1 : 0;
        break;

      case 'Tab':
        if (event.shiftKey) {
          this.#isKeyboardNavigation = true;
          event.preventDefault();
          this.#currentIndex = currentIndex > 0 ? currentIndex - 1 : totalItems - 1;
        } else {
          this.#isKeyboardNavigation = true;
          event.preventDefault();
          this.#currentIndex = currentIndex < totalItems - 1 ? currentIndex + 1 : 0;
        }
        break;

      case 'ArrowUp':
        this.#isKeyboardNavigation = true;
        event.preventDefault();
        this.#currentIndex = currentIndex > 0 ? currentIndex - 1 : totalItems - 1;
        break;

      case 'Enter': {
        const singleResultContainer = this.refs.predictiveSearchResults.querySelector('[data-single-result-url]');
        if (singleResultContainer instanceof HTMLElement && singleResultContainer.dataset.singleResultUrl) {
          event.preventDefault();
          window.location.href = singleResultContainer.dataset.singleResultUrl;
          return;
        }

        if (this.#currentIndex >= 0) {
          event.preventDefault();
          this.#currentItem?.querySelector('a')?.click();
        } else {
          const term = this.refs.searchInput.value.trim();
          if (term) RecentSearches.addSearch(term);
          const searchUrl = new URL(Theme.routes.search_url, location.origin);
          searchUrl.searchParams.set('q', term);
          window.location.href = searchUrl.toString();
        }
        break;
      }
    }
  };

  /**
   * Clears the recently viewed products.
   * @param {Event} event - The event.
   */
  clearRecentlyViewedProducts(event) {
    event.stopPropagation();

    RecentlyViewed.clearProducts();

    const { recentlyViewedItems, recentlyViewedTitle, recentlyViewedWrapper } = this.refs;

    const allRecentlyViewedElements = [...(recentlyViewedItems || []), ...(recentlyViewedTitle || [])];

    if (allRecentlyViewedElements.length === 0) {
      return;
    }

    if (recentlyViewedWrapper) {
      recentlyViewedWrapper.classList.add('removing');

      onAnimationEnd(recentlyViewedWrapper, () => {
        recentlyViewedWrapper.remove();
      });
    }
  }

  /**
   * Reset the search state.
   * @param {boolean} [keepFocus=true] - Whether to keep focus on input after reset
   */
  resetSearch = debounce((keepFocus = true) => {
    if (keepFocus) {
      this.refs.searchInput.focus();
    }
    this.#resetSearch();
  }, 100);

  /**
   * Debounce the search handler to fetch and display search results based on the input value.
   * Reset the current selection index and close results if the search term is empty.
   */
  search = debounce((event) => {
    // If the input is not a text input (like using the Escape key), don't search
    if (!event.inputType) return;

    const searchTerm = this.refs.searchInput.value.trim();
    this.#currentIndex = -1;

    if (!searchTerm.length) {
      this.#resetSearch();
      return;
    }

    this.#showResetButton();
    this.#getSearchResults(searchTerm);
  }, 200);

  /**
   * Resets scroll positions for search results containers
   */
  #resetScrollPositions() {
    requestAnimationFrame(() => {
      const resultsInner = this.refs.predictiveSearchResults.querySelector('.predictive-search-results__inner');
      if (resultsInner instanceof HTMLElement) {
        resultsInner.scrollTop = 0;
      }

      const formContent = this.querySelector('.predictive-search-form__content');
      if (formContent instanceof HTMLElement) {
        formContent.scrollTop = 0;
      }

      // Content-wrapper is now the scroll container after the flex layout refactor
      const contentWrapper = this.querySelector('.predictive-search-form__content-wrapper');
      if (contentWrapper instanceof HTMLElement) {
        contentWrapper.scrollTop = 0;
      }
    });
  }

  /**
   * Fetch search results using the section renderer and update the results container.
   * @param {string} searchTerm - The term to search for
   */
  async #getSearchResults(searchTerm) {
    if (!this.dataset.sectionId) return;

    const url = new URL(Theme.routes.predictive_search_url, location.origin);
    url.searchParams.set('q', searchTerm);
    url.searchParams.set('resources[limit_scope]', 'each');
    url.searchParams.set('resources[limit]', '9');

    const { predictiveSearchResults } = this.refs;

    const abortController = this.#createAbortController();

    this.dataset.searchActive = 'true';
    sectionRenderer
      .getSectionHTML(this.dataset.sectionId, false, url)
      .then((resultsMarkup) => {
        if (!resultsMarkup || abortController.signal.aborted) return;
        morph(predictiveSearchResults, resultsMarkup);
        this.#updateFooter();
        // ↓↓↓ Cap total text suggestions to 4 across all groups
        this.#limitTextSuggestions();
        this.#resetScrollPositions();
      })
      .catch((error) => {
        if (abortController.signal.aborted) return;
        throw error;
      });
  }

  /**
   * Fetch the markup for the recently viewed products.
   * @returns {Promise<string | null>} The markup for the recently viewed products.
   */
  async #getRecentlyViewedProductsMarkup() {
    if (!this.dataset.sectionId) return null;

    const viewedProducts = RecentlyViewed.getProducts();
    if (viewedProducts.length === 0) return null;

    const url = new URL(Theme.routes.search_url, location.origin);
    url.searchParams.set('q', viewedProducts.map((id) => `id:${id}`).join(' OR '));
    url.searchParams.set('resources[type]', 'product');
    // url.searchParams.set('resources[limit]', '4'); // this is for recently viewed (product), safe to keep
    url.searchParams.set('resources[limit]', '24');

    return sectionRenderer.getSectionHTML(this.dataset.sectionId, false, url);
  }

  #hideResetButton() {
    const { resetButton } = this.refs;

    resetButton.hidden = true;
  }

  #showResetButton() {
    const { resetButton } = this.refs;

    resetButton.hidden = false;
  }

  #createAbortController() {
    const abortController = new AbortController();
    if (this.#activeFetch) {
      this.#activeFetch.abort();
    }
    this.#activeFetch = abortController;
    return abortController;
  }

  #resetSearch = async () => {
    const { predictiveSearchResults, searchInput } = this.refs;
    const emptySectionId = 'predictive-search-empty';

    this.#currentIndex = -1;
    searchInput.value = '';
    this.#hideResetButton();
    delete this.dataset.searchActive;

    const abortController = this.#createAbortController();
    const url = new URL(window.location.href);
    url.searchParams.delete('page');

    const emptySectionMarkup = await sectionRenderer.getSectionHTML(emptySectionId, false, url);
    const parsedEmptySectionMarkup = new DOMParser()
      .parseFromString(emptySectionMarkup, 'text/html')
      .querySelector('.predictive-search-empty-section');

    if (!parsedEmptySectionMarkup) throw new Error('No empty section markup found');

    /** This needs to be awaited and not .then so the DOM is already morphed
     * when #closeResults is called and therefore the height is animated */
    const viewedProducts = RecentlyViewed.getProducts();

    if (viewedProducts.length > 0) {
      const recentlyViewedMarkup = await this.#getRecentlyViewedProductsMarkup();
      const parsedRecentlyViewedMarkup = recentlyViewedMarkup
        ? new DOMParser().parseFromString(recentlyViewedMarkup, 'text/html')
        : null;
      const recentlyViewedProductsHtml = parsedRecentlyViewedMarkup?.getElementById('predictive-search-products') ?? null;

      if (recentlyViewedProductsHtml) {
        for (const child of recentlyViewedProductsHtml.children) {
          if (child instanceof HTMLElement) {
            child.setAttribute('ref', 'recentlyViewedWrapper');
          }
        }

        const collectionElement = parsedEmptySectionMarkup.querySelector('#predictive-search-products');
        if (collectionElement) {
          collectionElement.prepend(...recentlyViewedProductsHtml.children);

          const allChildren = Array.from(collectionElement.children);
          const recentlyViewedChildren = allChildren.filter(el => el.getAttribute('ref') === 'recentlyViewedWrapper');
          let recentlyViewedUl = recentlyViewedChildren.find(el => el.tagName === 'UL');
          if (!recentlyViewedUl) {
            for (const el of recentlyViewedChildren) {
              recentlyViewedUl = el.querySelector('ul');
              if (recentlyViewedUl) break;
            }
          }
          const count = recentlyViewedUl ? recentlyViewedUl.children.length : 0;
          const rounded = Math.floor(count / 4) * 4;
          if (rounded >= 4) {
            Array.from(recentlyViewedUl.children).slice(rounded).forEach(el => el.remove());
            allChildren
              .filter(el => el.getAttribute('ref') !== 'recentlyViewedWrapper')
              .forEach(el => el.remove());
          } else {
            recentlyViewedChildren.forEach(el => el.remove());
          }
        }
      }
    }

    // Update persistent suggestions list with recent searches if history exists.
    const recentSearches = RecentSearches.getSearches();
    const suggestionsEl = /** @type {HTMLElement | null} */ (this.querySelector('#search-suggestions'));
    if (suggestionsEl && recentSearches.length > 0) {
      suggestionsEl.innerHTML = recentSearches
        .map(
          (term) =>
            `<li><a href="${Theme.routes.search_url}?q=${encodeURIComponent(term)}&type=product">${term}<span class="search-suggestions__label">Senaste</span></a></li>`
        )
        .join('');
    }

    if (abortController.signal.aborted) return;

    morph(predictiveSearchResults, parsedEmptySectionMarkup);
    this.#updateFooter();
    // In empty state there may be no text groups, but safe to run:
    this.#limitTextSuggestions();
    this.#resetScrollPositions();
  };

  /**
   * Enforce a 4-product limit after predictive search renders
   * (unused now; left here in case you bring product limits back)
   */
  // #limitDisplayedProducts() {
  //   const container = this.refs.predictiveSearchResults;
  //   if (!container) return;

  //   const productCards = container.querySelectorAll('.predictive-search-results__card');
  //   productCards.forEach((card, index) => {
  //     if (index >= 4) card.remove();
  //   });
  // }

  /**
   * Update the persistent footer button text and href based on current results.
   */
  #updateFooter() {
    const footer = this.querySelector('.predictive-search-form__footer');
    if (!footer) return;
    const link = /** @type {HTMLAnchorElement | null} */ (footer.querySelector('.predictive-search__search-button'));
    if (!link) return;

    const resultsEl = this.refs.predictiveSearchResults.querySelector('#predictive-search-results');
    const terms = resultsEl?.dataset.searchTerms ?? '';

    if (terms) {
      link.href = `${Theme.routes.search_url}?q=${terms}&type=product`;
      link.textContent = 'VISA ALLA RESULTAT';
    } else {
      link.href = `${Theme.routes.search_url}?type=product`;
      link.textContent = 'VISA ALLA PRODUKTER';
    }
  }

  #limitDisplayedProducts() {
  const container = this.refs.predictiveSearchResults;
  if (!container) return;

  const MAX = 24;
  // only look at product lists
  const productLists = container.querySelectorAll('.predictive-search-results__wrapper-products');
  productLists.forEach((ul) => {
    const cards = ul.querySelectorAll('.predictive-search-results__card');
    cards.forEach((card, index) => {
      if (index >= MAX) card.remove();
    });
  });
}

  /**
   * NEW: Limit ALL text suggestions (queries + pages + collections + articles) to a global cap (default 4).
   * Products are ignored.
   */
  #limitTextSuggestions() {
    const container = this.refs.predictiveSearchResults;
    if (!container) return;

    // configurable via data-query-limit="4" (falls back to 4)
    const limit = parseInt(this.dataset.queryLimit || '4', 10);

    // Collect all "text" items in DOM order:
    // - text lists under groups (collections/pages/articles): .predictive-search-results__textlist li
    // - FÖRSLAG (queries) list is excluded — its own Liquid `limit: 5` governs.
    // Exclude anything in the products wrapper.
    const candidates = Array.from(
      container.querySelectorAll(
        '.predictive-search-results__textlist:not(.predictive-search-results__textlist--queries) li'
      )
    ).filter(li => !li.closest('.predictive-search-results__wrapper-products'));

    let shown = 0;
    for (const li of candidates) {
      if (shown < limit) {
        shown += 1;
        continue;
      }
      li.remove();
    }

    // Clean up empty containers
    container.querySelectorAll('.predictive-search-results__group').forEach(group => {
      const hasText = group.querySelector('.predictive-search-results__textlist li');
      const hasProducts = group.querySelector('.predictive-search-results__wrapper-products li');
      if (!hasText && !hasProducts) group.remove();
    });
  }
}

if (!customElements.get('predictive-search-component')) {
  customElements.define('predictive-search-component', PredictiveSearchComponent);
}
