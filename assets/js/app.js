// Structured JS entry: loads modules in dependency order.
(function loadAppModules() {
  const modulePaths = [
    'assets/js/core/core.js',
    'assets/js/modules/history.js',
    'assets/js/modules/converter.js',
    'assets/js/modules/auth.js'
  ];

  const loadNext = (index) => {
    if (index >= modulePaths.length) {
      return;
    }

    const script = document.createElement('script');
    script.src = modulePaths[index];
    script.async = false;
    script.onload = () => loadNext(index + 1);
    script.onerror = () => {
      console.error('Failed to load module:', modulePaths[index]);
    };
    document.body.appendChild(script);
  };

  loadNext(0);
})();
