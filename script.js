// Entry loader: application logic moved to assets/js/app.js.
(function loadStructuredApp() {
  var script = document.createElement('script');
  script.src = 'assets/js/app.js';
  script.async = false;
  document.body.appendChild(script);
})();
