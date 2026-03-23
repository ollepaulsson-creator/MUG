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

  var grid = document.querySelector('.product-grid');
  if (grid && window.ResizeObserver) {
    new ResizeObserver(syncFilterWidth).observe(grid);
  }

  [0, 100, 300, 700, 1500].forEach(function (d) { setTimeout(syncFilterWidth, d); });

  var rt;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(syncFilterWidth, 100); });
})();
