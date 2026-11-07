/*
 * MUG 2026-11-07: Instants produktrullare rullar som rullarna på startsidan.
 *
 * Instant bygger rullarna (.instant-slider) med Swiper, som flyttar korten med
 * transform: ryckigt med styrplatta och utan sidledes rullning på desktop.
 * Startsidans rullare är vanlig webbläsarrullning med snap. Här startas varje
 * Swiper om i cssMode — Swiper räknar fortfarande ut kortbredder per
 * brytpunkt, men själva rullningen blir webbläsarens egen (mjuk, med
 * tröghet och snap). Pilarna kopplas om till scrollBy, ett kort i taget, och
 * avaktiveras vid kanterna. Går något fel lämnas Instants rullare orörd.
 */
(function () {
  var KLAR = 'mugSliderKlar';
  var CSS =
    '.instant-slider-css-mode>.instant-slider-wrapper{overflow-x:auto;overflow-y:hidden;' +
    'scroll-snap-type:x mandatory;scroll-behavior:smooth;scrollbar-width:none;overscroll-behavior-x:contain}' +
    '.instant-slider-css-mode>.instant-slider-wrapper::-webkit-scrollbar{display:none}' +
    '.instant-slider-css-mode>.instant-slider-wrapper>.instant-slider-slide{scroll-snap-align:start}';

  function stil() {
    if (document.getElementById('mug-instant-slider-css')) return;
    var st = document.createElement('style');
    st.id = 'mug-instant-slider-css';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  function knapp(behallare, sort) {
    return behallare && behallare.querySelector('.instant-slider-button-' + sort);
  }

  function forbattra(el) {
    var s = el.swiper;
    if (!s || !s.originalParams || el.dataset[KLAR]) return;
    el.dataset[KLAR] = '1';
    var behallare = el.closest('.instant-slider-container');
    var prev = knapp(behallare, 'prev');
    var next = knapp(behallare, 'next');

    try {
      var Swiper = s.constructor;
      var p = {};
      for (var k in s.originalParams) p[k] = s.originalParams[k];
      delete p.on;
      delete p.modules;
      p.navigation = false;
      p.mousewheel = { enabled: false };
      p.keyboard = { enabled: false };
      p.cssMode = true;
      s.destroy(false, true);
      var n = new Swiper(el, p);
      var w = n.wrapperEl;
      w.style.transform = '';
      stil();
    } catch (e) {
      return; // Instants rullare finns kvar som förut (den förstörs bara om omstarten lyckas att börja)
    }

    // Kant till kant: rullytan (wrappern) sträcks ut till fönstrets kanter med
    // negativa marginaler, och lika mycket utfyllnad + scroll-padding håller
    // första kortet i linje med rubriken. Rullaren själv behåller sin bredd,
    // så Swiper räknar kortbredderna som förut.
    function kant() {
      var r = el.getBoundingClientRect();
      var vw = document.documentElement.clientWidth;
      var v = Math.max(0, Math.round(r.left));
      var h = Math.max(0, Math.round(vw - r.right));
      // Swipers wrapper har width:100% — bredden måste sättas uttryckligen.
      w.style.boxSizing = 'border-box';
      w.style.width = 'calc(100% + ' + (v + h) + 'px)';
      w.style.marginLeft = -v + 'px';
      w.style.marginRight = -h + 'px';
      w.style.paddingLeft = v + 'px';
      w.style.paddingRight = v + 'px';
      w.style.scrollPaddingLeft = v + 'px';
    }
    function steg() {
      var kort = w.children;
      if (kort.length > 1) return kort[1].offsetLeft - kort[0].offsetLeft;
      return w.clientWidth;
    }
    function lage() {
      var max = w.scrollWidth - w.clientWidth - 2;
      [[prev, w.scrollLeft <= 2], [next, w.scrollLeft >= max]].forEach(function (par) {
        if (!par[0]) return;
        par[0].disabled = par[1];
        par[0].classList.toggle('instant-slider-button-disabled', par[1]);
      });
    }
    if (prev) prev.addEventListener('click', function (e) { e.preventDefault(); w.scrollBy({ left: -steg() }); });
    if (next) next.addEventListener('click', function (e) { e.preventDefault(); w.scrollBy({ left: steg() }); });
    w.addEventListener('scroll', lage, { passive: true });
    window.addEventListener('resize', function () { kant(); lage(); });
    kant();
    lage();
  }

  function svep() {
    var alla = document.querySelectorAll('.instant-slider');
    for (var i = 0; i < alla.length; i++) forbattra(alla[i]);
  }

  // Instant initierar rullarna asynkront (och lata sektioner senare):
  // lyssna på deras initieringsattribut i stället för att gissa en tidpunkt.
  var obs = new MutationObserver(svep);
  function start() {
    svep();
    obs.observe(document.body, {
      subtree: true, childList: true,
      attributes: true, attributeFilter: ['data-instant-slider-initialized'],
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
