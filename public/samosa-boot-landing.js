// The theme and the font size are chosen before the first paint, so a light
// page never flashes dark. The key is the one of the app, so the choice
// follows. Served as a file, so the content security policy can allow it with
// a script source of self.
(function () {
  var light = false;
  try { light = window.localStorage.getItem('samosa-theme') === 'light'; } catch (e) {}
  document.documentElement.dataset.theme = light ? 'light' : 'dark';
  try {
    var font = Number(window.localStorage.getItem('samosa-font'));
    if (font >= 0.875 && font <= 1.8) document.documentElement.style.setProperty('--font-scale', String(font));
  } catch (e) {}
  var style = document.createElement('style');
  style.id = 'samosa-boot';
  style.textContent = 'html,body{margin:0;background-color:' + (light ? '#fbf8f1' : '#0b0a08') + ';color:' + (light ? '#221d17' : '#ede6da') + ';font-family:ui-monospace,monospace}';
  document.head.appendChild(style);
})();
