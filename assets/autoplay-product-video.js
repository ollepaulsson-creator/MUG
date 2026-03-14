
document.addEventListener('DOMContentLoaded', function () {
  const slideshow = document.querySelector('slideshow-component');
  if (!slideshow) return;

  const slides = Array.from(slideshow.querySelectorAll('slideshow-slide'));

  const isVideoSlide = (slide) =>
    slide &&
    (slide.classList.contains('product-media-container--external_video') ||
     slide.classList.contains('product-media-container--video'));

  // --- helpers ---------------------------------------------------------------

  function setYTParam(url, key, value) {
    try {
      const u = new URL(url, location.origin);
      u.searchParams.set(key, String(value));
      return u.toString();
    } catch {
      // fallback for relative or malformed src
      const hasQuery = url.includes('?');
      const re = new RegExp('([?&])' + key + '=[^&]*');
      if (re.test(url)) return url.replace(re, `$1${key}=${value}`);
      return url + (hasQuery ? '&' : '?') + key + '=' + value;
    }
  }

  function disableAutoplay(iframe) {
    if (!iframe) return;
    // Turn off autoplay (and keep jsapi/origin intact)
    iframe.src = setYTParam(iframe.src, 'autoplay', '0');
    try { iframe.contentWindow.postMessage(JSON.stringify({event:'command', func:'pauseVideo'}), '*'); } catch {}
  }

  function stopAndResetSlide(slide) {
    if (!slide) return;
    const dm = slide.querySelector('deferred-media');
    if (!dm) return;

    const video = dm.querySelector('video');
    const iframe = dm.querySelector('iframe');

    if (video) {
      try { video.pause(); } catch {}
      try { video.currentTime = 0; } catch {}
      return;
    }
    if (iframe) {
      const src = iframe.src || '';
      if (/youtube\.com|youtu\.be/.test(src)) {
        try {
          iframe.contentWindow.postMessage(JSON.stringify({event:'command', func:'stopVideo'}), '*');
          iframe.contentWindow.postMessage(JSON.stringify({event:'command', func:'seekTo', args:[0,true]}), '*');
        } catch {}
        // Ensure it won't restart by itself while hidden
        disableAutoplay(iframe);
      } else if (/vimeo\.com/.test(src)) {
        try {
          iframe.contentWindow.postMessage({ method:'pause' }, '*');
          iframe.contentWindow.postMessage({ method:'setCurrentTime', value:0 }, '*');
        } catch {}
      } else {
        // generic – force reload without autoplay
        disableAutoplay(iframe);
      }
    }
  }

  function stopAllExcept(active) {
    slides.forEach(s => { if (s !== active) stopAndResetSlide(s); });
  }

  function clickPosterIfNeeded(dm) {
    // If the player isn't injected yet, click the poster to mount it
    if (!dm.querySelector('iframe, video')) {
      const posterBtn = dm.querySelector('.deferred-media__poster-button');
      posterBtn && posterBtn.click();
    }
  }

  function playFromStart(slide) {
    const dm = slide.querySelector('deferred-media');
    if (!dm) return;

    clickPosterIfNeeded(dm);

    // give the DOM a tick to inject the iframe/video
    setTimeout(() => {
      const video = dm.querySelector('video');
      const iframe = dm.querySelector('iframe');

      if (video) {
        try { video.currentTime = 0; } catch {}
        video.playsInline = true;
        video.muted = false;   // you asked to unmute; note: browsers may block without user gesture
        video.volume = 1;
        video.play().catch(()=>{});
        return;
      }

      if (iframe) {
        const src = iframe.src || '';
        // Make sure autoplay=1 ONLY now that the user clicked thumbnail
        iframe.src = setYTParam(iframe.src, 'autoplay', '1');

        if (/youtube\.com|youtu\.be/.test(src)) {
          try {
            iframe.contentWindow.postMessage(JSON.stringify({event:'command', func:'unMute'}), '*');
            iframe.contentWindow.postMessage(JSON.stringify({event:'command', func:'setVolume', args:[100]}), '*');
            iframe.contentWindow.postMessage(JSON.stringify({event:'command', func:'seekTo', args:[0,true]}), '*');
            iframe.contentWindow.postMessage(JSON.stringify({event:'command', func:'playVideo'}), '*');
          } catch {}
        } else if (/vimeo\.com/.test(src)) {
          try {
            iframe.contentWindow.postMessage({ method:'setCurrentTime', value:0 }, '*');
            iframe.contentWindow.postMessage({ method:'setVolume', value:1 }, '*');
            iframe.contentWindow.postMessage({ method:'play' }, '*');
          } catch {}
        }
      }
    }, 120);
  }

  function activeSlide() {
    return slideshow.querySelector('slideshow-slide[aria-hidden="false"]');
  }

  // On load: ensure hidden video slides are NOT autoplaying
  slides.forEach(slide => {
    if (!isVideoSlide(slide)) return;
    const notActive = slide.getAttribute('aria-hidden') !== 'false';
    if (notActive) {
      const dm = slide.querySelector('deferred-media');
      if (!dm) return;
      const iframe = dm.querySelector('iframe');
      if (iframe) disableAutoplay(iframe);
    }
  });

  // --- UI bindings -----------------------------------------------------------

  // Thumbnails
  slideshow.addEventListener('click', (e) => {
    const thumb = e.target.closest('.slideshow-controls__thumbnail');
    if (!thumb) return;

    const indexMatch = thumb.getAttribute('on:click')?.match(/\/select\/(\d+)/);
    if (!indexMatch) return;
    const idx = parseInt(indexMatch[1], 10);
    const target = slides[idx];

    // Stop others first
    stopAllExcept(target);

    // Only autoplay if the user actually clicked a VIDEO thumbnail
    if (target && isVideoSlide(target)) {
      playFromStart(target);
    }
  }, true);

  // Arrows / any slide change (watch aria-hidden)
  const mo = new MutationObserver(muts => {
    if (!muts.some(m => m.type === 'attributes' && m.attributeName === 'aria-hidden')) return;

    const current = activeSlide();
    // Stop everything else
    stopAllExcept(current);

    // Do NOT autoplay just because it became active.
    // We only autoplay on an explicit click on the video thumbnail.
    // If you also want autoplay when the user uses arrows to land on a video, uncomment:
    // if (current && isVideoSlide(current)) playFromStart(current);
  });

  slides.forEach(s => mo.observe(s, { attributes: true, attributeFilter: ['aria-hidden'] }));

});
