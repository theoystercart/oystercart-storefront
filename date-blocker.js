/* ===== OysterCart Cart Bridge ===== */
(function () {
  console.log('[OysterCart Cart Bridge] script running');

  function getParams() {
    // The parent URL is unreadable cross-origin, but Ecwid passes the
    // page's route through in its own config, which we CAN read.
    var sources = [];
    try { sources.push(window.location.search); } catch (e) {}
    try {
      if (window.ec && window.ec.config && window.ec.config.currentRoute) {
        sources.push(window.ec.config.currentRoute);
      }
    } catch (e) {}
    try { sources.push(document.referrer); } catch (e) {}

    for (var i = 0; i < sources.length; i++) {
      var src = sources[i];
      if (!src || src.indexOf('ocAdd') === -1) continue;
      var qs = src.indexOf('?') !== -1 ? src.slice(src.indexOf('?') + 1) : src;
      try {
        var p = new URLSearchParams(qs);
        if (p.get('ocAdd')) {
          console.log('[OysterCart Cart Bridge] found params in source', i);
          return p;
        }
      } catch (e) {}
    }
    return null;
  }

  function runCartCommand() {
    var params = getParams();
    if (!params) {
      console.log('[OysterCart Cart Bridge] no cart command found');
      return;
    }

    var productId = Number(params.get('ocAdd'));
    if (!productId) return;

    var qty = Number(params.get('qty') || 1);
    var options = {};
    var rawOpts = params.get('opts');
    if (rawOpts) {
      try {
        options = JSON.parse(decodeURIComponent(escape(atob(rawOpts))));
      } catch (e) {
        console.error('[OysterCart Cart Bridge] could not decode options', e);
      }
    }

    console.log('[OysterCart Cart Bridge] adding', { id: productId, quantity: qty, options: options });

    Ecwid.Cart.addProduct({
      id: productId,
      quantity: qty,
      options: options,
      callback: function (success, product, cart, error) {
        console.log('[OysterCart Cart Bridge] result:', success, 'error:', error);
        if (success) Ecwid.openPage('cart');
      }
    });
  }

  function start() {
    if (typeof Ecwid === 'undefined' || !Ecwid.OnAPILoaded) {
      setTimeout(start, 500);
      return;
    }
    Ecwid.OnAPILoaded.add(function () {
      console.log('[OysterCart Cart Bridge] API loaded');
      runCartCommand();
    });
  }

  start();
})();

// Oyster Cart - Date Blocker for Mussel Madness Ticket
// v5 - adds ALLOWED_DATES to override weekday blocks
// Last updated: 2026-06-10

(function() {
  'use strict';

  var BLOCKED_WEEKDAYS = [0, 1, 3, 5, 6]; // Tue and Thu only bookable
  var BLOCKED_DATES = []; // always blocked (overrides ALLOWED_DATES)
  var ALLOWED_DATES = []; // override BLOCKED_WEEKDAYS for these dates
  var CUTOFF_HOUR = 0;
  var CUTOFF_MINUTE = 30;
  var SGT_OFFSET_HOURS = 8;
  var TARGET_PRODUCT_ID = 806985688;

  function log() {
    var args = ['[OysterCart DateBlocker]'].concat(Array.prototype.slice.call(arguments));
    console.log.apply(console, args);
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  function nowInSGT() {
    var n = new Date();
    return new Date(n.getTime() + (n.getTimezoneOffset() * 60000) + (SGT_OFFSET_HOURS * 3600000));
  }

  function isPastCutoffSGT() {
    var s = nowInSGT();
    if (s.getHours() > CUTOFF_HOUR) return true;
    if (s.getHours() === CUTOFF_HOUR && s.getMinutes() >= CUTOFF_MINUTE) return true;
    return false;
  }

  function todayKeySGT() {
    var d = nowInSGT();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function applyBlocks() {
    var menus = document.querySelectorAll('.dp__menu, .dp__instance_calendar');
    if (menus.length === 0) return;

    var monthNames = ['january','february','march','april','may','june',
                      'july','august','september','october','november','december'];

    menus.forEach(function(menu) {
      var header = menu.querySelector('.dp__month_year_wrap, .dp__month_year_select');
      if (!header) return;

      var headerText = header.textContent.trim().toLowerCase();
      var month = -1, year = -1;
      monthNames.forEach(function(name, i) {
        if (headerText.indexOf(name) !== -1) month = i;
      });
      var ym = headerText.match(/\d{4}/);
      if (ym) year = parseInt(ym[0], 10);
      if (month === -1 || year === -1) return;

      var sn = nowInSGT();
      var todaySG = new Date(sn.getFullYear(), sn.getMonth(), sn.getDate());
      var tk = todayKeySGT();
      var cp = isPastCutoffSGT();

      var cells = menu.querySelectorAll('.dp__cell_inner');
      var blockedCount = 0;
      var cellArray = Array.prototype.slice.call(cells);

      cellArray.forEach(function(cell, idx) {
        if (cell.getAttribute('data-blocked') === 'true') return;

        var day = parseInt(cell.textContent.trim(), 10);
        if (isNaN(day)) return;

        // Determine the actual month this cell belongs to.
        // Vue Datepicker shows up to 6 weeks (42 cells) — leading offset = prev month,
        // trailing offset = next month. Detect by position + day value.
        var cellMonth = month;
        var cellYear = year;
        var isOffset = cell.classList.contains('dp__cell_offset');

        if (isOffset) {
          var rowIndex = Math.floor(idx / 7);
          if (rowIndex === 0 && day > 20) {
            // Previous month
            cellMonth = month - 1;
            if (cellMonth < 0) { cellMonth = 11; cellYear = year - 1; }
          } else {
            // Next month
            cellMonth = month + 1;
            if (cellMonth > 11) { cellMonth = 0; cellYear = year + 1; }
          }
        }

        var cellDate = new Date(cellYear, cellMonth, day);
        var dateStr = cellYear + '-' + pad(cellMonth + 1) + '-' + pad(day);
        var weekday = cellDate.getDay();

        var block = false;
        if (cellDate < todaySG) block = true;
        if (dateStr === tk && cp) block = true;
        if (BLOCKED_WEEKDAYS.indexOf(weekday) !== -1) block = true;
        if (BLOCKED_DATES.indexOf(dateStr) !== -1) block = true;

        // ALLOWED_DATES override weekday block (but not past dates or explicit BLOCKED_DATES)
        if (ALLOWED_DATES.indexOf(dateStr) !== -1
            && cellDate >= todaySG
            && BLOCKED_DATES.indexOf(dateStr) === -1
            && !(dateStr === tk && cp)) {
          block = false;
        }

        if (block) {
          cell.classList.add('dp__cell_disabled');
          cell.style.pointerEvents = 'none';
          cell.style.opacity = '0.3';
          cell.style.textDecoration = 'line-through';
          cell.setAttribute('data-blocked', 'true');
          cell.setAttribute('title', 'Not available');
          blockedCount++;
        }
      });

      if (blockedCount > 0) {
        log('Blocked', blockedCount, 'dates in', headerText);
      }
    });
  }

  var observer = new MutationObserver(function() {
    applyBlocks();
  });

  function start() {
    if (typeof Ecwid === 'undefined' || !Ecwid.OnAPILoaded) {
      setTimeout(start, 500);
      return;
    }

    Ecwid.OnAPILoaded.add(function() {
      log('Ecwid API loaded');
    });

    Ecwid.OnPageLoaded.add(function(page) {
      if (page.type !== 'PRODUCT') return;
      if (TARGET_PRODUCT_ID !== null && page.productId !== TARGET_PRODUCT_ID) return;

      log('Target product detected, watching for date picker');
      observer.disconnect();
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }

  log('Loaded');
  start();
})();
