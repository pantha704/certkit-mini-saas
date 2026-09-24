/**
 * CertKit smooth-scroll layer — Lenis, bundled from npm (self-hosted, no CDN,
 * no network request beyond the page's own assets and the Cloudflare beacon).
 *
 * Only initialised when the visitor has NOT asked for reduced motion; with
 * `prefers-reduced-motion: reduce` nothing runs and the browser keeps its
 * native, instant scrolling. The raf loop is driven by GSAP's ticker so both
 * layers share one clock (`lagSmoothing(0)` keeps them in sync on long frames).
 *
 * Nested scrollables (output textareas, raw-JSON panes) carry
 * `data-lenis-prevent`, so wheel/touch inside them scrolls the pane, not the
 * page — Lenis checks the event path for that attribute itself.
 */
import Lenis from 'lenis';
import { gsap } from 'gsap';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

if (!reduceMotion.matches) {
  const lenis = new Lenis({
    lerp: 0.12,
    smoothWheel: true,
    syncTouch: false,
    anchors: true,
    autoRaf: false,
    overscroll: true,
  });

  let tickerLive = false;
  gsap.ticker.add((time) => {
    tickerLive = true;
    lenis.raf(time * 1000);
  });
  gsap.ticker.lagSmoothing(0);

  /* GSAP's ticker starts on its own rAF schedule; if a request hangs at load
     (we measured this with the analytics beacon on a blackholed network) the
     first tick can be seconds late, and until it fires Lenis would swallow
     wheel input without moving. Pump Lenis from a plain rAF — plus a slow
     setTimeout co-driver for renderers where rAF itself is starved — until the
     GSAP ticker is live, then hand over completely. */
  const pump = () => {
    if (tickerLive) return;
    lenis.raf(performance.now());
    requestAnimationFrame(pump);
  };
  requestAnimationFrame(pump);
  const fallback = window.setInterval(() => {
    if (tickerLive) {
      window.clearInterval(fallback);
      return;
    }
    lenis.raf(performance.now());
  }, 100);

  /* Lenis scrolls to in-page anchors but never moves focus, so the skip link
     would leave keyboard focus behind. Do both here: smooth-scroll to <main>
     and put focus on it (tabindex="-1" in Base.astro makes it focusable). */
  const skipLink = document.querySelector<HTMLAnchorElement>('.skip-link');
  const main = document.getElementById('main');
  if (skipLink && main) {
    skipLink.addEventListener('click', (event) => {
      event.preventDefault();
      lenis.scrollTo(main);
      main.focus({ preventScroll: true });
      history.pushState(null, '', '#main');
    });
  }
}
