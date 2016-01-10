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
 * The Kratu analysis engine
 * See examples/index.html for usage and more specifc information
 * @constructor
 */
function Kratu() {
  'use strict';
  var kratu = this;

  /**
   * Represents the report definition of this report
   * @private
   * @type {Object}
   */
  kratu.reportDefinition_ = null;

  /**
   * Entities to be analysed
   * @private
   * @type {Array<Object>}
   */
  kratu.entities_ = null;

  /**
   * Element containing the rendered report
   * @private
   * @type {Element}
   */
  kratu.renderElement_ = null;

  /**
   * State flag to tell wether we've already have a rendered report or not
   * @private
   * @type {boolean}
   */
  kratu.hasRendered_ = false;

  /**
   * Cache for already loaded scripts
   * @private
   * @type {Object<string,Element>}
   */
  kratu.loadedScripts_ = {};

  /**
   * The definitions of signals for this report
   * @private
   * @type {Object}
   */
  kratu.signalDefinitions_ = {};

  /**
   * The signals of this report
   * @private
   * @type {Array<KratuSignal>}
   */
  kratu.signals_ = [];

  /**
   * The disabled signals for this report
   * @private
   * @type {Object<string,boolean>}
   */
  kratu.disabledSignals_ = kratu.getPersistentSetting('disabledSignals', {});

  /**
   * Current page if using pagination
   * @private
   * @type {number}
   */
  kratu.currentPage_ = kratu.getPersistentSetting('currentPage', 1);

  /**
   * Page size if using pagination
   * @private
   * @type {number}
   */
  kratu.pageSize_ = null;

  /**
   * Sorted array of entities with calculated scores
   * @private
   * @type Array< {Object} >
   */
  kratu.calculatedEntities_ = [];

  /**
   * Array of summarylines to be rendered in the report
   * @private
   * @type Array< {Object} >
   */
  kratu.summaries_ = [];

  // Built in common presets
  kratu.formatters = kratu.getFormatters_();
  kratu.eventHandlers = kratu.getEventHandlers_();
  kratu.calculations = kratu.getCalculations_();
}


/**
 * Default heat map colors. Can be overriden by the report definition
 * @const {Object}
 */
Kratu.DEFAULT_HEAT_MAP = {
  neutral: 'rgb(255,255,255)',
  min: 'rgb(200,220,250)',
  max: 'rgb(0,160,200)'
};


/**
 * Collection of built in formatters
 * Used in initialization to expose formatters in the form kratu.formatters.*
 * @return {Object.<string, Function>} .
 * @private
 */
Kratu.prototype.getFormatters_ = function() {
  var kratu = this;
  return {
    'boolean': function(val, cell) {
      cell.classList.add('kratuCellTypeBoolean');
      return val && val !== '0' ? 'True' : 'False';
    },
    'decimal': function(val, cell, numDecimals) {
      if (val !== null && !isNaN(val)) {
        if (numDecimals === undefined) {
          numDecimals = 2;
        }
        cell.classList.add('kratuCellTypeFloatingPoint');
        return parseFloat(val).toFixed(numDecimals);
      }
      else {
        cell.classList.add('kratuCellTypeNaN');
        return NaN;
      }
    },
    'percentage': function(val, cell) {
      val = kratu.formatters.decimal(val, cell, 2);
      if (!isNaN(val)) {
        cell.classList.add('kratuCellTypePercentage');
        val += '%';
      }
      return val;
    },
    'money': function(val, cell) {
      cell.classList.add('kratuCellTypeMoney');
      if (val && !isNaN(val)) {
        var sign = (val < 0) ? '-' : '';
        var integer = parseInt(val = Math.abs(val).toFixed(2), 10) + '';
        var numThousands = (integer.length > 3) ? integer.length % 3 : 0;
        return sign +
            (numThousands ? integer.substr(0, numThousands) + ' ' : '') +
            integer.substr(numThousands).replace(/(\d{3})(?=\d)/g, '$1' + ' ') +
            '.' + Math.abs(val - integer).toFixed(2).slice(2);
      }
    },
    'singleDecimal': function(val, cell) {
      cell.classList.add('kratuCellTypeSingleDecimal');
      return kratu.formatters.decimal(val, cell, 1);
    },
    'integer': function(val, cell) {
      cell.classList.add('kratuCellTypeInteger');
      return kratu.formatters.decimal(val, cell, 0);
    },
    'string': function(val, cell) {
      cell.classList.add('kratuCellTypeString');
      return val ? val + '' : '';
    }
  };
};


/**
 * Collection of built in event handlers
 * Used in initialization to expose in the form kratu.eventHandlers.*
 * @return {Object.<string, Function>} .
 * @private
 */
Kratu.prototype.getEventHandlers_ = function() {
  var kratu = this;
  return {
    toggleSignal: function(args) {
      kratu.toggleSignal(args.signal.key);
    },
    adjustSignal: function(args) {
      args.evt.preventDefault();
      kratu.displaySignalAdjustment(args.signal);
    }
  };
};


/**
 * Collection of built in score calculations
 * Used in initialization to expose in the form kratu.calculations.*
 * @return {Object.<string, Function>} .
 * @private
 */
Kratu.prototype.getCalculations_ = function() {
  var kratu = this;

  // Method to create a ranking function.
  // Direction can be 1 (small to large) or 0 (large to small)
  var createRankingCalculation = function(direction) {
    return function(entity) {
      var signal = this;
      var key = signal.key;
      // If we don't have the min and max values for this signal, let's iterate
      // and find them and store them in kratu.calculationsRankings_
      if (!kratu.calculationsRankings_) {kratu.calculationsRankings_ = {};}
      if (!kratu.calculationsRankings_[key]) {
        kratu.calculationsRankings_[key] = {};
        var max, min;
        var entities = kratu.getEntities();
        for (var i = 0; i < entities.length; i++) {
          var value = entities[i][key];
          if (max === undefined || value > max) { max = parseFloat(value); }
          if (min === undefined || value < min) { min = parseFloat(value); }
        }
        kratu.calculationsRankings_[key].max = max;
        kratu.calculationsRankings_[key].min = min;
      }

      var rank = kratu.calculationsRankings_[key];
      // On the scale of min to max, where is this entity (percentagwise)?
      // 0.00 == min, 1.00 == max, multiplied with the signal's weight
      if (rank.max === 0 && rank.min === 0) {return 0;}
      else {
        var relativeRank = (entity[key] - rank.min) / (rank.max - rank.min);
        return Math.abs(relativeRank - direction) * (signal.weight / 100);
      }
    };
  };

  var sumScore = function(entity) {
    return function(summary) {
      return summary.sumScore / summary.sumWeights;
    };
  };

  return {
    // sumScore can be used to return the overall weight for this entity
    sumScore: sumScore,
    // ranking can be used to give a relative (percentage) ranking
    // of this entity for the signal in question
    rankSmallToLarge: createRankingCalculation(1),
    rankLargeToSmall: createRankingCalculation(0)
  };
};


/**
 * Method for setting a persistent setting
 * @see #getPersistentSetting
 * @param {string} key to get setting for.
 * @param {string|number|Object} value to be stored - is JSON.stringify'ed.
 */
Kratu.prototype.setPersistentSetting = function(key, value) {
  if (!window.localStorage) {
    console.warn('window.localStorage not available');
  }
  else {
    window.localStorage[key] = JSON.stringify(value);
  }
};


/**
 * Method for getting a persistent setting
 * @see #setPersistentSetting
 * @param {string} key to get setting for.
 * @param {*} ifNull to be returned if no persistent value for key is found
 *   use this for fallback/defaults.
 * @return {*} JSON.parse'ed value.
 */
Kratu.prototype.getPersistentSetting = function(key, ifNull) {
  if (!window.localStorage) {
    console.warn('window.localStorage not available');
  }
  else {
    if (window.localStorage[key]) {
      return JSON.parse(window.localStorage[key]);
    }
    else {
      return ifNull || null; // Allow specifying return val if key not found
    }
  }
};


/**
 * Setter for report definition
 * See example and general documentation for structure of report definition
 * @param {Object} report containing report.
 * @param {Function=} opt_callback (optional), called when report is loaded.
 */
Kratu.prototype.setReportDefinition = function(report, opt_callback) {
  var kratu = this;
  if (!report) throw 'No reportDefinition supplied';
  if (!opt_callback instanceof Function) {
    console.warn('No callback supplied - might run into race conditions');
  }

  // Since the ReportDefinition might define an external SignalDefinition
  // which are loaded asynchronously, we create a function to avoid DRY
  var setReport_ = function() {
    kratu.setSignals(report.signals);
    kratu.reportDefinition_ = report;
    if (opt_callback) {
      opt_callback();
    }
  };

  // If we have a signalDefinitionUrl in the reportDefinition, let's load it
  if (report.signalDefinitionUrl) {
    try {
      kratu.loadScript(report.signalDefinitionUrl, function() {
        try {
          kratu.signalDefinitions_ = new KratuSignalDefinitions(kratu);
        }
        catch (err) {
          throw 'Could not instantiate the KratuSignalDefinitions: ' + err;
        }
        setReport_();
      });
    }
    catch (err) {
      throw 'Could not load script ' + report.signalDefinitionUrl + ' ' + err;
    }
  }
  // Otherwise each signal is defined directly in the reportDefinition
  else {
    kratu.signalDefinitions_ = {};
    setReport_();
  }
};


/**
 * Getter for report definition
 * See example and general documentation for structure of report definition
 * @return {Object} containing report.
 */
Kratu.prototype.getReportDefinition = function() {
  var kratu = this;
  return kratu.reportDefinition_;
};


/**
 * Setter for signals
 * Usually never set manually, use the report definition/signal definition
 * @param {Array.<Object>} signals containing signal objects.
 */
Kratu.prototype.setSignals = function(signals) {
  var kratu = this;
  if (!signals || !signals instanceof Array || !signals[0] instanceof Object) {
    throw 'No signals found';
  }
  if (!kratu.signalDefinitions_) {
    throw 'Need to have a signal definition before adding signals';
  }
  for (var i = 0; i < signals.length; i++) {
    var signalKey = signals[i].key;
    var signalDefinition = {name: signalKey};
    // Use signals in signalDefinition as starting point
    for (var defKey in kratu.signalDefinitions_[signalKey]) {
      signalDefinition[defKey] = kratu.signalDefinitions_[signalKey][defKey];
    }
    // Set (and maybe override) key/values in signal definiton from profile
    for (var reportKey in signals[i]) {
      signalDefinition[reportKey] = signals[i][reportKey];
    }
    var signal = new KratuSignal(signalDefinition);
    kratu.signals_.push(signal);
  }
};


/**
 * Getter for signals
 * @return {Array.<Object>} containing signal objects.
 */
Kratu.prototype.getSignals = function() {
  var kratu = this;
  return kratu.signals_;
};


/**
 * Setter for pageSize
 * Setting to 0 or null clears the pageSize
 * @param {number=} opt_pageSize containing signal objects.
 */
Kratu.prototype.setPageSize = function(opt_pageSize) {
  var kratu = this;
  kratu.pageSize_ = opt_pageSize;
};


/**
 * Getter for pageSize
 * @return {number} or null if no pageSize is set.
 */
Kratu.prototype.getPageSize = function() {
  var kratu = this;
  return kratu.pageSize_;
};


/**
 * Method for explicitly clear the pageSize
 */
Kratu.prototype.clearPageSize = function() {
  var kratu = this;
  kratu.pageSize_ = null;
};


/**
 * Method for getting the calculated number of pages
 * (No setter available as this is derived from number of entites / pageSize.)
 * @return {number} number of pages.
 */
Kratu.prototype.getNumPages = function() {
  var kratu = this;
  var numEntities = kratu.getNumEntities();
  var pageSize = kratu.getPageSize();
  if (numEntities <= 0) {
    throw 'Need atleast one entity in order to calculated number of pages';
  }
  if (!pageSize) {
    throw 'Need to set a page size in order to calculated number of pages';
  }
  return Math.ceil(numEntities / pageSize);
};


/**
 * Setter for currentPage
 * Affects render(Current|Previous|Next)Page
 * @param {number} currentPage 1-indexed page number
 *  Can be negative, abs(currentPage) must be <= to getNumPages.
 */
Kratu.prototype.setCurrentPage = function(currentPage) {
  var kratu = this;
  var numPages = kratu.getNumPages();
  if (currentPage === null || currentPage === 0) {
    throw 'Page cannot be null/0';
  }
  else if (Math.abs(currentPage) > numPages) {
    throw 'Page is bigger than number of pages';
  }
  else if (currentPage < 0) { // If negative, count backwards
    kratu.currentPage_ = numPages + currentPage;
  }
  else {
    kratu.currentPage_ = currentPage;
  }
  kratu.setPersistentSetting('currentPage', kratu.currentPage_);
};


/**
 * Getter for currentPage
 * Defaults to 1 if nothing is specified
 * @return {number} current page number, 1 indexed.
 */
Kratu.prototype.getCurrentPage = function() {
  var kratu = this;
  return kratu.currentPage_;
};


/**
 * Setter of flag wether we have rendered a report
 * @param {boolean} value rendered = true.
 * @private
 */
Kratu.prototype.setHasRendered_ = function(value) {
  var kratu = this;
  kratu.hasRendered_ = value;
};


/**
 * Getter of flag wether we have rendered a report
 * @return {boolean} rendered = true.
 */
Kratu.prototype.getHasRendered = function() {
  var kratu = this;
  return kratu.hasRendered_;
};


/**
 * Setter of Element to be rendered to
 * @param {Element} elm If not a TABLE elm, will create.
 */
Kratu.prototype.setRenderElement = function(elm) {
  if (!elm || !elm.tagName) {
    throw 'Need a HTML element to set a render element';
  }
  var kratu = this;
  if (elm.tagName !== 'TABLE') {
    var parent = elm;
    elm = document.createElement('table');
    parent.appendChild(elm);
  }
  if (!elm.classList.contains('kratuReportTable')) {
    elm.classList.add('kratuReportTable');
  }
  kratu.renderElement_ = elm;
};


/**
 * Getter of render element
 * @return {Element} Note: Can be different to setElement.
 * @see #setRenderElement
 */
Kratu.prototype.getRenderElement = function() {
  var kratu = this;
  return kratu.renderElement_;
};


/**
 * Setter of the entities
 * These are the objects you want analyzed
 * @param {Array.<Object>} entities array if objects.
 */
Kratu.prototype.setEntities = function(entities) {
  var kratu = this;
  kratu.entities_ = entities;
};


/**
 * Getter of the entities
 * @return {Array.<Object>} the entities.
 */
Kratu.prototype.getEntities = function() {
  var kratu = this;
  return kratu.entities_;
};


/**
 * Get the number of entities currently in the analysis
 * @return {number} convenience method for calculating the number of entities.
 */
Kratu.prototype.getNumEntities = function() {
  var kratu = this;
  if (!kratu.entities_) {
    return 0;
  }
  return kratu.entities_.length;
};


/**
 * Setter of calculated (analyzed) entities
 * @see #calculateEntities_
 * @param {Array.<Object>} entities with score/value for each calculated entity.
 * @private
 */
Kratu.prototype.setCalculatedEntities_ = function(entities) {
  var kratu = this;
  kratu.calculatedEntities_ = entities;
};


/**
 * Getter of calculated (analyzed) entities
 * @see #calculateEntities_
 * @return {Array.<Object>} entities w score/value for each calculated entity.
 * @private
 */
Kratu.prototype.getCalculatedEntities_ = function() {
  var kratu = this;
  return kratu.calculatedEntities_;
};


/**
 * Setter of calculated (analyzed) summaries
 * @see #calculateSummaries_
 * @param {Array.<Object>} summary with score/value for summary-line.
 * @private
 */
Kratu.prototype.setSummaries_ = function(entities) {
  var kratu = this;
  kratu.summaries_ = entities;
};


/**
 * Getter of calculated (analyzed) summaries
 * @see #calculateSummaries_
 * @return {Array.<Object>} summary with score/value for summary-line.
 * @private
 */
Kratu.prototype.getSummaries_ = function() {
  var kratu = this;
  return kratu.summaries_;
};


/**
 * Method for rendering a specific page
 * @see #setPageSize
 * @param {number=} opt_pageNumber - if no page number supplied renders page 1.
 * @param {Function=} opt_callback to be called when rendering is finished.
 */
Kratu.prototype.renderPage = function(opt_pageNumber, opt_callback) {
  var kratu = this;
  if (opt_pageNumber === null) {
    if (!opt_pageNumber) {
      opt_pageNumber = 1;
      console.warn('No pageNumber supplied, using 1');
    }
  }
  kratu.setCurrentPage(opt_pageNumber);
  var to = (kratu.getPageSize() * kratu.getCurrentPage() - 1);
  if (opt_pageNumber == kratu.getNumPages()) {
    to = kratu.getNumEntities();
  }
  kratu.render_({
    from: kratu.getPageSize() * (kratu.getCurrentPage() - 1),
    to: to,
    callback: opt_callback,
    keepHeader: true
  });
};


/**
 * Method for rendering the currentPage
 * @see #setPageSize
 * @see #setCurrentPage
 * @param {Function=} opt_callback to be called when rendering is finished.
 */
Kratu.prototype.renderCurrentPage = function(opt_callback) {
  var kratu = this;
  if (!kratu.getCurrentPage()) {
    kratu.setCurrentPage(1);
  }
  kratu.renderPage(kratu.getCurrentPage(), opt_callback);
};


/**
 * Method for rendering the previousPage
 * @see #setPageSize
 * @see #setCurrentPage
 * @param {Function=} opt_callback to be called when rendering is finished.
 */
Kratu.prototype.renderPreviousPage = function(opt_callback) {
  var kratu = this;
  var pageNumber = kratu.getCurrentPage();
  if (pageNumber == 1) {
    throw 'Already on the first page';
  }
  kratu.renderPage(pageNumber - 1, opt_callback);
};


/**
 * Method for rendering the nextPage
 * @see #setPageSize
 * @see #setCurrentPage
 * @param {Function=} opt_callback to be opt_called when rendering is finished.
 */
Kratu.prototype.renderNextPage = function(opt_callback) {
  var kratu = this;
  var pageNumber = kratu.getCurrentPage();
  if (pageNumber == kratu.getNumPages()) {
    throw 'Already on the last page';
  }
  kratu.renderPage(pageNumber + 1, opt_callback);
};


/**
 * Method for rendering the entire report
 * @param {Function=} opt_callback to be called when rendering is finished.
 */
Kratu.prototype.renderReport = function(opt_callback) {
  var kratu = this;
  // In case we have already rendered a page, clear
  if (kratu.getHasRendered()) {
    kratu.clearReport();
  }
  kratu.render_({callback: opt_callback});
};


/**
 * Method for updating a rendered report/page
 * Use this to recalculate and re-render the report
 * @param {Function=} opt_callback to be called when rendering is finished.
 */
Kratu.prototype.updateReport = function(opt_callback) {
  var kratu = this;
  kratu.clearReport(); // Clear everything
  if (kratu.getPageSize() > 0) { // We're paginating
    kratu.renderPage(kratu.getCurrentPage(), opt_callback);
  }
  else {
    kratu.render_({callback: opt_callback, keepHeader: true});
  }
};


/**
 * Method used to do the actual rendering
 * @private
 * @param {Object} options for controlling render behaviour.
 */
Kratu.prototype.render_ = function(options) {
  var kratu = this;
  kratu.assertAbleToRender();

  // Unless we have a reportDefinition, we create a minimal
  // reportDefinition based on the first object
  if (!kratu.getReportDefinition()) {
    var entities = kratu.getEntities();
    var signalKeys = [];
    for (var key in entities[0]) {
      signalKeys.push({key: key});
    }
    kratu.setReportDefinition({signals: signalKeys});
  }

  if (kratu.getHasRendered()) {
    kratu.clearReport(options.keepHeader);
  }
  else {
    kratu.renderReportHeadings_();
    kratu.calculateEntities_();
    kratu.calculateSummaries_();
  }

  var from = 0;
  var to = kratu.getNumEntities();
  if ('from' in options && 'to' in options) {
    from = options.from;
    to = options.to;
  }
  kratu.renderReportEntities_(from, to);

  kratu.setHasRendered_(true);
  if (options.callback instanceof Function) {
    options.callback();
  }
};


/**
 * Method used to render headings
 * @private
 */
Kratu.prototype.renderReportHeadings_ = function() {
  var kratu = this;

  var headerRow = document.createElement('tr');
  var signals = kratu.getSignals();

  for (var i = 0; i < signals.length; i++) {
    var signal = signals[i];
    var signalHeader = document.createElement('th');
    signalHeader.appendChild(kratu.createRotatedElement(signal.name));

    if (kratu.disabledSignals_[signal.key]) {
      signalHeader.classList.toggle('disabled');
    }
    if (signal.headerEventHandlers) {
      kratu.addEventHandlers(signalHeader,
          signal.headerEventHandlers,
          {signal: signal}
      );
    }
    headerRow.appendChild(signalHeader);
  }
  kratu.getRenderElement().appendChild(headerRow);
};


/**
 * Method used to render entities
 * @param {number} from start of entities to render.
 * @param {number} to end of entities to render.
 * @private
 */
Kratu.prototype.renderReportEntities_ = function(from, to) {
  var kratu = this;

  var signals = kratu.getSignals();
  var renderElement = kratu.getRenderElement();

  var renderRow = function(entity, className, location) {
    var row = document.createElement('tr');
    for (var sN = 0; sN < signals.length; sN++) {
      var cell = document.createElement('td');
      var signal = signals[sN];
      if (kratu.disabledSignals_[signal.key]) {
        cell.classList.add('disabled');
      }
      else if ('score' in entity[sN]) {
        kratu.colorizeElement(cell, entity[sN].score);
      }
      if ('format' in entity[sN]) { // Special cases handled here
        if (entity[sN].format instanceof Function) {
          cell.textContent = entity[sN].format(entity[sN].value, cell);
        }
        else {
          cell.textContent = entity[sN].value;
        }
      }
      else {
        var value = signal.formatData(entity[sN].value, cell);
        if (value !== null) {
          cell.textContent = value;
        }
      }
      if (signal.cellEventHandlers) {
        kratu.addEventHandlers(cell, signal.cellEventHandlers, {
          signal: signal,
          entity: entity,
          score: entity[sN].score,
          value: entity[sN]
        });
      }
      row.appendChild(cell);
    }
    row.classList.add(className);
    if (location === 'top') {
      renderElement.firstChild.insertAdjacentElement('afterEnd', row);
    }
    else {
      renderElement.appendChild(row);
    }
  };
  var entities = kratu.getCalculatedEntities_();
  for (var i = from; i < to; i++) {
    renderRow(entities[i], 'kratuEntityRow', 'bottom');
  }
  var summaries = kratu.getSummaries_();
  for (var i = 0; i < summaries.length; i++) {
    renderRow(summaries[i].row, summaries[i].className, summaries[i].location);
  }
};


/**
 * Method used to calculate scores for all entities
 * @see #getCalculatedEntities_
 * @private
 */
Kratu.prototype.calculateEntities_ = function() {
  var kratu = this;

  var signals = kratu.getSignals();
  var entities = kratu.getEntities();
  var calculatedEntities = [];
  var callbackTypes = {value: 'value', score: 'score'}; // Enum
  var sumWeights = 0.0;

  signals.forEach(function(signal) {
    sumWeights += signal.weight / 100;
  });

  for (var eN = 0; eN < entities.length; eN++) {
    var entity = entities[eN];
    var calculatedEntity = [];
    var sumScore = 0.0;
    var summaryCallbacks = [];

    for (var sN = 0; sN < signals.length; sN++) {
      var signal = signals[sN];
      var score = 0.0;
      if (!kratu.disabledSignals_[signal.key]) {
        score = signal.calculateWeight(entity);
      }
      var calculatedSignal = {};
      // If we're returned a function, we will call this function with the sum
      // of the scores and weights after the other signals has been processed
      if (score instanceof Function) {
        summaryCallbacks.push({
          type: callbackTypes.score,
          position: sN,
          callback: score
        });
      }
      else {
        calculatedSignal.score = score;
        sumScore += score;
      }
      var value = signal.getData(entity);
      // If we're returned a function, we will call this function with the sum
      // of the scores and weights after the other signals has been processed
      if (value instanceof Function) {
        summaryCallbacks.push({
          type: callbackTypes.value,
          callback: value
        });
      }
      else {
        calculatedSignal.value = value;
      }
      calculatedEntity[sN] = calculatedSignal;
    }
    // Call callbacks, overriding score and/or value on the signals at position
    for (var scN = 0; scN < summaryCallbacks.length; scN++) {
      var callback = summaryCallbacks[scN];
      var callbackTypeName = callbackTypes[callback.type];
      calculatedEntity[callback.position][callbackTypeName] =
          callback.callback({sumScore: sumScore, sumWeights: sumWeights});
    }
    calculatedEntities.push({
      score: sumScore,
      calculatedEntity: calculatedEntity
    });
  }

  calculatedEntities.sort(function(a, b) {
    return (b.score - a.score);
  });
  var sortedCalculatedEntities = [];
  calculatedEntities.forEach(function(n) {
    sortedCalculatedEntities.push(n.calculatedEntity);
  });
  kratu.setCalculatedEntities_(sortedCalculatedEntities);
};


/**
 * Method used to calculate all summaries
 * @return {Array.<Object>} with all summaries.
 * @private
 */
Kratu.prototype.calculateSummaries_ = function() {
  var kratu = this;

  var entities = kratu.getCalculatedEntities_();
  var signals = kratu.getSignals();
  if (!entities) {
    throw 'No calculatedEntities found';
  }
  var summaryRows = [];
  // Add any additional "summary entities" as defined by the reportDefinition
  var reportDefinition = kratu.getReportDefinition();
  if (reportDefinition.summaryRows &&
      reportDefinition.summaryRows instanceof Array &&
      reportDefinition.summaryRows.length > 0) {
    var sumScores = 0.0;
    var sumWeights = 0.0;
    var signalsValueSum = {};
    var signalsScoreSum = {};

    for (var i = 0; i < signals.length; i++) {
      var signal = signals[i];
      sumWeights += signal.weight / 100;
      signalsValueSum[signal.key] = 0.0;
      signalsScoreSum[signal.key] = 0.0;
      entities.forEach(function(entity) {
        var value = parseInt(entity[i].value, 10);
        if (isNaN(value)) {
          value = 0.0;
        }
        signalsValueSum[signal.key] += value;
        signalsScoreSum[signal.key] += entity[i].score;
        sumScores += entity[i].score;
      });
    }

    var averageScore = sumScores / entities.length / sumWeights;
    for (i = 0; i < reportDefinition.summaryRows.length; i++) {
      var rowDef = reportDefinition.summaryRows[i];
      var summaryRow = [];

      var className = 'kratu' +
          rowDef.type.charAt(0).toUpperCase() +
          rowDef.type.slice(1);

      for (var sN = 0; sN < signals.length; sN++) {
        var signal = signals[sN];
        var summaryCell = {};
        if (rowDef.replaceColumns && signal.key in rowDef.replaceColumns) {
          var replace = rowDef.replaceColumns[signal.key];
          if ('calculate' in replace) {
            if (replace.calculate === 'averageScore') {
              summaryCell.value = averageScore * 100;
              summaryCell.score = averageScore;
              summaryCell.format = kratu.formatters.percentage;
            }
            else if (replace.calculate === 'numEntities') {
              summaryCell.value = entities.length;
            }
            else {
              throw replace.calculate +
                  ' is not a valid calculation type in column replacement';
            }
          }
          if ('string' in replace) {
            summaryCell.value = replace.string;
            summaryCell.format = null;
          }
        }
        else {
          if (rowDef.type === 'average') {
            summaryCell.value = signalsValueSum[signal.key] / entities.length;
            summaryCell.score = signalsScoreSum[signal.key] / entities.length;
          }
          else if (rowDef.type === 'sum') {
            summaryCell.value = signalsValueSum[signal.key];
          }
        }
        summaryRow.push(summaryCell);
      }
      summaryRows.push({
        row: summaryRow,
        className: className,
        location: rowDef.location
      });
    }
  }
  kratu.setSummaries_(summaryRows);
};


/**
 * Method for turning off/on a signal
 * Signal state is stored in persistent settings
 * @param {string} key to signal to be turned off/on.
 */
Kratu.prototype.toggleSignal = function(key) {
  var kratu = this;
  kratu.disabledSignals_[key] = !kratu.disabledSignals_[key];
  kratu.setPersistentSetting('disabledSignals', kratu.disabledSignals_);
  kratu.updateReport();
};


/**
 * Method for showing signal adjustments
 * @see kratuSignalAdjustments.js
 * @param {string} signal to be adjusted.
 */
Kratu.prototype.displaySignalAdjustment = function(signal) {
  var kratu = this;
  kratu.loadScript('../../js/kratuSignalAdjustments.js', function() {
    // Consider moving this to KratuSignalAdjustements.js
    kratu.loadScript('https://www.google.com/jsapi', function() {
      var adjustments = new KratuSignalAdjustments(kratu);
      adjustments.displayAdjustments(signal, function() {
        kratu.updateReport();
      });
    });
  });
};


/**
 * Method for attaching event handlers to an element
 * @param {Element} elm to attach the element.
 * @param {Object.<string,Function>} handlers list of handlers to attach.
 * @param {Object} args arguments to pass to the event handler.
 */
Kratu.prototype.addEventHandlers = function(elm, handlers, args) {
  var kratu = this;

  if (!elm || !elm.tagName) {
    throw 'Need a HTML element to add an event handler';
  }
  if (!handlers instanceof Object) {
    throw 'Eventhandler not an object';
  }
  var createEventTypeHandler = function(eventType) {
    return function(evt) {
      args.evt = evt;
      args.elm = elm;
      handlers[eventType].call(kratu, args);
    };
  };
  for (var eventType in handlers) {
    try {
      elm.addEventListener(
          eventType,
          createEventTypeHandler(eventType),
          false
      );
    }
    catch (err) {
      throw "Could not add handler '" + eventType + "': " + err;
    }
  }
};


/**
 * Method for exporting the report in various formats
 * @param {string} type to return, valid values is html, csv, json or object.
 * @return {string} report as specified by the type.
 */
Kratu.prototype.getReportAs = function(type) {
  // TODO Change from string to enum
  var kratu = this;
  if (type === 'html') {
    if (!kratu.getHasRendered()) { // TODO Consider doing an anonymous render
      throw 'Data needs to be rendered first';
    }
    return kratu.getRenderElement().outerHTML;
  }
  else {
    var calculatedEntities = kratu.getCalculatedEntities_();
    if (!calculatedEntities) {
      throw 'Data needs to be calculated first';
    }

    var headerRow = [];
    var signals = kratu.getSignals();

    signals.forEach(function(signal) {
      headerRow.push(signal.name);
    });
    var dataForExport = [headerRow];

    calculatedEntities.forEach(function(entity) {
      var dataRow = [];
      entity.forEach(function(column) {
        dataRow.push(column.value);
      });
      dataForExport.push(dataRow);
    });

    var summaries = kratu.getSummaries_();
    summaries.forEach(function(summary) {
      var summaryRow = [];
      summary.row.forEach(function(column) {
        summaryRow.push(column.value);
      });
      if (summary.location == 'top') {
        dataForExport.splice(1, 0, summaryRow);
      }
      else {
        dataForExport.push(summaryRow);
      }
    });

    if (type === 'csv') {
      // Iterate all rows
      var csvDump = dataForExport.map(function(row) {

        // Iterate each column in a row
        return row.map(function(column) {
          if (column === undefined) {
            column = '';
          }

          // Convert to string and replace " with ""
          column = column.toString().replace(/\"/, '""');

          // If column contains , "" or white-space; quote it
          return column.match(/\s|\"\"|,/) ? '"' + column + '"' : column;

          // Join all columns by comma and all rows by newline
        }).join(',');
      }).join('\n');
      return csvDump;
    }
    else if (type === 'json') {
      return JSON.stringify(dataForExport);
    }
    else if (type === 'object') {
      return dataForExport;
    }
    else {
      throw 'Not a valid type. Valid types are html, csv, json, object';
    }
  }
};


/**
 * Method for colorizing a html element based on a score
 * @param {Element} cell to be colorized.
 * @param {number} score a score between 0.0 - 1.0.
 */
Kratu.prototype.colorizeElement = function(cell, score) {
  var kratu = this;
  if (!cell || !cell.tagName) {
    throw "Can't mark cell = not a HTML element";
  }

  cell.title = parseFloat(score * 100).toFixed(2) + '%';
  var colors = kratu.getReportDefinition().heatMapColors;
  if (!colors) {
    colors = Kratu.DEFAULT_HEAT_MAP;
  }

  if (score === undefined || score === null || score === 0) {
    cell.style.background = colors.neutral;
    cell.classList.add('kratuNeutralScore');
    return;
  }

  // Parse and replace variables if not already done
  if (typeof colors.max == 'string') {
    colors.max.match(/^rgb\((\d+),(\d+),(\d+)\)/);
    colors.max = {r: RegExp.$1, g: RegExp.$2, b: RegExp.$3};
    colors.min.match(/^rgb\((\d+),(\d+),(\d+)\)/);
    colors.min = {r: RegExp.$1, g: RegExp.$2, b: RegExp.$3};
  }

  var color = [];
  ['r', 'g', 'b'].forEach(function(cName) {
    var cValue = colors.max[cName] * score + colors.min[cName] * (1 - score);
    color.push(parseInt(cValue, 10));
  });
  cell.style.background = 'rgb(' + color.join(',') + ')';
};


/**
 * Method for clearing a report
 * @param {boolean} keepHeader flag to indicate wether to keep the header.
 */
Kratu.prototype.clearReport = function(keepHeader) {
  var kratu = this;
  kratu.assertAbleToClear();
  var elmsToKeep = keepHeader ? 1 : 0;
  var reportElm = kratu.getRenderElement();
  while (reportElm.childElementCount > elmsToKeep) {
    reportElm.removeChild(reportElm.lastChild);
  }
  kratu.setHasRendered_(false);
};


/**
 * Method for asserting that we actually have something to clear
 * Throws an exception if nothing to clear
 */
Kratu.prototype.assertAbleToClear = function() {
  var kratu = this;
  if (!kratu.getHasRendered()) throw "Can't clear: Nothing rendered";
};


/**
 * Method for asserting that we have everything needed to render.
 * Throws an exception if not
 */
Kratu.prototype.assertAbleToRender = function() {
  var kratu = this;
  if (!kratu.getRenderElement()) throw "Can't render: No render element set";
  if (!kratu.getEntities()) throw "Can't render: No entities set";
};


/**
 * Method for loading a script
 * @param {string} url of script to be loaded.
 * @param {Function=} opt_callback to be called once loaded.
 */
Kratu.prototype.loadScript = function(url, opt_callback) {
  var kratu = this;
  var scriptElm;
  if (kratu.loadedScripts_[url]) {
    scriptElm = kratu.loadedScripts_[url];
  }
  else {
    scriptElm = document.createElement('script');
    scriptElm.type = 'text/javascript';
  }
  if (opt_callback instanceof Function) {
    scriptElm.onload = function() {
      opt_callback();
    };
  }

  // Force reloading of resources by adding a timestamp to the URL
  url += (url.match(/\?/) ? '&' : '?') +
      '__kratuTimeStamp=' +
      new Date().getTime();

  scriptElm.src = url;
  if (!kratu.loadedScripts_[url]) {
    kratu.loadedScripts_[url] = scriptElm;
    document.getElementsByTagName('head')[0].appendChild(scriptElm);
  }
};


/**
 * Method for creating a 90 degree rotated SVG text element
 * CSS doesn't correctly adjust space in a rotated element within a table cell
 * @param {string} title to be rotated.
 * @return {Element} SVG element with rotated text.
 */
Kratu.prototype.createRotatedElement = function(title) {
  var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', 28);
  svg.setAttribute('height', 164);

  if (!title) {
    return svg;
  }

  function createSvgText(content, x, y) {
    var text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', x);
    text.setAttribute('y', y);
    text.setAttribute('transform', 'rotate(90)');
    text.textContent = content;
    return text;
  }

  var last = title.split(/\s+/);
  var first = last.splice(0, Math.ceil(last.length / 2));

  svg.appendChild(createSvgText(first.join(' '), 5, -15));
  svg.appendChild(createSvgText(last.join(' '), 5, -2));

  return svg;
};



/**
 * Class representing a single KratuSignal
 * @constructor
 * @param {Object} signalDefinition - can either come directly
 *  from the report definition or the signal definition reference in the report
 *  signalDefinition can consist of the following key/values:
 *  key : String - mandatory, identifying name of the signal
 *  name : String - optional, descriptive name of signal
 *  getData : Function - optional, method that will be called to get the data
 *    for this signal. If not provided, the signals key will be used to lookup
 *    the corresponding value in the account-object
 *  weight : Float - optional, Maximal impact signal can represent (0.0 - 100.0)
 *  lMax : Float - optional, lowest point of low threshold where signal
 *    yields maximum opportunity. When getData <= lMax, calc. weight = weight
 *  lMin : Float - optional, lowest point of high threshold where signal
 *    yields minimum opportunity.
 *    When getData > lMin (and < hMin, if defined), calculated weight = 0
 *  hMin : Float - optional, lowest point of high threshold where signal
 *    yields minimum opportunity.
 *    When getData < hMin (and > lMin, if defined), calculated weight = 0
 *  hMax : Float - optional, highest point of high threshold where signal
 *    yields maximum opportunity.
 *    When getData >= hMax, calculated weight = weight
 *  scaleExponent : float - optional, used to ease the curve between
 *    lMax/lMin and hMin/hMax - see adjustment of signal to visualize.
 *  range : Object - optional, provides boundaries for adjusting the signal and
 *    should contain an object with a min, max and step key/value
 *  format : Function - optional, function that takes the return
 *    data from getData as first argument
 *  isBoolean : Boolean - optional, flag to show that this is a boolean signal
 *  hasCalculation : Function - optional, method that determines wether to
 *    calculate a score for this signal
 *  calculateWeight : Function - optional, overridable method for
 *    calculating the score for this signal.
 */
function KratuSignal(signalDefinition) {
  var kratuSignal = this;
  var createGetDataClosure = function(dataKey) {
    return function(entity) {
      return entity[dataKey];
    };
  };
  var hasCalculation = function() {
    if (kratuSignal.weight === null) {
      return false;
    }
    return true;
  };

  // First, setup default values
  kratuSignal.scaleExponent = 2;
  kratuSignal.isBoolean = false;
  kratuSignal.weight = null;
  kratuSignal.lMax = null;
  kratuSignal.lMin = null;
  kratuSignal.hMin = null;
  kratuSignal.hMax = null;
  kratuSignal.getData = createGetDataClosure(signalDefinition.key);
  kratuSignal.hasCalculation = hasCalculation;

  // Then, override with the definitions supplied
  for (var key in signalDefinition) {
    kratuSignal[key] = signalDefinition[key];
  }
  if (kratuSignal.name === null) {
    kratuSignal.name = signalDefinition.key;
  }
}


/**
 * Method for kicking of the formatting a value and it's corresponding cell
 * If the signal defines a format function, this will be called.
 * @see #getFormatters_
 * @param {number|string} the value to apply formatting to.
 * @param {Element} the table cell to apply formatting to.
 * @return {number|string} with potentially formatted value.
 */
KratuSignal.prototype.formatData = function(unformatedValue, cell) {
  var kratuSignal = this;
  if (kratuSignal.format instanceof Function) {
    return kratuSignal.format(unformatedValue, cell);
  }
  else {
    return unformatedValue;
  }
};


/**
 * Method for calculating the score of a signal
 * @param {Object} entity to be calculated.
 * @param {Object=} opt_simulation - object that can override the calculation.
 * @return {number} score.
 */
KratuSignal.prototype.calculateWeight = function(entity, opt_simulation) {
  var kratuSignal = this;
  var value = 0;
  if (!kratuSignal.hasCalculation(entity)) {
    return 0;
  }
  if (opt_simulation) {
    value = simulation.value;
  }
  else {
    try {
      value = kratuSignal.getData(entity);
    }
    catch (err) {
      throw 'Warning! Could not call getData on signal ' +
          kratuSignal.key +
          ' ' + err;
    }
  }

  // If boolean, convert the true/false to a number for use in the formula
  if (kratuSignal.isBoolean) {
    value = value ? 1 : 0;
  }
  var delta = 0; // Distance between the value and the innermost threshold
  var range = 0; // Range between lower/higher thresholds

  // If lower treshold and value is less/equal to lMin => lower threshold
  // Set the delta to the distance between lMin and value
  if (kratuSignal.lMin !== null && value <= kratuSignal.lMin) {
    delta = kratuSignal.lMin - value;
    range = kratuSignal.lMin - kratuSignal.lMax;
  }
  // If higher treshold and value is greater/equal to hMin => higher threshold
  // Set the delta to the distance between hMin and value
  else if (kratuSignal.hMin !== null && value >= kratuSignal.hMin) {
    delta = value - kratuSignal.hMin;
    range = kratuSignal.hMax - kratuSignal.hMin;
  }
  // If not, either no thresholds defined, or value outside threshold boundary
  else {
    return 0;
  }

  // If the distance is greater than the range, we're maxed out (ie. 100%)
  if (delta > range) delta = range;

  // Find the actual weight and add inn the scaleExponent
  var calculatedWeight = (kratuSignal.weight / 100) *
      Math.pow(delta, kratuSignal.scaleExponent) /
      Math.pow(range, kratuSignal.scaleExponent);
  return calculatedWeight;
};
