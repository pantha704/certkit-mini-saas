/**
 * CertKit motion layer.
 *
 * GSAP core only, bundled from npm (self-hosted, no CDN, no runtime network calls of its
 * own) — the only third-party request the site makes is the Cloudflare Web Analytics
 * beacon. Motion uses transform and
 * opacity only and nothing is hidden in CSS: with JavaScript off every page is
 * fully readable, and with prefers-reduced-motion the page keeps its instant,
 * final state.
 *
 * Note: tweens animate `opacity`, not gsap's `autoAlpha` — autoAlpha flips
 * `visibility:hidden`, which blanks text for the first frames of the tween
 * (innerText/screen readers sample mid-flight) and violates "text instantly
 * readable". Visually the two are identical.
 */
import { gsap } from 'gsap';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const all = <T extends Element>(selector: string, root: ParentNode = document): T[] =>
  Array.from(root.querySelectorAll<T>(selector));

/** True when the element (or an ancestor) is currently rendered. */
const isRendered = (el: HTMLElement): boolean => el.getClientRects().length > 0;

/** Result rows that get a small staggered reveal when their container lands. */
const ROW_SELECTOR =
  '.chain-list > li, #links-list > li, table.data tbody > tr, [data-stagger] > *';

/** Tool result first appears after processing: y 10 → 0 + fade, 220ms. */
function playReveal(container: HTMLElement): void {
  gsap.killTweensOf(container);
  gsap.fromTo(
    container,
    { y: 10, opacity: 0 },
    {
      y: 0,
      opacity: 1,
      duration: 0.22,
      ease: 'power2.out',
      clearProps: 'transform,opacity',
    }
  );

  // Rows (chain items, issuer links, JWK keys, table rows) follow in a small
  // 40 ms stagger so a long result reads top-to-bottom instead of popping in.
  const rows = all<HTMLElement>(ROW_SELECTOR, container);
  if (rows.length) {
    gsap.killTweensOf(rows);
    gsap.from(rows, {
      y: 8,
      opacity: 0,
      duration: 0.22,
      ease: 'power2.out',
      stagger: 0.04,
      delay: 0.04,
      clearProps: 'transform,opacity',
    });
  }

  // State badges are usually set while the container is still hidden, so pop
  // the badge as the result lands instead of when it could not be seen.
  const badge = container.querySelector<HTMLElement>('.badge');
  if (badge) {
    gsap.killTweensOf(badge);
    gsap.fromTo(
      badge,
      { scale: 0.94, opacity: 0 },
      {
        scale: 1,
        opacity: 1,
        duration: 0.2,
        ease: 'power2.out',
        delay: 0.08,
        clearProps: 'transform,opacity',
      }
    );
  }
}

/** State indicator (MATCH badge, error alert) changes: quick pop, 200ms. */
function playPop(el: HTMLElement): void {
  if (!isRendered(el)) return; // set while hidden; the reveal animation covers it
  gsap.killTweensOf(el);
  gsap.fromTo(
    el,
    { scale: 0.94, opacity: 0 },
    {
      scale: 1,
      opacity: 1,
      duration: 0.2,
      ease: 'power2.out',
      clearProps: 'transform,opacity',
    }
  );
}

/* The plain tool scripts (js/ui.js) announce state changes through this event. */
document.addEventListener('certkit:motion', (event) => {
  if (reduceMotion.matches) return; // reduced motion: instant state, no movement
  const detail = (event as CustomEvent<{ effect?: string; el?: HTMLElement | null }>).detail;
  if (!detail || !detail.el) return;
  if (detail.effect === 'reveal') playReveal(detail.el);
  else if (detail.effect === 'pop') playPop(detail.el);
});

/**
 * FAQ <details>: open runs as a CSS keyframe on the .faq-body grid wrapper
 * (0fr → 1fr); close is intercepted here because a closed <details> hides its
 * content instantly, so the 0fr transition needs the open attribute to stay on
 * for its 200 ms. Reduced motion never reaches this code — native toggle.
 */
function setupFaq(): void {
  all<HTMLDetailsElement>('.faq-section details').forEach((el) => {
    const summary = el.querySelector('summary');
    if (!summary) return;

    summary.addEventListener('click', (event) => {
      if (el.classList.contains('is-closing')) {
        event.preventDefault(); // mid-close click: ignore, animation already running
        return;
      }
      if (!el.open) return; // opening: the CSS keyframe covers it

      event.preventDefault();
      const body = el.querySelector<HTMLElement>('.faq-body');
      el.classList.add('is-closing');
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        el.open = false;
        el.classList.remove('is-closing');
      };
      body?.addEventListener('transitionend', finish, { once: true });
      window.setTimeout(finish, 260); // fallback if transitionend is missed
    });
  });
}

/** Home hero entrance: eyebrow → h1 → sub → tool cards, 65ms apart, y 22 → 0. */
function setupHero(): void {
  const hero = document.querySelector<HTMLElement>('[data-motion="hero"]');
  if (!hero) return;

  const step = 0.065;
  const timeline = gsap.timeline({ defaults: { duration: 0.5, ease: 'power3.out' } });
  let at = 0;
  (['eyebrow', 'title', 'sub'] as const).forEach((slot) => {
    const el = hero.querySelector<HTMLElement>(`[data-motion="hero-${slot}"]`);
    if (!el) return; // slots a page does not have are skipped; order is kept
    timeline.from(el, { y: 22, opacity: 0, clearProps: 'transform,opacity' }, at);
    at += step;
  });

  const cards = all<HTMLElement>('[data-motion="hero-card"]');
  if (cards.length) {
    timeline.from(cards, { y: 22, opacity: 0, stagger: step, clearProps: 'transform,opacity' }, at);
  }
}

/** Below-the-fold sections and cards: reveal once, children staggered. */
function setupScrollReveal(): void {
  const sections = all<HTMLElement>('[data-reveal]');
  if (!sections.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const section = entry.target as HTMLElement;
        observer.unobserve(section); // reveal once
        const items = all<HTMLElement>('[data-reveal-item]', section);
        gsap.from(items.length ? items : [section], {
          y: 16,
          opacity: 0,
          duration: 0.4,
          ease: 'power2.out',
          stagger: items.length ? 0.06 : 0,
          clearProps: 'transform,opacity',
        });
      });
    },
    { threshold: 0.15 }
  );
  sections.forEach((section) => observer.observe(section));
}

/* Reduced motion: no setup runs, so everything stays in its visible final state. */
const mm = gsap.matchMedia();
mm.add('(prefers-reduced-motion: no-preference)', () => {
  setupHero();
  setupScrollReveal();
  setupFaq();
});
