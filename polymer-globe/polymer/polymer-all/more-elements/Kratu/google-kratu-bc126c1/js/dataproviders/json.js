/**
 * @license Copyright 2013 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */



/**
 * A simple JSON loader
 * @constructor
 * @param {Object=} opt_options object to controll loader behavior.
 */
function KratuJsonProvider(opt_options) {
  'use strict';
  this.forceReload = opt_options && !!opt_options.forceReload ? true : false;
}


/**
 * Method to load and parse a JSON resource
 * @param {string} url for resource.
 * @param {Function} onSuccess called after successfully loaded a resource.
 * @param {Function=} opt_onError (optional) error handler.
 */
KratuJsonProvider.prototype.load = function(url, onSuccess, opt_onError) {
  'use strict';
  var xhr = new XMLHttpRequest();

  if (this.forceReload) {
    url += (url.match(/\?/) ? '&' : '?') +
            '__kratuTimestamp=' + new Date().getTime();
  }

  xhr.onload = function(e) {
    var data;
    try {
      data = JSON.parse(this.response);
    }
    catch (err) {
      throw 'Could not parse JSON from ' + url + ':\n' + err;
    }
    try {
      onSuccess(data);
    }
    catch (err) {
      throw 'Could not call callback with JSON from ' + url + ':\n' + err;
    }
  };
  xhr.onerror = opt_onError || function(err) {
    throw 'Could not call ' + url + ':\n' + err;
  };
  xhr.open('GET', url);
  xhr.send();
};
