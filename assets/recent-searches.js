/**
 * Manages recently searched terms in localStorage.
 */
export class RecentSearches {
  static #STORAGE_KEY = 'recentSearches';
  static #MAX_SEARCHES = 5;

  /**
   * Prepend a search term, deduplicate, cap at 5, persist.
   * @param {string} term
   */
  static addSearch(term) {
    if (!term) return;
    let searches = this.getSearches();
    searches = searches.filter((s) => s !== term);
    searches.unshift(term);
    searches = searches.slice(0, this.#MAX_SEARCHES);
    localStorage.setItem(this.#STORAGE_KEY, JSON.stringify(searches));
  }

  /**
   * @returns {string[]}
   */
  static getSearches() {
    return JSON.parse(localStorage.getItem(this.#STORAGE_KEY) || '[]');
  }
}
