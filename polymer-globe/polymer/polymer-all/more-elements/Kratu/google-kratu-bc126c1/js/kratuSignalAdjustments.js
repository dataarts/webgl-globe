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
 * UI Adjustments for Kratu Signals
 * @constructor
 * @param {Kratu} kratu class instance.
 */
function KratuSignalAdjustments(kratu) {
  'use strict';
  this.kratu = kratu;
  this.signalControls_ = [
    'lMax',
    'lMin',
    'hMin',
    'hMax',
    'weight',
    'scaleExponent'
  ];
}


/**
 * Method for displaying the adjustments for this signal
 * @param {KratuSignal} signal to be adjusted.
 * @param {!Function} onChangeCallback to be called when adjustments is made.
 */
KratuSignalAdjustments.prototype.displayAdjustments = function(
    signal, onChangeCallback) {
  'use strict';
  var adjustments = this;

  var container = document.createElement('div');
  container.id = 'kratuSignalAdjustments';
  container.classList.add('kratuSignalAdjustments');
  var header = document.createElement('header');
  var signalName = document.createElement('b');
  signalName.textContent = signal.name;
  header.appendChild(signalName);
  container.appendChild(header);

  container.style.cursor = 'move';

  container.addEventListener('mousedown', function(evt) {
    var xStart = evt.clientX;
    var yStart = evt.clientY;
    var currentX = parseInt(container.style.right, 10) || 0;
    var currentY = parseInt(container.style.top, 10) || 0;

    var dragging = function(evt) {
      container.style.top = currentY + (evt.clientY - yStart) + 'px';
      container.style.right = currentX - (evt.clientX - xStart) + 'px';
    };
    var dropping = function(evt) {
      container.removeEventListener('mousemove', dragging, true);
      container.removeEventListener('mouseup', dropping, true);
    };
    container.addEventListener('mousemove', dragging, true);
    container.addEventListener('mouseup', dropping, true);
  }, false);

  this.sliderObjects = {};
  // Consider moving callback delays to kratu
  var callbackTimerId = null;
  // Don't do immediate update if there's a lot of rows
  var callbackDelay = adjustments.kratu.getNumEntities() > 50 ? 100 : 0;

  for (var i = 0; i < adjustments.signalControls_.length; i++) {
    var measure = adjustments.signalControls_[i];
    if (signal[measure] === null) {
      continue;
    }
    this.sliderObjects[measure] = this.createSliderObject_({
      signal: signal,
      signalKey: measure,
      onChangeCallback: function() {
        if (onChangeCallback) {
          if (callbackTimerId) {
            clearTimeout(callbackTimerId);
          }
          callbackTimerId = setTimeout(onChangeCallback, callbackDelay);
        }
        adjustments.updateMeasures_(signal);
      }
    });
    container.appendChild(this.sliderObjects[measure].container);
  }

  var closeAdjustments = function() {
    document.body.removeChild(container);
  };
  var escapeClosesAdjustments = function(evt) {
    if (evt.keyCode == 27) {
      document.removeEventListener('keydown', escapeClosesAdjustments, true);
      closeAdjustments();
    }
  };
  document.addEventListener('keydown', escapeClosesAdjustments, true);

  this.chart = document.createElement('div');
  this.chart.id = 'kratuSignalChart';
  this.chart.classList.add('kratuSignalChart');
  container.appendChild(this.chart);
  var button = document.createElement('button');
  button.addEventListener('click', closeAdjustments, true);
  button.textContent = 'Close';
  container.appendChild(button);
  document.body.appendChild(container);

  google.load('visualization', '1.0', {
    callback: function() {
      adjustments.updateMeasures_(signal);
    },
    packages: ['corechart']
  });
};


/**
 * Method for updating the graph and sliders when a signal is adjusted
 * @param {KratuSignal} signal triggering the adjustment.
 * @private
 */
KratuSignalAdjustments.prototype.updateMeasures_ = function(signal) {
  'use strict';
  if (signal.lMin !== null) {
    this.sliderObjects['lMax'].slider.max =
        parseInt(this.sliderObjects['lMin'].slider.value, 10) -
        parseInt(signal.range.step, 10);
    this.sliderObjects['lMin'].slider.min =
        parseInt(this.sliderObjects['lMax'].slider.value, 10) +
        parseInt(signal.range.step, 10);
  }
  if (signal.hMin !== null) {
    this.sliderObjects['hMin'].slider.max =
        parseInt(this.sliderObjects['hMax'].slider.value, 10) -
        parseInt(signal.range.step, 10);
    this.sliderObjects['hMax'].slider.min =
        parseInt(this.sliderObjects['hMin'].slider.value, 10) +
        parseInt(signal.range.step, 10);
  }
  if (signal.hMin !== null && signal.lMin !== null) {
    this.sliderObjects['lMin'].slider.max =
        parseInt(this.sliderObjects['hMin'].slider.value, 10) -
        parseInt(signal.range.step, 10);
    this.sliderObjects['hMin'].slider.min =
        parseInt(this.sliderObjects['lMin'].slider.value, 10) +
        parseInt(signal.range.step, 10);
  }

  // Create a chart, visualizing the weights for all possible signal values.
  // Iterate through all possible values for this signal and add a new data row
  // with the weight and potentially an annotation for all inflection points
  var rows = [];
  for (var i = signal.range.min; i <= signal.range.max; i++) {
    var annotation = '';
    if (signal.lMax && i == signal.lMax) {annotation = 'lMax ' + signal.lMax;}
    if (signal.lMin && i == signal.lMin) {annotation = 'lMin ' + signal.lMin;}
    if (signal.hMin && i == signal.hMin) {annotation = 'hMin ' + signal.hMin;}
    if (signal.hMax && i == signal.hMax) {annotation = 'hMax ' + signal.hMax;}
    var weight = signal.calculateWeight({}, {value: i}) * 100;
    rows.push([i, weight, annotation, annotation]);
  }

  var data = new google.visualization.DataTable();
  data.addColumn('number', 'Value');
  data.addColumn('number', 'Calculated Opportunity');
  data.addColumn({type: 'string', role: 'annotation'});
  data.addColumn({type: 'string', role: 'annotationText'});

  data.addRows(rows);
  var chart = new google.visualization.LineChart(this.chart);
  chart.draw(data, {
    vAxis: {
      minValue: 0,
      maxValue: 100,
      title: 'Optimization Opportunity'
    },
    hAxis: {
      minValue: signal.range.min,
      maxValue: signal.range.max,
      title: signal.name
    }
  });
};


/**
 * Method for creating a slider element.
 * @param {Object} args for this slider.
 * @return {Object<string, Element>} slider element and container element.
 * @private
 */
KratuSignalAdjustments.prototype.createSliderObject_ = function(args) {
  'use strict';
  var min = args.signal.range.min;
  var max = args.signal.range.max;
  var step = args.signal.range.step;

  if (args.signalKey == 'weight') {
    min = 0;
    max = 100;
    step = 1;
  }
  else if (args.signalKey == 'scaleExponent') {
    min = 1;
    max = 10;
    step = 0.5;
  }

  var numDecimals = step.toString().replace(/^\d+\.?/, '').length;

  var sliderContainer = document.createElement('div');
  sliderContainer.className = 'sliderContainer';

  var label = document.createElement('label');
  label.textContent = args.signalKey;

  var value = document.createElement('span');
  value.textContent = parseInt(args.signal[args.signalKey], 10)
    .toFixed(numDecimals);

  var slider = document.createElement('input');
  slider.type = 'range';
  slider.min = min;
  slider.max = max;
  slider.step = step;
  slider.value = args.signal[args.signalKey];

  slider.addEventListener('mousedown', function(evt) {
    evt.stopPropagation();
  });

  slider.addEventListener('change', function() {
    value.textContent = parseFloat(slider.value).toFixed(numDecimals);
    args.signal[args.signalKey] = slider.value;
    args.onChangeCallback();
  }, true);

  sliderContainer.appendChild(label);
  sliderContainer.appendChild(value);
  sliderContainer.appendChild(slider);
  return {
    slider: slider,
    container: sliderContainer
  };
};
