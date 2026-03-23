(function () {
  function syncFilterWidth() {
    var wrapper = document.querySelector('.facets-toggle__wrapper');
    var cardContent = document.querySelector('.product-card__content');
    if (!wrapper || !cardContent) return false;
    var contentRect = cardContent.getBoundingClientRect();
    if (contentRect.width === 0) return false;
    wrapper.style.width = '';
    var wrapperLeft = wrapper.getBoundingClientRect().left;
    wrapper.style.width = (contentRect.right - wrapperLeft) + 'px';
    return true;
  }

  // Watch for product cards being inserted into the DOM
  var mo = new MutationObserver(function () {
    if (syncFilterWidth()) mo.disconnect();
  });
  mo.observe(document.body, { childList: true, subtree: true });

  // Also watch grid resize (handles container-query reflows)
  var grid = document.querySelector('.product-grid');
  if (grid && window.ResizeObserver) {
    new ResizeObserver(syncFilterWidth).observe(grid);
  }

  // Fallback timeouts spread further out for slow renders
  [0, 100, 300, 700, 1500, 3000, 5000].forEach(function (d) {
    setTimeout(syncFilterWidth, d);
  });

  // Re-run after all resources (fonts, images) finish loading
  window.addEventListener('load', function () {
    requestAnimationFrame(syncFilterWidth);
  });

  var rt;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(syncFilterWidth, 100); });
})();
