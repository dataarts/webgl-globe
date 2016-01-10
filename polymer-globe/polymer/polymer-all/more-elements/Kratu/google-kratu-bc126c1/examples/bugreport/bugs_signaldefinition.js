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
 * Signal definitions for the Bug Report example
 *
 * In this example, we use classification of tickets and departments
 * to do the calculation of the weights
 *
 * TODO: Add more docs
 * @constructor
 * @param {Kratu} kratu class instance.
 */
function KratuSignalDefinitions(kratu) {
  'use strict';
  var headerEventHandlers = {click: kratu.eventHandlers.toggleSignal};
  this.ticketId = {
    name: 'Bug ID',
    calculateWeight: kratu.calculations.sumScore
  };
  this.customerId = {
    name: 'Customer ID',
    calculateWeight: kratu.calculations.sumScore
  };
  this.customerName = {
    name: 'Customer Name',
    format: kratu.formatters.string,
    calculateWeight: kratu.calculations.sumScore
  };
  this.subject = {
    name: 'Subject'
  };
  this.department = {
    name: 'Department',
    weight: 30,
    calculateWeight: function(bug) {
      if (bug.department == 'Sale') return 0.3;
      else if (bug.department == 'Technical') return 0.2;
      else if (bug.department == 'Finance') return 0.1;
      else return 0;
    },
    headerEventHandlers: headerEventHandlers
  };
  this.ticketType = {
    name: 'Ticket Type',
    weight: 100,
    calculateWeight: function(bug) {
      if (bug.ticketType == 'Bug') return 1.0;
      else if (bug.ticketType == 'Inquiry') return 0.5;
      else if (bug.ticketType == 'Feature') return 0.2;
      else return 0;
    },
    headerEventHandlers: headerEventHandlers
  };
  this.priority = {
    name: 'Ticket Priority',
    weight: 100,
    calculateWeight: function(bug) {
      if (bug.priority == 'Critical') return 1.0;
      else if (bug.priority == 'Urgent') return 0.8;
      else if (bug.priority == 'Medium') return 0.4;
      else if (bug.priority == 'Low') return 0.1;
      else return 0;
    },
    headerEventHandlers: headerEventHandlers
  };
  this.customerTier = {
    name: 'Customer Tier',
    weight: 100,
    calculateWeight: function(bug) {
      if (bug.customerTier == 'Gold') return 1.0;
      else if (bug.customerTier == 'Silver') return 0.5;
      else if (bug.customerTier == 'Bronze') return 0.1;
      else return 0;
    },
    headerEventHandlers: headerEventHandlers
  };
}
