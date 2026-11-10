// The theme and the font size are chosen before the first paint, so a light
// page never flashes dark, and the app is full height until React mounts. The
// key is the one of the app, so the choice follows. Served as a file, so the
// content security policy can allow it with a script source of self.
(function () {
  var light = false;
  try { light = window.localStorage.getItem('samosa-theme') === 'light'; } catch (e) {}
  document.documentElement.dataset.theme = light ? 'light' : 'dark';
  try {
    var font = Number(window.localStorage.getItem('samosa-font'));
    if (font >= 0.875 && font <= 1.8) document.documentElement.style.setProperty('--font-scale', String(font));
  } catch (e) {}
  var bg = light ? '#fbf8f1' : '#0b0a08';
  var fg = light ? '#221d17' : '#ede6da';
  var style = document.createElement('style');
  style.textContent = 'html,body,#root{height:100%;margin:0;background-color:' + bg + ';color:' + fg + ';font-family:ui-monospace,monospace}';
  document.head.appendChild(style);
  try {
    if (window.sessionStorage.getItem('samosa:opening') === '1') {
      window.sessionStorage.removeItem('samosa:opening');
      document.documentElement.classList.add('samosa-from-open');
      window.setTimeout(function () {
        document.documentElement.classList.remove('samosa-from-open');
      }, 1000);
    }
  } catch (e) {}
  // the app works on a plane: sw.js caches the assets and /app/, and keeps
  // the landing page fresh from the network
  try {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () {
        if (new URLSearchParams(location.search).has('nosw') || window.__SAMOSA_NO_SW) return;
        navigator.serviceWorker.register('/sw.js').catch(function () {});
      });
    }
  } catch (e) {}
})();
