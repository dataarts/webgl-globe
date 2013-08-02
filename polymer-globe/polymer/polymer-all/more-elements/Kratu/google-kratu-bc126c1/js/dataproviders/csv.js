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
 * A simple CSV loader/parser provided with Kratu for convenience
 * @constructor
 * @param {Object=} opt_options object to controll parser behavior.
 */
function KratuCSVProvider(opt_options) {
  'use strict';
  this.forceReload = opt_options && !!opt_options.forceReload ? true : false;
}


/**
 * Method to load and parse a CSV resource
 * @param {string} url for resource.
 * @param {Function} onSuccess called after successfully loaded a resource.
 * @param {Function=} opt_onError (optional) error handler.
*/
KratuCSVProvider.prototype.load = function(url, onSuccess, opt_onError) {
  'use strict';
  var kratuCSVProvider = this;
  var xhr = new XMLHttpRequest();

  if (this.forceReload) {
    url += (url.match(/\?/) ? '&' : '?') +
        '__kratuTimestamp=' + new Date().getTime();
  }

  xhr.onload = function(e) {
    try {
      var data = [];
      kratuCSVProvider.parse(this.response, function(record) {
        if (record === null) {
          try {
            onSuccess(data);
          }
          catch (err) {
            throw 'Could not call callback with CSV from ' + url + ':\n' + err;
          }
        }
        else {
          data.push(record);
        }
      });
    }
    catch (err) {
      throw 'Could not parse CSV from ' + url + ':\n' + err;
    }
  };
  xhr.onerror = opt_onError || function(err) {
    throw 'Could not call ' + url + ':\n' + err;
  };
  xhr.open('GET', url);
  xhr.send();
};


/**
 * Method to parse a CSV string
 * @param {string} csv to be parsed.
 * @param {Function=} opt_callback (optional) called for each row of CSV data
 *   when EOF is reached, opt_callback is called with null.
 * @return {Array.<Object>} array of objects parsed from CSV.
 */
KratuCSVProvider.prototype.parse = function(csv, opt_callback) {
  'use strict';
  var cLength = csv.length;
  var isInQuotes = false;
  var currentColumnIdx = 0;
  var columns = [];
  var columnNames = [];
  var records = [];

  var extractColumn = function(from, to) {
    var deleteQuote = csv.charAt(to - 1) == '"' ? 1 : 0;
    var column = csv.substr(from, to - currentColumnIdx - deleteQuote);
    return column.replace(/\"\"/g, '"');
  };

  for (var i = 0; i < cLength; i++) {
    var character = csv.charAt(i);
    if ((character === '\r' || character === '\n') && !isInQuotes) {
      columns.push(extractColumn(currentColumnIdx, i));
      if (columnNames.length) {
        var record = {};
        for (var n = 0; n < columnNames.length; n++) {
          record[columnNames[n]] = columns[n];
        }
        if (opt_callback) {
          opt_callback(record);
        }
        else {
          records.push(record);
        }
      }
      else {
        columnNames = columns;
      }
      columns = [];
      if (i < cLength) {
        currentColumnIdx = i + 1;
      }
      // We have a \r\n line
      if (character === '\r' && csv.charAt(i + 1) === '\n') {
        i++;
      }
    }
    else if (character == '"') {
      if (isInQuotes && csv.charAt(i + 1) == '"') i++; // Found escaped "
      else if (isInQuotes) isInQuotes = false;       // End of quote
      else {
        isInQuotes = true;
        currentColumnIdx = i + 1;
      }
    }
    else if (character == ',' && !isInQuotes) {
      columns.push(extractColumn(currentColumnIdx, i));
      currentColumnIdx = i + 1;
    }
  }
  if (opt_callback) {
    opt_callback(null); // Indicates that this was the last record
  }
  else {
    return records;
  }
};
