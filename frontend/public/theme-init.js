// Runs before the page paints, so the saved light/dark theme is applied with no white flash.
// It is a separate file (not inline) because the site's security policy blocks inline scripts.
(function () {
  try {
    var pref = localStorage.getItem('civicsync_theme') || 'system';
    var dark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var root = document.documentElement;
    if (dark) root.classList.add('dark');
    root.style.colorScheme = dark ? 'dark' : 'light';
    var lang = localStorage.getItem('civicsync_lang');
    if (lang) root.lang = lang;
  } catch (e) {}
})();
