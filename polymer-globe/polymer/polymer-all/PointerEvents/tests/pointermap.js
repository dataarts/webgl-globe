suite('PointerMap', function() {
  var PointerMap = PointerEventsPolyfill.PointerMap;
  test('PointerMap has Map API', function() {
    var keys = [
      'set',
      'get',
      'has',
      'delete',
      'size',
      'clear',
      'forEach'
    ];
    var e = expect(PointerMap.prototype);
    keys.forEach(function(k) {
      e.to.have.ownProperty(k);
    });
  });
  test('PointerMap .set', function() {
    var p = new PointerMap;
    p.set(1, true);
    if (PointerMap !== window.Map) {
      expect(p.ids).to.have.length(1);
      expect(p.pointers).to.have.length(1);
    }
    expect(p.size).to.equal(1);
  });
  test('PointerMap .get', function() {
    var p = new PointerMap;
  });
  test('PointerMap .size', function() {
    var p = new PointerMap;
    expect(p.size).not.to.be.a('function');
    expect(p.size).to.equal(0);
    p.set(1, true);
    expect(p.size).to.equal(1);
    p.set(1, false);
    expect(p.size).to.equal(1);
  });
  test('PointerMap .has', function() {
    var p = new PointerMap;
    p.set(1, true);
    expect(p.has(1)).to.equal(true);
    expect(p.has(0)).to.equal(false);
  });
  test('PointerMap .delete', function() {
    var p = new PointerMap;
    p.set(1, true);
    p.set(2, false);
    expect(p.size).to.equal(2);
    p.delete(1);
    expect(p.size).to.equal(1);
    expect(p.get(2)).to.equal(false);
  });
  test('PointerMap .clear', function() {
    var p = new PointerMap;
    p.set(1, true);
    p.clear();
    expect(p.size).to.equal(0);
  });
  test('PointerMap .forEach', function() {
    var p = new PointerMap;
    p.set(1, true);
    p.set(2, false);
    p.set(3, {});
    p.forEach(function(k, v, m) {
      expect(k).to.be.ok;
      expect(v).to.equal(p.get(k));
      expect(m).to.equal(p);
    });
  });
});
