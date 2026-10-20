/**
 * CertKit tool bootstrap.
 *
 * The page markup is complete without JavaScript. The crypto engine
 * (node-forge, ~75 KB gzip) and the tool scripts load only when the visitor
 * shows intent (pointer, key, touch, focus) or submits a form, so a first visit
 * reads and renders without paying for the engine. Once started, scripts load
 * in dependency order: ui → forge → certkit → tool.
 *
 * Usage on a tool page:
 *   <script is:inline src="/js/boot.js" data-tool="/js/tools/pfx-to-pem.js" defer></script>
 */
(function () {
  'use strict';

  var tag = document.currentScript;
  var toolSrc = tag ? tag.getAttribute('data-tool') : null;
  var loading = null;
  var ready = false;

  function announce(message) {
    var el = document.getElementById('tool-status');
    if (el) el.textContent = message;
  }

  function add(src) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.onload = function () {
        resolve(src);
      };
      script.onerror = function () {
        reject(new Error('Could not load ' + src));
      };
      document.head.appendChild(script);
    });
  }

  function fail() {
    var box = document.getElementById('tool-error');
    if (box) {
      box.textContent =
        'The local crypto engine could not load. Check your connection and reload the page.';
      box.hidden = false;
    }
    announce('Could not load the local crypto engine.');
  }

  /** Start (or join) the one-time engine load. Resolves when tools are wired. */
  function load() {
    if (loading) return loading;
    loading = add('/js/ui.js')
      .then(function () {
        return add('/vendor/forge.min.js');
      })
      .then(function () {
        return add('/lib/certkit.js');
      })
      .then(function () {
        return toolSrc ? add(toolSrc) : null;
      })
      .then(function () {
        ready = true;
        announce('');
        return true;
      })
      .catch(function (error) {
        loading = null; // allow a retry on the next click
        fail();
        throw error;
      });
    return loading;
  }

  window.CertKitBoot = load;

  // First sign of intent starts the load now. Reading costs nothing.
  ['pointerdown', 'keydown', 'touchstart', 'focusin'].forEach(function (type) {
    document.addEventListener(type, function () { load().catch(function () {}); }, {
      once: true,
      capture: true,
      passive: true,
    });
  });

  // A submit before the engine is ready waits, then runs the same submit again.
  document.addEventListener(
    'submit',
    function (event) {
      if (ready) return;
      event.preventDefault();
      var form = event.target;
      announce('Loading the local crypto engine.');
      load()
        .then(function () {
          if (form && form.requestSubmit) form.requestSubmit();
          else if (form) form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        })
        .catch(function () {});
    },
    true
  );
})();
