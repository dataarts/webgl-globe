suite('Tap', function() {
  test('Up and Down', function(done) {
    prepare(target, 'tap', done);
    target.dispatchEvent(new PointerEvent('pointerdown', {isPrimary: true, pointerId: 1, bubbles: true}));
    target.dispatchEvent(new PointerEvent('pointerup', {isPrimary: true, pointerId: 1, bubbles: true}));
  });
});
