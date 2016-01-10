(function() {
  function selector(v) {
    return '[touch-action="' + v + '"]';
  }
  function rule(v) {
    return '{ -ms-touch-action: ' + v + '; touch-action: ' + v + '; }';
  }
  var attrib2css = [
    'none',
    'auto',
    'pan-x',
    'pan-y',
    {
      rule: 'pan-x pan-y',
      selectors: [
        'pan-x pan-y',
        'pan-y pan-x'
      ]
    }
  ];
  var styles = '';
  attrib2css.forEach(function(r) {
    if (String(r) === r) {
      styles += selector(r) + rule(r);
    } else {
      styles += r.selectors.map(selector) + rule(r.rule);
    }
  });
  var el = document.createElement('style');
  el.textContent = styles;
  // Use querySelector instead of document.head to ensure that in
  // ShadowDOM Polyfill that we have a wrapped head to append to.
  var h = document.querySelector('head');
  // document.write + document.head.appendChild = crazytown
  // use insertBefore instead for correctness in ShadowDOM Polyfill
  h.insertBefore(el, h.firstChild);
})();
