// Copyright 2013 The Polymer Authors. All rights reserved.
// Use of this source code is goverened by a BSD-style
// license that can be found in the LICENSE file.

(function(scope) {
  'use strict';

  var defineGetter = scope.defineGetter;
  var defineWrapGetter = scope.defineWrapGetter;
  var registerWrapper = scope.registerWrapper;
  var unwrapIfNeeded = scope.unwrapIfNeeded;
  var wrapNodeList = scope.wrapNodeList;
  var wrappers = scope.wrappers;

  var OriginalMutationObserver = window.MutationObserver ||
      window.WebKitMutationObserver;

  if (!OriginalMutationObserver)
    return;

  var OriginalMutationRecord = window.MutationRecord;

  function MutationRecord(impl) {
    this.impl = impl;
  }

  MutationRecord.prototype = {
    get addedNodes() {
      return wrapNodeList(this.impl.addedNodes);
    },
    get removedNodes() {
      return wrapNodeList(this.impl.removedNodes);
    }
  };

  ['target', 'previousSibling', 'nextSibling'].forEach(function(name) {
    defineWrapGetter(MutationRecord, name);
  });

  // WebKit/Blink treats these as instance properties so we override
  [
    'type',
    'attributeName',
    'attributeNamespace',
    'oldValue'
  ].forEach(function(name) {
    defineGetter(MutationRecord, name, function() {
      return this.impl[name];
    });
  });

  if (OriginalMutationRecord)
    registerWrapper(OriginalMutationRecord, MutationRecord);

  function wrapRecord(record) {
    return new MutationRecord(record);
  }

  function wrapRecords(records) {
    return records.map(wrapRecord);
  }

  function MutationObserver(callback) {
    var self = this;
    this.impl = new OriginalMutationObserver(function(mutations, observer) {
      callback.call(self, wrapRecords(mutations), self);
    });
  }

  var OriginalNode = window.Node;

  MutationObserver.prototype = {
    observe: function(target, options) {
      this.impl.observe(unwrapIfNeeded(target), options);
    },
    disconnect: function() {
      this.impl.disconnect();
    },
    takeRecords: function() {
      return wrapRecords(this.impl.takeRecords());
    }
  };

  scope.wrappers.MutationObserver = MutationObserver;
  scope.wrappers.MutationRecord = MutationRecord;

})(this.ShadowDOMPolyfill);
