/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

if (!window.MutationObserver) {
  window.MutationObserver = 
      window.WebKitMutationObserver || 
      window.JsMutationObserver;
  if (!MutationObserver) {
    throw new Error("no mutation observer support");
  }
}
