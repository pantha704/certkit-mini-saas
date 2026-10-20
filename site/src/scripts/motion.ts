/**
 * CertKit motion layer: native Web Animations API, no animation library.
 *
 * Only transform and opacity are animated, nothing is hidden in CSS: with
 * JavaScript off every page is fully readable, and with
 * `prefers-reduced-motion: reduce` no animation setup runs at all, so the page
 * keeps its instant, final state.
 *
 * Scroll is never touched: no smooth-scroll library, no scroll pinning, no
 * scroll-jacking. The browser scrolls natively with the keyboard, wheel and
 * touch exactly as the platform intends.
 */
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const all = <T extends Element>(selector: string, root: ParentNode = document): T[] =>
  Array.from(root.querySelectorAll<T>(selector));

/** Ease-out used across the site, matching the CSS cubic-bezier values. */
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

/** Element must be rendered before it can be animated. */
const isRendered = (el: HTMLElement): boolean => el.getClientRects().length > 0;

/** Result rows that get a small staggered reveal when their container lands. */
const ROW_SELECTOR =
  '.chain-list > li, #links-list > li, table.data tbody > tr, [data-stagger] > *';

/**
 * Tool result first appears after processing: y 10 → 0 + fade, 220ms.
 * Under reduced motion this is never called (checked by the caller).
 */
function playReveal(container: HTMLElement): void {
  if (!isRendered(container)) return;
  container.animate(
    [
      { transform: 'translateY(10px)', opacity: 0 },
      { transform: 'none', opacity: 1 },
    ],
    { duration: 220, easing: EASE }
  );

  // Rows (chain items, issuer links, JWK keys, table rows) follow in a small
  // 40 ms stagger so a long result reads top-to-bottom instead of popping in.
  const rows = all<HTMLElement>(ROW_SELECTOR, container);
  rows.forEach((row, index) => {
    row.animate(
      [
        { transform: 'translateY(8px)', opacity: 0 },
        { transform: 'none', opacity: 1 },
      ],
      { duration: 220, delay: 40 + index * 40, easing: EASE, fill: 'backwards' }
    );
  });

  // State badges are usually set while the container is still hidden, so pop
  // the badge as the result lands instead of when it could not be seen.
  const badge = container.querySelector<HTMLElement>('.badge');
  if (badge) {
    badge.animate(
      [
        { transform: 'scale(0.94)', opacity: 0 },
        { transform: 'none', opacity: 1 },
      ],
      { duration: 200, delay: 80, easing: EASE }
    );
  }
}

/** State indicator (MATCH badge, error alert) changes: quick pop, 200ms. */
function playPop(el: HTMLElement): void {
  if (!isRendered(el)) return; // set while hidden; the reveal animation covers it
  el.animate(
    [
      { transform: 'scale(0.94)', opacity: 0 },
      { transform: 'none', opacity: 1 },
    ],
    { duration: 200, easing: EASE }
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
 * for its 200 ms. Reduced motion never reaches this code, native toggle.
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
        const targets = items.length ? items : [section];
        targets.forEach((item, index) => {
          item.animate(
            [
              { transform: 'translateY(16px)', opacity: 0 },
              { transform: 'none', opacity: 1 },
            ],
            {
              duration: 400,
              delay: items.length ? index * 60 : 0,
              easing: EASE,
              fill: 'backwards',
            }
          );
        });
      });
    },
    { threshold: 0.15 }
  );
  sections.forEach((section) => observer.observe(section));
}

/* Reduced motion: no setup runs, so everything stays in its visible final state. */
if (!reduceMotion.matches) {
  setupScrollReveal();
  setupFaq();
}
