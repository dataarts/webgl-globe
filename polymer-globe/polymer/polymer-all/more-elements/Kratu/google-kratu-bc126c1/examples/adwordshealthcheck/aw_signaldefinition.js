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
 * Signal definitions for the AdWords Health Check
 * This is a comprehensive example of an advanced signal definition
 *
 * If you supply the correct data, this can provide a good starting point
 * for doing AdWords account optimiztion, but should not be considered
 * an exhaustive list of possible optimization areas.
 *
 * Since every AdWords account behaves differently, do not rely solely
 * on the optimizations highlighted by this software.
 *
 * @constructor
 * @param {Kratu} kratu class instance.
 */
function KratuSignalDefinitions(kratu) {
  'use strict';
  var signals = this;
  signals.kratu = kratu;

  var maxSpend = null;
  var signalDescriptionBox = null;
  var signalDescriptionDelayTimer = null;
  var createSignalDescriptionBox = function(args) {
    if (signalDescriptionDelayTimer) {
      clearTimeout(signalDescriptionDelayTimer);
    }
    var signalInfo = signalDescriptions[args.signal.key];
    if (!signalDescriptionBox) {
      signalDescriptionBox = document.createElement('div');
      signalDescriptionBox.classList.add('signalDescriptionBox');
      document.body.appendChild(signalDescriptionBox);
      signalDescriptionBox.style.display = 'none';
      var closeSignalBox = function() {
        signalDescriptionBox.style.display = 'none';
      };
      signalDescriptionBox.addEventListener('mouseout', closeSignalBox, true);
      signalDescriptionBox.addEventListener('mousedown', closeSignalBox, true);
    }
    else {
      signalDescriptionBox.style.top = args.evt.clientY - 100 + 'px';
      signalDescriptionBox.style.left = args.evt.clientX - 100 + 'px';

      var supportLink = '';
      if (signalInfo.supportLink) {
        supportLink = '<h4>&raquo;<a href="' +
            signalInfo.supportLink +
            '">AdWords Help Article</a></h4>';
      }

      var moreLink = '';
      if (signalInfo.moreLink) {
        moreLink = '<h4>&raquo;<a href="' +
            signalInfo.moreLink +
            '">Find out more</a></h4>';
      }

      var content = '<h2>' + signalInfo.name + '</h2>' +
          '<span>' + signalInfo.description + '</span>' +
          '<h3>What it means</h3>' +
          '<span>' + signalInfo.interpretation + '</span>' +
          supportLink +
          '<h3>What to do</h3>' +
          '<span>' + signalInfo.mitigation + '</span>' +
          moreLink;

      signalDescriptionBox.innerHTML = content;
    }
    signalDescriptionDelayTimer = setTimeout(function() {
      signalDescriptionBox.style.display = 'block';
    }, 3000);
  };
  var hideSignalDescriptionBox = function(args) {
    if (signalDescriptionDelayTimer) {
      clearTimeout(signalDescriptionDelayTimer);
    }
  };

  var headerEventHandlers = {
    click: kratu.eventHandlers.toggleSignal,
    contextmenu: kratu.eventHandlers.adjustSignal,
    mouseover: createSignalDescriptionBox,
    mouseout: hideSignalDescriptionBox
  };

  signals.accountName = {
    name: 'Account Name',
    format: signals.kratu.formatters.string,
    calculateWeight: kratu.calculations.sumScore
  };

  signals.externalCustomerId = {
    name: 'External Customer Id',
    format: function(value) {
      return value.toString().replace(/^(\d{3})(\d{3})(\d{4})$/, '$1-$2-$3');
    },
    calculateWeight: kratu.calculations.sumScore
  };
  signals.accountActive = {
    name: 'Account Active',
    weight: 100,
    lMin: 0,
    lMax: 1,
    format: function(value) {
      return value ? 'Yes' : 'No';
    },
    headerEventHandlers: headerEventHandlers
  };
  signals.sumBudget = {
    name: 'Sum Budget',
    format: signals.kratu.formatters.money,
    headerEventHandlers: {
      mouseover: createSignalDescriptionBox,
      mouseout: hideSignalDescriptionBox
    }
  };
  signals.spend = {
    name: 'Spend',
    format: signals.kratu.formatters.money,
    weight: 100,
    range: {min: 0, max: 100, step: 1},
    headerEventHandlers: {
      mouseover: createSignalDescriptionBox,
      mouseout: hideSignalDescriptionBox,
      click: signals.kratu.eventHandlers.toggleSignal
    },
    calculateWeight: function(account) {
      if (maxSpend === null) {
        maxSpend = 0;
        var entities = signals.kratu.getEntities();
        for (var i = 0; i < entities.length; i++) {
          if (entities[i].spend > maxSpend) {
            maxSpend = entities[i].spend;
          }
        }
      }
      if (account.spend !== undefined) {
        return account.spend / maxSpend;
      }
      else {
        return 0;
      }
    }
  };
  signals.budgetUtilization = {
    name: 'Budget Utilization',
    weight: 100,
    lMax: 80,
    lMin: 95,
    hMin: 105,
    hMax: 120,
    range: {min: 0, max: 200, step: 1},
    format: signals.kratu.formatters.percentage,
    getData: function(account) {
      var budget = account.sumBudget;
      var spend = account.spend;
      if (budget === undefined ||
          spend === undefined ||
          budget === 0) return 0;
      else {
        return (spend / budget) * 100;
      }
    },
    headerEventHandlers: headerEventHandlers
  };
  signals.averageQualityScore = {
    name: 'Avg Quality Score',
    weight: 75,
    lMax: 2,
    lMin: 5,
    range: {min: 0, max: 10, step: 0.5},
    format: signals.kratu.formatters.singleDecimal,
    headerEventHandlers: headerEventHandlers
  };
  signals.averageCTRSearch = {
    name: 'Average CTR - Search',
    weight: 95,
    lMax: 0.5,
    lMin: 1.5,
    range: {min: 0, max: 10, step: 0.1},
    format: signals.kratu.formatters.percentage,
    getData: function(account) {
      var impressions = account.impressionsSearch;
      var clicks = account.totalClicksSearch;
      if (!impressions || impressions === 0) return 0;
      else return (clicks / impressions) * 100;
    },
    headerEventHandlers: headerEventHandlers
  };
  signals.averageCTRDisplay = {
    name: 'Average CTR - Display',
    weight: 40,
    lMax: 0.2,
    lMin: 0.5,
    range: {min: 0, max: 10, step: 0.1},
    format: signals.kratu.formatters.percentage,
    getData: function(account) {
      var impressions = account.impressionsDisplay;
      var clicks = account.totalClicksDisplay;
      if (!impressions) return 0;
      else return (clicks / impressions) * 100;
    },
    headerEventHandlers: headerEventHandlers
  };
  signals.callExtensionEnabled = {
    name: '% Call Extensions Enabled',
    weight: 75,
    lMax: 10,
    lMin: 50,
    range: {min: 0, max: 100, step: 1},
    format: signals.kratu.formatters.percentage,
    getData: function(account) {
      var totalCampaigns = account.numberOfActiveCampaigns;
      var campaignsWithExtension =
          account.numberOfCampaignsWithCallExtensionEnabled || 0;
      if (!totalCampaigns || totalCampaigns === 0) return 0;
      else return (campaignsWithExtension / totalCampaigns) * 100;
    },
    headerEventHandlers: headerEventHandlers
  };
  signals.locationExtensionEnabled = {
    name: '% Location Extensions Enabled',
    weight: 75,
    lMax: 10,
    lMin: 50,
    range: {min: 0, max: 100, step: 1},
    format: signals.kratu.formatters.percentage,
    getData: function(account) {
      var totalCampaigns = account.numberOfActiveCampaigns;
      var campaignsWithExtension =
          account.numberOfCampaignsWithLocationExtensionEnabled || 0;
      if (!totalCampaigns || totalCampaigns === 0) return 0;
      else return (campaignsWithExtension / totalCampaigns) * 100;
    },
    headerEventHandlers: headerEventHandlers
  };
  signals.socialExtensionEnabled = {
    name: '% Social Extensions Enabled',
    weight: 25,
    lMax: 10,
    lMin: 50,
    range: {min: 0, max: 100, step: 1},
    format: signals.kratu.formatters.percentage,
    getData: function(account) {
      var totalCampaigns = account.numberOfActiveCampaigns;
      var campaignsWithExtension =
          account.numberOfCampaignsWithSocialExtensionEnabled || 0;
      if (!totalCampaigns || totalCampaigns === 0) return 0;
      else return (campaignsWithExtension / totalCampaigns) * 100;
    },
    headerEventHandlers: headerEventHandlers
  };
  signals.siteLinksEnabled = {
    name: '% Site Links Enabled',
    weight: 75,
    lMax: 10,
    lMin: 50,
    range: {min: 0, max: 100, step: 1},
    format: signals.kratu.formatters.percentage,
    getData: function(account) {
      var totalCampaigns = account.numberOfActiveCampaigns;
      var campaignsWithExtension =
          account.numberOfCampaignsWithSiteLinksEnabled || 0;
      if (!totalCampaigns || totalCampaigns === 0) return 0;
      else return (campaignsWithExtension / totalCampaigns) * 100;
    },
    headerEventHandlers: headerEventHandlers
  };
  signals.lostImpressionsDueToBidAdRankSearch = {
    name: 'Lost Impressions Bid/AdRank, Search',
    weight: 100,
    hMin: 20,
    hMax: 40,
    range: {min: 0, max: 100, step: 1},
    format: signals.kratu.formatters.percentage,
    getData: function(account) {
      var sumImpressions = account.impressionsSearch +
          account.lostImpressionsDueToBudgetSearch +
          account.lostImpressionsDueToBidAdRankSearch;
      if (!sumImpressions) return 0;
      var value = account.lostImpressionsDueToBidAdRankSearch / sumImpressions;
      return value * 100;
    },
    headerEventHandlers: headerEventHandlers
  };
  signals.lostImpressionsDueToBidAdRankDisplay = {
    name: 'Lost Impressions Bid/AdRank, Display',
    weight: 30,
    hMin: 30,
    hMax: 50,
    range: {min: 0, max: 100, step: 1},
    format: signals.kratu.formatters.percentage,
    getData: function(account) {
      var sumImpressions = account.impressionsDisplay +
          account.lostImpressionsDueToBudgetDisplay +
          account.lostImpressionsDueToBidAdRankDisplay;
      if (!sumImpressions) {return 0;}
      var value = account.lostImpressionsDueToBidAdRankDisplay / sumImpressions;
      return value * 100;
    },
    headerEventHandlers: headerEventHandlers
  };
  signals.lostImpressionsDueToBudgetSearch = {
    name: 'Lost Impressions Budget, Search',
    weight: 100,
    hMin: 1,
    hMax: 10,
    range: {min: 0, max: 100, step: 1},
    format: signals.kratu.formatters.percentage,
    getData: function(account) {
      var sumImpressions = account.impressionsSearch +
          account.lostImpressionsDueToBudgetSearch +
          account.lostImpressionsDueToBidAdRankSearch;
      if (!sumImpressions) {return 0;}
      return account.lostImpressionsDueToBudgetSearch / sumImpressions * 100;
    },
    headerEventHandlers: headerEventHandlers
  };
  signals.lostImpressionsDueToBudgetDisplay = {
    name: 'Lost Impressions Budget, Display',
    weight: 100,
    hMin: 5,
    hMax: 30,
    range: {min: 0, max: 100, step: 1},
    format: signals.kratu.formatters.percentage,
    getData: function(account) {
      var sumImpressions = account.impressionsDisplay +
          account.lostImpressionsDueToBudgetDisplay +
          account.lostImpressionsDueToBidAdRankDisplay;
      if (!sumImpressions) {return 0;}
      return account.lostImpressionsDueToBudgetDisplay / sumImpressions * 100;
    },
    headerEventHandlers: headerEventHandlers
  };
  signals.averageNumberOfKeywordsPerAdGroup = {
    name: 'Avg Num Keywords/AdGroup',
    weight: 65,
    lMax: 3,
    lMin: 10,
    hMin: 70,
    hMax: 200,
    range: {min: 0, max: 10000, step: 1},
    format: signals.kratu.formatters.singleDecimal,
    getData: function(account) {
      var totalKWs = account.numberOfPositiveActiveKeywords;
      var numAdGroups = account.numberOfActiveAdGroups;
      if (!numAdGroups && !totalKWs) return 0;
      return totalKWs / numAdGroups;
    },
    headerEventHandlers: headerEventHandlers
  };
  signals.percentageOfClicksFromMobile = {
    name: '% Mobile Clicks',
    format: signals.kratu.formatters.percentage,
    range: {min: 0, max: 100, step: 1},
    getData: function(account) {
      var totalClicks = account.totalClicksSearch +
          account.totalClicksDisplay + account.totalClicksMobile;
      if (!totalClicks || totalClicks <= 0) return 0;
      return (account.totalClicksMobile / totalClicks) * 100;
    },
    headerEventHandlers: headerEventHandlers
  };
  signals.percentageOfActiveKeywordsWithPoorQualityScore = {
    name: '% of KWs w/Poor QS',
    weight: 75,
    hMin: 10,
    hMax: 50,
    range: {min: 0, max: 100, step: 1},
    format: signals.kratu.formatters.percentage,
    getData: function(account) {
      var totalKWs = account.numberOfActivePoorQualityScoreKeywords +
          account.numberOfActiveAverageQualityScoreKeywords +
          account.numberOfActiveGoodQualityScoreKeywords;
      if (!totalKWs) return 0;
      var qsKWs = account.numberOfActivePoorQualityScoreKeywords;
      return (qsKWs / totalKWs) * 100;
    },
    headerEventHandlers: headerEventHandlers
  };
  signals.percentageOfActiveKeywordsWithAverageQualityScore = {
    name: '% of KWs w/Average QS',
    range: {min: 0, max: 100, step: 1},
    format: signals.kratu.formatters.percentage,
    getData: function(account) {
      var totalKWs = account.numberOfActivePoorQualityScoreKeywords +
          account.numberOfActiveAverageQualityScoreKeywords +
          account.numberOfActiveGoodQualityScoreKeywords;
      if (!totalKWs) return 0;
      var qsKWs = account.numberOfActiveAverageQualityScoreKeywords;
      return (qsKWs / totalKWs) * 100;
    },
    headerEventHandlers: headerEventHandlers
  };
  signals.percentageOfActiveKeywordsWithGoodQualityScore = {
    name: '% of KWs w/Good QS',
    range: {min: 0, max: 100, step: 1},
    format: signals.kratu.formatters.percentage,
    getData: function(account) {
      var totalKWs = account.numberOfActivePoorQualityScoreKeywords +
          account.numberOfActiveAverageQualityScoreKeywords +
          account.numberOfActiveGoodQualityScoreKeywords;
      if (!totalKWs) return 0;
      var qsKWs = account.numberOfActiveGoodQualityScoreKeywords;
      return (qsKWs / totalKWs) * 100;
    },
    headerEventHandlers: headerEventHandlers
  };
  signals.percentageOfActiveAdGroupsWith2OrLessActiveAds = {
    name: '% AdGroups w/2 or less ads',
    weight: 30,
    hMin: 10,
    hMax: 20,
    range: {min: 0, max: 100, step: 1},
    format: signals.kratu.formatters.percentage,
    getData: function(account) {
      var numAdGroupsWith2OrLessAds = (
          account.numberOfAdgroupsWithoneActiveAd +
          account.numberOfAdgroupsWithTwoActiveAds
          ) || 0;
      var numAdGroups = account.numberOfActiveAdGroups;
      return (numAdGroupsWith2OrLessAds / numAdGroups) * 100;
    },
    headerEventHandlers: headerEventHandlers
  };
  signals.averageKeywordPosition = {
    name: 'Avg KW Position',
    weight: 80,
    hMin: 4,
    hMax: 6,
    range: {min: 0, max: 20, step: 1},
    format: signals.kratu.formatters.singleDecimal,
    headerEventHandlers: headerEventHandlers
  };
  signals.numberOfDisapprovedAds = {
    name: 'Num Disapproved Ads',
    weight: 50,
    hMin: 1,
    hMax: 2,
    range: {min: 0, max: 100, step: 1},
    format: signals.kratu.formatters.integer,
    headerEventHandlers: headerEventHandlers
  };
  signals.percentageOfActiveBroadMatchingKeywords = {
    name: '% Broad Matching KW',
    weight: 30,
    lMax: 5,
    lMin: 10,
    hMin: 90,
    hMax: 95,
    range: {min: 0, max: 100, step: 1},
    format: signals.kratu.formatters.percentage,
    getData: function(account) {
      var totalKWs = account.numberOfActiveBroadMatchingKeywords +
          account.numberOfActiveExactMatchingKeywords +
          account.numberOfActivePhraseMatchingKeywords;
      if (!totalKWs) return 0;
      var matchedKWs = account.numberOfActiveBroadMatchingKeywords;
      return (matchedKWs / totalKWs) * 100;
    },
    headerEventHandlers: headerEventHandlers
  };
  signals.percentageOfActiveExactMatchingKeywords = {
    name: '% Exact Matching KW',
    weight: 30,
    lMax: 5,
    lMin: 10,
    hMin: 50,
    hMax: 60,
    range: {min: 0, max: 100, step: 1},
    format: signals.kratu.formatters.percentage,
    getData: function(account) {
      var totalKWs = account.numberOfActiveBroadMatchingKeywords +
          account.numberOfActiveExactMatchingKeywords +
          account.numberOfActivePhraseMatchingKeywords;
      if (!totalKWs) return 0;
      var matchedKWs = account.numberOfActiveExactMatchingKeywords;
      return (matchedKWs / totalKWs) * 100;
    },
    headerEventHandlers: headerEventHandlers
  };
  signals.percentageOfActivePhraseMatchingKeywords = {
    name: '% Phrase Matching KW',
    weight: 30,
    lMax: 5,
    lMin: 10,
    hMin: 50,
    hMax: 60,
    range: {min: 0, max: 100, step: 1},
    format: signals.kratu.formatters.percentage,
    getData: function(account) {
      var totalKWs = account.numberOfActiveBroadMatchingKeywords +
          account.numberOfActiveExactMatchingKeywords +
          account.numberOfActivePhraseMatchingKeywords;
      if (!totalKWs) return 0;
      var matchedKWs = account.numberOfActivePhraseMatchingKeywords;
      return (matchedKWs / totalKWs) * 100;
    },
    headerEventHandlers: headerEventHandlers
  };
  signals.percentageOfActiveNegativeKeywords = {
    name: '% negative KWs',
    weight: 30,
    lMax: 5,
    lMin: 10,
    hMin: 50,
    hMax: 60,
    range: {min: 0, max: 100, step: 1},
    format: signals.kratu.formatters.percentage,
    getData: function(account) {
      var totalKWs = account.numberOfPositiveActiveKeywords +
          account.numberOfNegativeActiveKeywords;
      if (!totalKWs) return 0;
      return (account.numberOfNegativeActiveKeywords / totalKWs) * 100;
    },
    headerEventHandlers: headerEventHandlers
  };
  signals.optedIntoSearchPartners = {
    name: '% of Campaigns opted in to Search Partners',
    weight: 30,
    lMax: 50,
    lMin: 60,
    range: {min: 0, max: 100, step: 1},
    format: signals.kratu.formatters.percentage,
    getData: function(account) {
      var value = account.numberOfCampaignsOptedIntoSearchPartners /
          account.numberOfActiveCampaigns;
      return value * 100;
    },
    headerEventHandlers: headerEventHandlers
  };

  var signalDescriptions = {
    'externalCustomerId': {
      'name':
          'External Customer Id',
      'description':
          'External Customer Id is the three-part number that\'s assigned ' +
          'to each AdWords account.',
      'supportLink':
          'http://support.google.com/adwords/bin/answer.py?hl=en&answer=29198',
      'interpretation':
          'Your customer ID is used to identify your AdWords account. You ' +
          'can use this number when contacting the AdWords support team or ' +
          'Account Manager via email and also to connect your account with ' +
          'other Google products like Google Analytics, Google+ and YouTube.',
      'mitigation':
          'Include Customer Id when contacting support or the Account Manager.',
      'moreLink':
          'http://support.google.com/adwords/bin/answer.py?hl=en&answer=1704344'
    },
    'accountActive': {
      'name':
          'Account Active',
      'description':
          'Account Active is a status indicating if the account is currently ' +
          'spending.',
      'supportLink':
          '',
      'interpretation':
          'If an account spent during the period, it will be marked with ' +
          '"Yes". If the account did not spend during the period, it ' +
          'will be marked with "No".',
      'mitigation':
          'If account is marked "No",  check billing information (budget),' +
          'Ad approval status, Keyword Approval Status, Account Status, ' +
          'Campaign Start/End Dates and general campaign settings and setup.' +
          'If it is still unclear as to why the account is inactive, please ' +
          'contact the support team or Account Manager.',
      'moreLink':
          ''
    },
    'sumBudget': {
      'name':
          'Sum Budget',
      'description':
          'Sum Budget is a sum of the budgets set at the campaign level.',
      'supportLink':
          '',
      'interpretation':
          'Sum Budget is calculated by totalling the active campaigns daily ' +
          'budget(s).',
      'mitigation':
          'Ensure sum budget is utilised by reviewing metrics including ' +
          'Impression Share to monitor Share of Voice (SOV).',
      'moreLink':
          'http://support.google.com/adwords/bin/answer.py?hl=en&answer=2375420'
    },
    'spend': {
      'name':
          'Spend',
      'description':
          'Spend is the sum of actual costs during this period. It\'s ' +
          'weighted so you can identify which opportunities that combined ' +
          'will have the most impact.',
      'supportLink':
          '',
      'interpretation':
          'Spend is the sum of your cost-per-click (CPC) and ' +
          'cost-per-thousand impressions (CPM) costs during this period.',
      'mitigation':
          'Set an average daily budget you\'re comfortable with at the ' +
          'campaign level, then bid at the keyword and ad group level to ' +
          'guide how your budget is spent. Also review campaign settings ' +
          'including Delivery method and Ad Scheduling.',
      'moreLink':
          'http://support.google.com/adwords/bin/answer.py?hl=en&answer=2375420'
    },
    'budgetUtilization': {
      'name':
          'Budget Utilisation',
      'description':
          'Budget Utilisation calculates what percentage (%) of the ' +
          'campaign(s) daily budget was spent.',
      'supportLink':
          '',
      'interpretation':
          'If the Budget Utilisation percentage (%) is low, the ' +
          'campaign(s) may not be performing to their full potential.',
      'mitigation':
          'If you are seeing a low Budget Utilisation %, introduce further ' +
          'keywords to increase reach. Decrease Lost Impression Share (rank) ' +
          'by increasing your Max. CPC, or improve your Quality Score by ' +
          'Optimising the account.',
      'moreLink':
          ''
    },
    'averageQualityScore': {
      'name':
          'Average QS',
      'description':
          'Average QS is the Average Quality Score',
      'supportLink':
          '',
      'interpretation':
          'Quality Score is an estimate of how relevant your ads, keywords, ' +
          'and landing page are to a person seeing your ad. A high ' +
          'concentration of impressions from Low Quality Score keywords can ' +
          'limit account quality and performance.',
      'mitigation':
          'To improve Average Quality Score, decrease the number of Low ' +
          'Quality Score keywords within the account by improving keyword ' +
          'relevance through optimisation or replace the Low Quality Score ' +
          'keywords with new relevant keywords using Search Query Report ' +
          'or the Keyword Tool. ',
      'moreLink':
          'http://support.google.com/adwords/bin/answer.py?hl=en&answer=2454010'
    },
    'lostImpressionsDueToBudgetSearch': {
      'name':
          'Lost IS Budget, Search',
      'description':
          'Lost IS Budget, Search estimates how often your ad didn\'t show ' +
          'due to low budget on the Search Network.',
      'supportLink':
          '',
      'interpretation':
          'Lost Lost Impression Share (IS) (budget) is the estimated percent ' +
          'of times that your ad was eligible to show but didn\'t because ' +
          'your budget was too low. Lost IS (budget) is updated once a day.',
      'mitigation':
          'If you want to capture more impressions, try raising your budget.',
      'moreLink':
          'http://support.google.com/adwords/bin/answer.py?hl=en&answer=2497703'
    },
    'lostImpressionsDueToBidAdRankSearch': {
      'name':
          'Lost IS Bid/AdRank, Search',
      'description':
          'Lost IS Bid/AdRank, Search is the estimated percentage of ' +
          'impressions that your ads didn\'t receive due to poor Ad Rank ' +
          'on the Search Network.',
      'supportLink':
          '',
      'interpretation':
          'A high Lost Impression Share (IS) (rank) means there were many ' +
          'times your ad was eligible to show but didn\'t because its Ad ' +
          'Rank was too low. Lost IS (rank) is updated once a day.',
      'mitigation':
          'If you\'re seeing a high Lost IS (rank), try to increase your ' +
          'Max. CPC, or improve your Quality Score by Optimising the account.',
      'moreLink':
          'http://support.google.com/adwords/bin/answer.py?hl=en&answer=2497703'
    },
    'lostImpressionsDueToBudgetDisplay': {
      'name':
          'Lost IS Budget, Display',
      'description':
          'Lost IS Budget, Display estimates how often your ad didn\'t ' +
          'show due to low budget on the Display Network.',
      'supportLink':
          '',
      'interpretation':
          'Lost Impression Share (IS) (budget) is the estimated percent of ' +
          'times that your ad was eligible to show but didn\'t because your ' +
          'budget was too low. Lost IS (budget) is updated once a day.',
      'mitigation':
          'If you want to capture more impressions, try raising your budget.',
      'moreLink':
          'http://support.google.com/adwords/bin/answer.py?hl=en&answer=2497703'
    },
    'lostImpressionsDueToBidAdRankDisplay': {
      'name':
          'Lost IS Bid/AdRank, Display',
      'description':
          'Lost IS Bid/AdRank, Display is the estimated percentage of ' +
          'impressions that your ads didn\'t receive due to poor Ad Rank ' +
          'on the Display Network.',
      'supportLink':
          '',
      'interpretation':
          'A high Lost Impression Share (IS) (rank) means there were many ' +
          'times your ad was eligible to show but didn\'t because its Ad ' +
          'Rank was too low. Lost IS (rank) is updated once a day.',
      'mitigation':
          'If you\'re seeing a high Lost IS (rank), try to increase your ' +
          'Max. CPC, or improve your Quality Score by Optimising the account.',
      'moreLink':
          'http://support.google.com/adwords/bin/answer.py?hl=en&answer=2497703'
    },
    'averageCTRSearch': {
      'name':
          'Avg CTR - Search',
      'description':
          'Avg CTR - Search is the number of clicks your ad receives divided ' +
          'by the number of times your ad is shown on the Search ' +
          'Network as a %.',
      'supportLink':
          '',
      'interpretation':
          'Average Click Through Rate (CTR)  Search represents how often ' +
          'people click your ad after it\'s shown on the Search Network.',
      'mitigation':
          'As a rule of thumb, a CTR under 1% on the Search Network ' +
          'indicates that your ads aren\'t targeted to a relevant audience. ' +
          'If you find that your CTR is lower than 1%, try improving your ads.',
      'moreLink':
          ''
    },
    'averageCTRDisplay': {
      'name':
          'Avg CTR - Display',
      'description':
          'Avg CTR - Display is the number of clicks your ad receives ' +
          'divided by the number of times your ad is shown on the Display ' +
          'Network as a %.',
      'supportLink':
          '',
      'interpretation':
          'Average Click Through Rate (CTR) Display represents how often ' +
          'people click your ad after it\'s shown to them on the Display ' +
          'Network.',
      'mitigation':
          'Add Exclusions (keywords, categories, placements) to reduce ' +
          'target group size, manage high performance placements, Increase ' +
          'bids on top performing campaigns and test Ad variations to ' +
          'potentially improve CTR.',
      'moreLink':
          ''
    },
    'callExtensionEnabled': {
      'name':
          '% Call Extensions Enabled',
      'description':
          '% Call Extensions Enabled is the number of campaigns with Call ' +
          'Extensions enabled divided by the total number of campaigns as a %.',
      'supportLink':
          'http://support.google.com/adwords/bin/answer.py?' +
          'hl=en&answer=2393094&topic=24937&ctx=topic',
      'interpretation':
          'If you\'d like to encourage your customers to call your business, ' +
          'call extensions (also known as click-to-call) allow you to add a ' +
          'phone number to your ad, making it easy for customers to call you ' +
          'directly. You can also set up call extensions to get detailed ' +
          'reporting on the calls you receive from your ads.',
      'mitigation':
          'Ensure all relevant Search Network campaigns have Call ' +
          'Extensions enabled.',
      'moreLink':
          'http://support.google.com/adwords/bin/answer.py?hl=en&answer=2375499'
    },
    'locationExtensionEnabled': {
      'name':
          '% Location Extensions Enabled',
      'description':
          '% Location Extensions Enabled is the number of campaigns with ' +
          'Location Extensions enabled divided by the total number of ' +
          'campaigns as a %.',
      'supportLink':
          'http://support.google.com/adwords/bin/answer.py?' +
          'hl=en&answer=2393094&topic=24937&ctx=topic',
      'interpretation':
          'Location extensions merge your business address and phone number ' +
          'seamlessly with your ad text. Whether you have a single ' +
          'storefront or multiple ones, location extensions allow you to ' +
          'attract customers who are interested in businesses in your area.',
      'mitigation':
          'Ensure all relevant Search Network campaigns have Location ' +
          'Extensions enabled.',
      'moreLink':
          'http://support.google.com/adwords/bin/answer.py?hl=en&answer=2375499'
    },
    'socialExtensionEnabled': {
      'name':
          '% Social Extensions Enabled',
      'description':
          '% Social Extensions Enabled is the number of campaigns with ' +
          'Social Extensions enabled divided by the total number of ' +
          'campaigns as a %.',
      'supportLink':
          'http://support.google.com/adwords/bin/answer.py?' +
          'hl=en&answer=2393094&topic=24937&ctx=topic',
      'interpretation':
          'With social extensions, a +1 on your ad applies to your Google+ ' +
          'Page. All +1\'s from your Google+ Page are also applied to your ' +
          'AdWords ads.',
      'mitigation':
          'Ensure all relevant Search Network campaigns have Social ' +
          'Extensions enabled.',
      'moreLink':
          'http://support.google.com/adwords/bin/answer.py?hl=en&answer=2375499'
    },
    'siteLinksEnabled': {
      'name':
          '% Sitelinks Extensions Enabled',
      'description':
          '% Sitelinks Extensions Enabled is the number of campaigns with ' +
          'Sitelinks Extensions enabled divided by the total number of ' +
          'campaigns as a %.',
      'supportLink':
          'http://support.google.com/adwords/bin/answer.py?' +
          'hl=en&answer=2393094&topic=24937&ctx=topic',
      'interpretation':
          'Sitelinks ad extension lets you show links to pages from your ' +
          'website, in addition to the main landing page, beneath the text ' +
          'of your ads. Sitelinks appear in ads at the top and bottom of ' +
          'Google search results.',
      'mitigation':
          'Ensure all relevant Search Network campaigns have Sitelinks ' +
          'Extensions enabled.',
      'moreLink':
          'http://support.google.com/adwords/bin/answer.py?hl=en&answer=2375499'
    },
    'averageNumberOfKeywordsPerAdGroup': {
      'name':
          'Avg Num Keywords/AdGroup',
      'description':
          'Avg Num Keywords/AdGroup is the sum of Keywords divided by the ' +
          'Number of Ad Groups.',
      'supportLink':
          '',
      'interpretation':
          'Most advertisers find it useful to have somewhere between five ' +
          'and 20 keywords per ad group, although you can have more than 20 ' +
          'keywords in an ad group. However, remember to group your ' +
          'keywords into themes. Keywords of two or three words (a phrase) ' +
          'tend to work most effectively.',
      'mitigation':
          'Try grouping your keywords into themes based on your products, ' +
          'services, or other categories. That way, you can create ads about ' +
          'your keyword themes and then, we can show more relevant ads to ' +
          'potential customers when they search for a specific product ' +
          'or service.',
      'moreLink':
          'http://support.google.com/adwords/bin/answer.py?hl=en&answer=2453981'
    },
    'percentageOfActiveKeywordsWithPoorQualityScore': {
      'name':
          '% of KWs w/Poor QS',
      'description':
          '% of KWs w/Poor QS is the number of Keywords with a Quality ' +
          'Score ranging from 1:4. divided by the total number of ' +
          'keywords as a %.',
      'supportLink':
          '',
      'interpretation':
          'Quality Score is an estimate of how relevant your ads, keywords, ' +
          'and landing page are to a person seeing your ad. Higher Quality ' +
          'Scores typically lead to lower costs and better ad positions.',
      'mitigation':
          'Focus on improving your Quality Score by optimising your campaign ' +
          '-- making sure, for example, that your keywords and ads are ' +
          'specific and relevant to your products and services.',
      'moreLink':
          'http://support.google.com/adwords/bin/answer.py' +
          '?hl=en&answer=140351&topic=24937&path=15464-1710534&ctx=leftnav'
    },
    'percentageOfActiveKeywordsWithAverageQualityScore': {
      'name':
          '% of KWs w/Average QS',
      'description':
          '% of KWs w/Average QS is the number of Keywords with a Quality ' +
          'Score ranging from 5:7 divided by the total number of keywords ' +
          'as a %.',
      'supportLink':
          '',
      'interpretation':
          'Quality Score is an estimate of how relevant your ads, keywords, ' +
          'and landing page are to a person seeing your ad. Higher Quality ' +
          'Scores typically lead to lower costs and better ad positions.',
      'mitigation':
          'Focus on improving your Quality Score by optimising your campaign' +
          ' -- making sure, for example, that your keywords and ads are ' +
          'specific and relevant to your products and services.',
      'moreLink':
          'http://support.google.com/adwords/bin/answer.py?' +
          'hl=en&answer=140351&topic=24937&path=15464-1710534&ctx=leftnav'
    },
    'percentageOfActiveKeywordsWithGoodQualityScore': {
      'name':
          '% of KWs w/Good QS',
      'description':
          '% of KWs w/Good QS is the number of Keywords with a Quality ' +
          'Score ranging from 8:10. divided by the total number of keywords ' +
          'as a %.',
      'supportLink':
          '',
      'interpretation':
          'Quality Score is an estimate of how relevant your ads, ' +
          'keywords, and landing page are to a person seeing your ad. ' +
          'Higher Quality Scores typically lead to lower costs and ' +
          'better ad positions.',
      'mitigation':
          'Focus on improving your Quality Score by optimising your ' +
          'campaign -- making sure, for example, that your keywords ' +
          'and ads are specific and relevant to your products and ' +
          'services.',
      'moreLink':
          'http://support.google.com/adwords/bin/answer.py?' +
          'hl=en&answer=140351&topic=24937&path=15464-1710534&ctx=leftnav'
    },
    'averageKeywordPosition': {
      'name':
          'Avg KW Position',
      'description':
          'Avg KW Position is the Average keyword position.',
      'supportLink':
          '',
      'interpretation':
          'Ad position is determined by your Ad Rank in the auction. Your ' +
          'Ad Rank is a score that\'s based on your bid and your Quality ' +
          'Score. If you\'re using the cost-per-click bidding option, your ' +
          'bid is what you\'re willing to pay for a single click on your ad.',
      'mitigation':
          'To improve your ad position, you can increase your bid, or you ' +
          'can focus on improving your Quality Score.',
      'moreLink':
          'http://support.google.com/adwords/bin/answer.py?hl=en&answer=14075'
    },
    'numberOfDisapprovedAds': {
      'name':
          'Num of Disapproved Ads',
      'description':
          'Num of Disapproved Ads is a sum of the number of ads with the ' +
          'Approval Status of "Disapproved".',
      'supportLink':
          'http://support.google.com/adwords/bin/answer.py?' +
          'hl=en&answer=146676&topic=24937&path=15464-1710534&ctx=leftnav',
      'interpretation':
          'Ads marked as "Disapproved" have an issue with one or more of our ' +
          'advertising policies, and therefore can\'t show until the issue ' +
          'is resolved.',
      'mitigation':
          'Click the white speech bubble next to the word "Disapproved" next ' +
          'to the Ad within the "Ads" tab. Click the disapproval reason to ' +
          'learn more about the policy.',
      'moreLink':
          'http://support.google.com/adwords/bin/answer.py?hl=en&answer=1704381'
    },
    'percentageOfActiveBroadMatchingKeywords': {
      'name':
          '% Broad Matching KW',
      'description':
          '% Broad Matching KW is the number of Broad Match Keywords within ' +
          'the account divided by the total number of Keywords (percentage).',
      'supportLink':
          'http://support.google.com/adwords/bin/answer.py?' +
          'hl=en&answer=2407779&topic=24937&path=15464-1710534&ctx=leftnav',
      'interpretation':
          'When you use broad match, your ads automatically run on relevant ' +
          'variations of your keywords (including misspellings), even if ' +
          'these terms aren\'t in your keyword lists. This helps you attract ' +
          'more visitors to your website, spend less time building keyword ' +
          'lists, and focus your time spending on keywords that work.',
      'mitigation':
          'To use a broad match keyword, simply enter the words ' +
          'you want matched.',
      'moreLink':
          'http://support.google.com/adwords/bin/answer.py?hl=en&answer=2497828'
    },
    'percentageOfActiveExactMatchingKeywords': {
      'name':
          '% Exact Matching KW',
      'description':
          '% Exact Matching KW is the number of Exact Match Keywords within ' +
          'the account divided by the total number of Keywords (percentage).',
      'supportLink':
          'http://support.google.com/adwords/bin/answer.py?' +
          'hl=en&answer=2407781&topic=24937&path=15464-1710534&ctx=leftnav',
      'interpretation':
          'With exact match, you can show your ad to customers who are ' +
          'searching for your exact keyword, or close variants of your ' +
          'exact keyword, exclusively. Of the four keyword matching options, ' +
          'exact match gives you the most control over who sees your ad, ' +
          'and can result in a higher clickthrough rate (CTR).',
      'mitigation':
          'To use an exact match keyword, simply surround the words you want ' +
          'matched with brackets. Since we\'ll automatically show your ads ' +
          'for close variants in your new and existing campaigns, there\'s ' +
          'no need to separately add other variants of your keyword.',
      'moreLink':
          'http://support.google.com/adwords/bin/answer.py?hl=en&answer=2497825'
    },
    'percentageOfActivePhraseMatchingKeywords': {
      'name':
          '% Phrase Matching KW',
      'description':
          '% Phrase Matching KW is the number of Phrase Match Keywords ' +
          'within the account divided by the total number of Keywords as a ' +
          'percentage.',
      'supportLink':
          '',
      'interpretation':
          'With phrase match, you can show your ad to customers who are ' +
          'searching for your exact keyword and close variants of your exact ' +
          'keyword, with additional words before or after. Phrase match is ' +
          'more targeted than the default broad match, but more flexible ' +
          'than exact match. It gives you more control over how closely the ' +
          'keyword must match someone\'s search term so your ad can appear.',
      'mitigation':
          'To use a phrase match keyword, simply surround the words you ' +
          'want matched with quotation marks. Since we\'ll automatically ' +
          'show your ads for close variants in your new and existing, ' +
          'campaigns there\'s no need to separately add variants of your ' +
          'keyword.',
      'moreLink':
          'http://support.google.com/adwords/bin/answer.py?hl=en&answer=2497584'
    },
    'percentageOfActiveNegativeKeywords': {
      'name':
          '% Negative KWs',
      'description':
          '% Negative KWs is the number of Negative Keywords within the ' +
          'account divided by the total number of Keywords as a percentage.',
      'supportLink':
          'http://support.google.com/adwords/bin/answer.py?' +
          'hl=en&answer=105671&topic=24937&path=15464-1710534&ctx=leftnav',
      'interpretation':
          'Negative keywords can help reach the most interested customers, ' +
          'reduce your costs, and increase your return on investment by ' +
          'prohibiting your ads from showing on irrelevant searches.',
      'mitigation':
          'On the Search Network, use the Search Query Report to identify ' +
          'opportunities to include negative keywords to prohibit your ads ' +
          'from appearing on irrelevant searches. On the Display Network, ' +
          'use reports to identify content/placements/audiences that you ' +
          'may want to avoid.',
      'moreLink':
          'http://support.google.com/adwords/bin/answer.py?hl=en&answer=2453972'
    }
  };
}
