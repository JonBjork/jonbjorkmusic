/* Site-wide dismissible promo bar (The Practice Room, evergreen from Aug 19 2026).
   Remember to bump KEY whenever the message changes, otherwise anyone who
   dismissed the previous bar never sees the new one.
   Include with: <script src="/promo-bar.js"></script> right after <body>.
   - Skips /practiceroom (no self-promo on the sales page)
   - Remembers dismissal in localStorage across the whole site
   - Pushes any fixed nav / .mobile-menu down by the bar height, responsively */
(function () {
  'use strict';

  if (/^\/practiceroom(\/|$)/.test(window.location.pathname)) return;

  var KEY = 'promo-tpr-evergreen-dismissed';
  try { if (localStorage.getItem(KEY) === '1') return; } catch (e) {}

  var CSS = [
    '#promoBar{position:fixed;top:0;left:0;right:0;z-index:2001;height:44px;',
    'display:flex;align-items:center;justify-content:center;padding:0 52px;',
    'background:linear-gradient(90deg,#0f0820,#2d2060 50%,#0f0820);',
    'border-bottom:1px solid #4a3a9a;white-space:nowrap;overflow:hidden;}',
    "#promoBar a{display:inline-flex;align-items:baseline;gap:12px;font-family:'Oswald','Helvetica Neue',Arial,sans-serif;text-decoration:none;color:#e8e8e8;overflow:hidden;text-overflow:ellipsis;}",
    '#promoBar .promo-new{color:#9d5ff5;font-weight:600;font-size:0.78rem;letter-spacing:0.2em;text-transform:uppercase;}',
    '#promoBar .promo-text{font-weight:400;font-size:0.98rem;letter-spacing:0.05em;color:#e8e8e8;}',
    '#promoBar .promo-cta{font-weight:600;font-size:0.9rem;letter-spacing:0.1em;text-transform:uppercase;color:#ffffff;border-bottom:1px solid #9d5ff5;padding-bottom:1px;transition:color .2s;}',
    '#promoBar a:hover .promo-cta{color:#9d5ff5;}',
    '#promoBar .promo-close{position:absolute;right:10px;top:50%;transform:translateY(-50%);background:transparent;border:none;cursor:pointer;color:#aaaaaa;font-size:1.5rem;line-height:1;padding:6px 10px;transition:color .2s;}',
    '#promoBar .promo-close:hover{color:#ffffff;}',
    '#promoBar .promo-close:focus-visible{outline:2px solid #9d5ff5;outline-offset:2px;}',
    '@media (max-width:700px){#promoBar .promo-desc{display:none}#promoBar a{gap:9px}#promoBar .promo-text{font-size:0.9rem}}',
    '@media (max-width:480px){#promoBar{height:40px;padding:0 38px 0 12px;justify-content:flex-start}#promoBar .promo-the{display:none}#promoBar .promo-cta{font-size:0.82rem}#promoBar .promo-close{right:2px;padding:6px 8px}}'
  ].join('');

  function ready(fn) {
    if (document.readyState !== 'loading') { fn(); }
    else { document.addEventListener('DOMContentLoaded', fn); }
  }

  ready(function () {
    if (document.getElementById('promoBar')) return;

    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    var bar = document.createElement('div');
    bar.id = 'promoBar';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Announcement');
    bar.innerHTML =
      '<a href="https://www.jonbjorkmusic.com/practiceroom?ref=promo-bar">' +
        '<span class="promo-new">Now Open</span>' +
        '<span class="promo-text"><span class="promo-the">The </span>Practice Room' +
        '<span class="promo-desc">: every course, the files and the Practice Lab, for one payment</span></span>' +
        '<span class="promo-cta">$297 one payment \u2192</span>' +
      '</a>' +
      '<button class="promo-close" aria-label="Dismiss announcement">\u00d7</button>';
    document.body.insertBefore(bar, document.body.firstChild);

    var shifted = [];
    function clearShift() {
      shifted.forEach(function (s) { s.el.style[s.prop] = ''; });
      shifted = [];
    }
    function applyShift() {
      clearShift();
      var h = bar.offsetHeight;
      var bodyPad = parseFloat(getComputedStyle(document.body).paddingTop) || 0;
      document.body.style.paddingTop = (bodyPad + h) + 'px';
      shifted.push({ el: document.body, prop: 'paddingTop' });
      var els = document.querySelectorAll('nav, .mobile-menu');
      Array.prototype.forEach.call(els, function (el) {
        var cs = getComputedStyle(el);
        if (cs.position === 'fixed') {
          var t = parseFloat(cs.top) || 0;
          el.style.top = (t + h) + 'px';
          shifted.push({ el: el, prop: 'top' });
        }
      });
    }
    applyShift();

    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(applyShift, 150);
    });

    bar.querySelector('.promo-close').addEventListener('click', function () {
      clearShift();
      bar.parentNode.removeChild(bar);
      try { localStorage.setItem(KEY, '1'); } catch (e) {}
    });
  });
})();
