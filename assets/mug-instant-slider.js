/*
 * MUG 2026-11-07: bättre sidledes rullning i Instants produktrullare.
 *
 * Instant bygger rullarna (.instant-slider) med Swiper men slår av
 * Mousewheel-modulen, så på desktop gick det bara att bläddra med pilarna:
 * sidledes svep på styrplattan och shift+hjul gjorde ingenting. Swiper-
 * instansen ligger på elementet (el.swiper) och modulen finns i Instants
 * bundle, så vi slår på den i efterhand. forceToAxis gör att vanlig lodrät
 * rullning går förbi till sidan; releaseOnEdges lämnar över till sidan vid
 * första/sista kortet. Ingen ändring i Instant: om de byter teknik slutar
 * skriptet bara att verka och rullaren fungerar som förut.
 */
(function () {
  var KLAR = 'mugSliderKlar';

  function forbattra(el) {
    var s = el.swiper;
    if (!s || !s.params || el.dataset[KLAR]) return;
    el.dataset[KLAR] = '1';

    if (s.mousewheel && s.params.mousewheel) {
      var mw = s.params.mousewheel;
      mw.enabled = true;
      mw.forceToAxis = true;
      mw.releaseOnEdges = true;
      mw.thresholdDelta = 6;
      s.mousewheel.enable();
    }
    if (s.keyboard && s.params.keyboard) {
      s.params.keyboard.enabled = true;
      s.params.keyboard.onlyInViewport = true;
      s.keyboard.enable();
    }
    // Dra med musen: Swiper kan redan (simulateTouch), handen visar att det går.
    if (s.params.simulateTouch !== false && typeof s.setGrabCursor === 'function') {
      s.params.grabCursor = true;
      s.setGrabCursor();
    }
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
