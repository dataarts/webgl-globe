var expect = chai.expect;
chai.Assertion.includeStack = true;

mocha.setup({
  ui: 'tdd',
  slow: 1000,
  timeout: 30000
});

var target = document.createElement('div');
target.id = 'target';
target.setAttribute('touch-action', 'none');
document.body.appendChild(target);

function prepare(el, type, cb) {
  var f = function() {
    el.removeEventListener(type, arguments.callee);
    cb();
  }
  el.addEventListener(type, f);
}
