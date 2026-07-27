/*
  Homepage product carousels: lazy "load more" at the end of the track.

  Each product-list section renders its first page (max_products) server-side.
  When the user scrolls near the end of a carousel, the same section is
  fetched via the Section Rendering API with ?page=N — Liquid's paginate
  serves the next batch with identical card markup — and the new
  <slideshow-slide> elements are appended to the scroller. Keeps the
  initial page load light while letting the carousels go deep.
*/
const MAX_PAGES = 4; // initial 8 + up to 24 more per carousel

function initLoadMore(section) {
  const sectionId = section.dataset.loadMoreSection;
  const scroller = section.querySelector('slideshow-slides');
  if (!sectionId || !scroller) return;

  let page = 1;
  let loading = false;
  let done = false;

  const sentinel = document.createElement('div');
  sentinel.className = 'carousel-more-sentinel';
  scroller.appendChild(sentinel);

  const spinner = document.createElement('div');
  spinner.className = 'carousel-more-loader';
  spinner.setAttribute('role', 'status');
  spinner.innerHTML = '<span class="carousel-more-spinner"></span><span class="visually-hidden">Laddar fler produkter</span>';

  const knownProductUrls = () =>
    new Set(
      Array.from(scroller.querySelectorAll('a[href*="/products/"]')).map((a) =>
        a.getAttribute('href').split('?')[0]
      )
    );

  const loadNext = async () => {
    if (loading || done) return;
    loading = true;
    scroller.insertBefore(spinner, sentinel);
    try {
      page += 1;
      const url = `${window.location.pathname}?section_id=${encodeURIComponent(sectionId)}&page=${page}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`section fetch ${res.status}`);
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const slides = Array.from(doc.querySelectorAll('slideshow-slide'));
      const existing = knownProductUrls();
      let added = 0;
      for (const slide of slides) {
        const link = slide.querySelector('a[href*="/products/"]');
        const href = link ? link.getAttribute('href').split('?')[0] : null;
        if (!href || existing.has(href)) continue;
        slide.setAttribute('aria-hidden', 'true');
        scroller.insertBefore(slide, sentinel);
        added += 1;
      }
      if (added === 0 || page >= MAX_PAGES) {
        done = true;
        observer.disconnect();
        sentinel.remove();
      }
    } catch (e) {
      done = true;
      observer.disconnect();
      sentinel.remove();
    }
    spinner.remove();
    loading = false;
  };

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadNext();
    },
    { rootMargin: '0px 600px 0px 600px' }
  );
  observer.observe(sentinel);
}

document.querySelectorAll('[data-load-more-section]').forEach(initLoadMore);
