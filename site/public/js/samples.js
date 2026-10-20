/**
 * "Load sample" action, shared by every tool page.
 *
 * A button with data-sample="<kind>" fills the form with a built-in test
 * certificate (CN *.certkit.test) and runs the tool, so the output can be seen
 * before any real key or file is touched. Samples are ordinary static files
 * under /samples/ on this origin. Nothing typed or chosen is uploaded.
 */
(function () {
  'use strict';

  var PASSWORD = 'certkit-demo';

  function fetchSample(name) {
    return fetch('/samples/' + name, { credentials: 'same-origin' }).then(function (response) {
      if (!response.ok) throw new Error('Sample file could not be loaded (' + response.status + ').');
      return response.arrayBuffer();
    });
  }

  function decode(bytes) {
    return new TextDecoder('utf-8').decode(bytes).trim();
  }

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.value = text;
  }

  function setFile(inputId, name, bytes, type) {
    var input = document.getElementById(inputId);
    if (!input) return;
    var file = new File([bytes], name, { type: type || 'application/octet-stream' });
    var transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /* Each loader fills the page's inputs. The click handler submits the form. */
  var loaders = {
    'pfx-to-pem': function () {
      return fetchSample('demo-chain.p12').then(function (bytes) {
        setFile('pfx-file', 'demo-chain.p12', bytes, 'application/x-pkcs12');
        setText('pfx-password', PASSWORD);
      });
    },

    'pem-to-pfx': function () {
      return Promise.all([fetchSample('demo-key.pem'), fetchSample('demo-cert.pem')]).then(function (files) {
        setText('key-pem', decode(files[0]));
        setText('cert-pems', decode(files[1]));
        setText('pfx-password', PASSWORD);
        setText('friendly-name', 'CertKit demo');
      });
    },

    'certificate-decoder': function () {
      return fetchSample('demo-cert.pem').then(function (bytes) {
        setText('cert-input', decode(bytes));
      });
    },

    'csr-decoder': function () {
      return fetchSample('demo.csr').then(function (bytes) {
        setText('csr-input', decode(bytes));
      });
    },

    'key-cert-match': function () {
      return Promise.all([fetchSample('demo-key.pem'), fetchSample('demo-cert.pem')]).then(function (files) {
        setText('key-input', decode(files[0]));
        setText('cert-input', decode(files[1]));
      });
    },

    'chain-order': function () {
      return fetchSample('demo-chain.pem').then(function (bytes) {
        setText('chain-input', decode(bytes));
      });
    },

    'der-certificate': function () {
      return fetchSample('demo-cert.der').then(function (bytes) {
        setFile('der-file', 'demo-cert.der', bytes, 'application/pkix-cert');
      });
    },

    jwk: function () {
      return fetchSample('demo-key.jwk.json').then(function (bytes) {
        setText('jwk-input', decode(bytes));
      });
    },
  };

  document.addEventListener('click', function (event) {
    var button = event.target && event.target.closest ? event.target.closest('[data-sample]') : null;
    if (!button) return;

    event.preventDefault();
    var kind = button.getAttribute('data-sample');
    var form = button.closest('form');
    var original = button.textContent;
    button.disabled = true;
    button.textContent = 'Loading sample…';

    var start = window.CertKitBoot ? window.CertKitBoot() : Promise.resolve();
    start
      .then(function () {
        var loader = loaders[kind];
        if (!loader) throw new Error('Unknown sample: ' + kind);
        return loader();
      })
      .then(function () {
        button.disabled = false;
        button.textContent = original;
        if (form && form.requestSubmit) form.requestSubmit();
      })
      .catch(function (error) {
        button.disabled = false;
        button.textContent = original;
        if (window.CertKitUI) {
          window.CertKitUI.setError((error && error.message) || 'The sample could not be loaded.');
        }
      });
  });
})();
