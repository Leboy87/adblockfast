/*
  Copyright 2015– Rocketship <https://rocketshipapps.com/>

  This program is free software: you can redistribute it and/or modify it under the terms of the GNU
  General Public License as published by the Free Software Foundation, either version 3 of the
  License, or (at your option) any later version.

  This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without
  even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
  General Public License for more details.

  You should have received a copy of the GNU General Public License along with this program. If not,
  see https://www.gnu.org/licenses/.

  Authors (one per line):

    Brian Kennish <brian@rocketshipapps.com>
*/
function spawn(tab) { TABS.create({url: tab}); }

function saveError(error) {
  if (database && timestamp) {
    database.ref('errors').push({message: error.message, timestamp: timestamp});
  }
}

function saveUser() {
  if (database && uid && uids && timestamp) {
    database.ref('users/' + uid).set({
      uids: uids,
      platform: BROWSER,
      build: BUILD,
      firstBuild: deserialize(localStorage.firstBuild),
      experimentalGroup: deserialize(localStorage.experimentalGroup),
      toastViewCount: deserialize(localStorage.toastViewCount),
      toastClickCount: deserialize(localStorage.toastClickCount),
      mainViewCount: deserialize(localStorage.mainViewCount),
      wasDenyButtonPressed: deserialize(localStorage.wasDenyButtonPressed),
      wasGrantButtonPressed: deserialize(localStorage.wasGrantButtonPressed),
      timestamp: timestamp
    });
  } else {
    saveError({message: 'No user ID'});
  }
}

function getExperiments(callback) {
  if (database) {
    database.ref('experiments').once('value').then(function(snapshot) {
      callback(snapshot.val());
    });
  } else {
    callback([]);
  }
}

function setExperimentUp() {
  const EXPERIMENT = deserialize(localStorage.experiment);
  const TOAST_VIEW_COUNT = localStorage.toastViewCount;

  if (EXPERIMENT) {
    if (TOAST_VIEW_COUNT < 3) {
      const TOAST_VIEW_TYPE = EXPERIMENT.toastViewType;
      const TOAST_BODY_TEXT = EXPERIMENT.toastBodyText;

      if (TOAST_VIEW_TYPE && TOAST_BODY_TEXT) {
        const MAIN_VIEW_TYPE = EXPERIMENT.mainViewType;

        if (TOAST_VIEW_TYPE == 'badge') {
          const TOAST_COLOR = EXPERIMENT.toastColor;

          if (TOAST_COLOR) {
            BROWSER_ACTION.getBadgeBackgroundColor({}, function(color) {
              localStorage.badgeColor = JSON.stringify(color);
              BROWSER_ACTION.setBadgeBackgroundColor({color: TOAST_COLOR});
            });
          }

          const TOAST_TOOLTIP = EXPERIMENT.toastTooltip;

          if (TOAST_TOOLTIP) {
            BROWSER_ACTION.getTitle({}, function(tooltip) {
              localStorage.tooltip = tooltip;
              BROWSER_ACTION.setTitle({title: TOAST_TOOLTIP + ''});
            });
          }

          BROWSER_ACTION.setBadgeText({text: TOAST_BODY_TEXT + ''});
          localStorage.toastViewCount++;
          saveUser();

          if (
            MAIN_VIEW_TYPE && MAIN_VIEW_TYPE == 'popup' && EXPERIMENT.mainHeadline &&
                EXPERIMENT.mainBodyText && EXPERIMENT.denyButtonLabel && EXPERIMENT.grantButtonLabel
                    && EXPERIMENT.mainFootnote
          ) {
            BROWSER_ACTION.getPopup({}, function(popup) {
              localStorage.popup = popup;
              BROWSER_ACTION.setPopup({popup: PATH + 'markup/experimental-popup.html'});
            });
          }
        } else if (TOAST_VIEW_TYPE == 'notification') {
          const TOAST_HEADLINE = EXPERIMENT.toastHeadline;
          const TOAST_ICON_URL = EXPERIMENT.toastIconUrl;

          if (TOAST_HEADLINE && TOAST_ICON_URL) {
            NOTIFICATIONS.create({
              type: 'basic',
              title: TOAST_HEADLINE,
              message: TOAST_BODY_TEXT,
              iconUrl: TOAST_ICON_URL,
              requireInteraction: !EXPERIMENT.isToastDismissible
            });
            localStorage.toastViewCount++;
            saveUser();
          }
        }
      }
    } else if (IS_UPDATING_TO_CURRENT) {
      saveUser();
    }
  } else if (!deserialize(TOAST_VIEW_COUNT)) {
    const EXPERIMENTAL_GROUP = localStorage.experimentalGroup;

    if (EXPERIMENTAL_GROUP) {
      getExperiments(function(experiments) {
        const EXPERIMENT = experiments[EXPERIMENTAL_GROUP];

        if (EXPERIMENT) {
          localStorage.experiment = JSON.stringify(EXPERIMENT);
          setExperimentUp();
        } else if (IS_UPDATING_TO_CURRENT) {
          saveUser();
        }
      });
    }
  }
}

function block(tabId, parentHost, type) {
  var blockingResponse = {cancel: false};

  if ((deserialize(localStorage.whitelist) || {})[parentHost]) {
    TABS.get(tabId, function() {
      if (!RUNTIME.lastError) {
        BROWSER_ACTION.setIcon({
          tabId: tabId,
          path: {
            '19': PATH + 'images/unblocked-ads/19.png', '38': PATH + 'images/unblocked-ads/38.png'
          }
        });
      }
    });
  } else {
    TABS.get(tabId, function() {
      if (!RUNTIME.lastError) {
        BROWSER_ACTION.setIcon({
          tabId: tabId,
          path: {'19': PATH + 'images/blocked-ads/19.png', '38': PATH + 'images/blocked-ads/38.png'}
        });
      }
    });

    blockingResponse = {
      redirectUrl:
          type == 'image' ?
              'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg=='
                  : 'about:blank'
    };
  }

  WERE_ADS_FOUND[tabId] = true;

  return blockingResponse;
}

function whitelist(tab) {
  const WHITELIST = deserialize(localStorage.whitelist) || {};
  const HOST = getHost(tab.url);
  const ID = tab.id;

  if (WHITELIST[HOST]) {
    delete WHITELIST[HOST];
    localStorage.whitelist = JSON.stringify(WHITELIST);
    TABS.reload(ID);
  } else {
    WHITELIST[HOST] = true;
    localStorage.whitelist = JSON.stringify(WHITELIST);
    TABS.reload(ID);
  }
}

const BUILD = 8;
const PREVIOUS_BUILD = localStorage.build;
const RUNTIME = chrome.runtime;
const TABS = chrome.tabs;
const NOTIFICATIONS = chrome.notifications;
const WHITELIST = deserialize(localStorage.whitelist) || {};
const HOSTS = {};
const WERE_ADS_FOUND = {};
const IS_IN_OPERA = navigator.userAgent.indexOf('OPR') + 1;
const BROWSER = IS_IN_OPERA ? 'opera' : 'chrome';
const PATH = IS_IN_OPERA ? 'chrome/' : '';
const IS_UPDATING_TO_CURRENT = !PREVIOUS_BUILD || PREVIOUS_BUILD < BUILD;
var database;
var user;
var uid;
var uids;
var timestamp;

if (!PREVIOUS_BUILD) {
  localStorage.firstBuild = BUILD;
  localStorage.whitelist = JSON.stringify({});
  spawn(PATH + 'markup/firstrun.html');
}

if (!PREVIOUS_BUILD || PREVIOUS_BUILD < 5) localStorage.uids = JSON.stringify([]);

if (!PREVIOUS_BUILD || PREVIOUS_BUILD < 7) {
  WHITELIST['buy.buysellads.com'] = true;
  WHITELIST['gs.statcounter.com'] = true;
  localStorage.whitelist = JSON.stringify(WHITELIST);
}

if (IS_UPDATING_TO_CURRENT) {
  WHITELIST['amplitude.com'] = true;
  WHITELIST['analytics.amplitude.com'] = true;
  WHITELIST['sumo.com'] = true;
  WHITELIST['www.cnet.com'] = true;
  WHITELIST['www.stitcher.com'] = true;
  localStorage.whitelist = JSON.stringify(WHITELIST);
  localStorage.build = BUILD;
}

if (user) {
  uid = user.uid;
  setExperimentUp();
}

TABS.query({}, function(tabs) {
  const TAB_COUNT = tabs.length;

  for (var i = 0; i < TAB_COUNT; i++) {
    var tab = tabs[i];
    HOSTS[tab.id] = getHost(tab.url);
  }
});

chrome.webRequest.onBeforeRequest.addListener(function(details) {
  const TAB_ID = details.tabId;
  const TYPE = details.type;
  const IS_PARENT = TYPE == 'main_frame';
  const URL = details.url;
  const CHILD_HOST = getHost(URL);
  if (IS_PARENT) HOSTS[TAB_ID] = CHILD_HOST;
  const PARENT_HOST = HOSTS[TAB_ID];
  var blockingResponse = {cancel: false};

  if (TAB_ID + 1 && !IS_PARENT && PARENT_HOST) {
    if (CHILD_HOST != PARENT_HOST) {
      for (var i = DOMAIN_COUNT - 1; i + 1; i--) {
        if (DOMAINS[i].test(CHILD_HOST)) {
          blockingResponse = block(TAB_ID, PARENT_HOST, TYPE);
          break;
        }
      }
    }

    if (
      deserialize(localStorage.wasGrantButtonPressed) && PARENT_HOST == 'www.youtube.com' &&
          /get_(?:video_(?:metadata|info)|midroll_info)/.test(URL)
    ) {
      blockingResponse = block(TAB_ID, PARENT_HOST, TYPE);
    }
  }

  return blockingResponse;
}, {urls: ['http://*/*', 'https://*/*']}, ['blocking']);

chrome.webNavigation.onCommitted.addListener(function(details) {
  if (!details.frameId) {
    const TAB_ID = details.tabId;
    delete WERE_ADS_FOUND[TAB_ID];

    TABS.get(TAB_ID, function() {
      if (!RUNTIME.lastError) {
        if ((deserialize(localStorage.whitelist) || {})[getHost(details.url)]) {
          BROWSER_ACTION.setIcon({
            tabId: TAB_ID,
            path: {'19': PATH + 'images/unblocked/19.png', '38': PATH + 'images/unblocked/38.png'}
          }, function() {
            if (!localStorage.tooltip) {
              BROWSER_ACTION.setTitle({tabId: TAB_ID, title: 'Block ads on this site'});
            }
          });
        } else {
          BROWSER_ACTION.setIcon({
            tabId: TAB_ID,
            path: {'19': PATH + 'images/blocked/19.png', '38': PATH + 'images/blocked/38.png'}
          }, function() {
            if (!localStorage.tooltip) {
              BROWSER_ACTION.setTitle({tabId: TAB_ID, title: 'Unblock ads on this site'});
            }
          });
        }
      }
    });
  }
});

EXTENSION.onRequest.addListener(function(request, sender, sendResponse) {
  if (request.shouldSaveUser) {
    saveUser();
  } else {
    const TAB = sender.tab;

    if (TAB) {
      const PARENT_HOST = getHost(TAB.url);
      const IS_WHITELISTED = (deserialize(localStorage.whitelist) || {})[PARENT_HOST];

      if (request.shouldInitialize) {
        sendResponse({
          wasGrantButtonPressed: deserialize(localStorage.wasGrantButtonPressed),
          parentHost: PARENT_HOST,
          isWhitelisted: IS_WHITELISTED
        });
      } else {
        const TAB_ID = TAB.id;

        TABS.get(TAB_ID, function() {
          if (!RUNTIME.lastError && request.wereAdsFound) {
            BROWSER_ACTION.setIcon({
              tabId: TAB_ID,
              path: {
                '19': PATH + 'images/' + (IS_WHITELISTED ? 'un' : '') + 'blocked-ads/19.png',
                '38': PATH + 'images/' + (IS_WHITELISTED ? 'un' : '') + 'blocked-ads/38.png'
              }
            });
          }
        });

        sendResponse({});
      }
    } else {
      sendResponse({});
    }
  }
});

BROWSER_ACTION.onClicked.addListener(function(tab) {
  const EXPERIMENT = deserialize(localStorage.experiment);

  if (EXPERIMENT) {
    const TOAST_VIEW_TYPE = EXPERIMENT.toastViewType;

    if (TOAST_VIEW_TYPE && TOAST_VIEW_TYPE == 'badge' && EXPERIMENT.toastBodyText) {
      const MAIN_VIEW_TYPE = EXPERIMENT.mainViewType;

      if (
        MAIN_VIEW_TYPE && MAIN_VIEW_TYPE == 'tab' && EXPERIMENT.mainTitle && EXPERIMENT.mainHeadline
            && EXPERIMENT.mainBodyText && EXPERIMENT.denyButtonLabel && EXPERIMENT.grantButtonLabel
                  && EXPERIMENT.mainFootnote
      ) {
        spawn(PATH + 'markup/experimental-tab.html');
      }

      localStorage.toastClickCount++;
      saveUser();
    } else {
      whitelist(tab);
    }
  } else {
    whitelist(tab);
  }
});

NOTIFICATIONS.onClicked.addListener(function(id) {
  spawn(PATH + 'markup/experimental-tab.html');
  NOTIFICATIONS.clear(id);
  localStorage.toastClickCount++;
  saveUser();
});
