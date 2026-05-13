// Oyster Cart - Date Blocker for Mussel Madness Ticket
// Blocks: Mondays, Fridays, Saturdays
// Blocks: specific dates listed below
// Blocks: today after 12:30 AM SGT
// Last updated: 2026-05-13

(function() {
  'use strict';

  // === CONFIG ===
  var BLOCKED_WEEKDAYS = [1, 5, 6]; // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  var BLOCKED_DATES = ['2026-05-19']; // YYYY-MM-DD format
  var CUTOFF_HOUR = 0;
  var CUTOFF_MINUTE = 30;
  var SGT_OFFSET_HOURS = 8;
  var TARGET_PRODUCT_ID = 806985688; // Mussel Madness Ticket (set to null to apply to all products)

  // === HELPERS ===
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
    var pickers = document.querySelectorAll('.dp__main');
    if (pickers.length === 0) return;

    var monthNames = ['january','february','march','april','may','june',
                      'july','august','september','october','november','december'];

    pickers.forEach(function(picker) {
      var header = picker.querySelector('.dp__month_year_wrap, .dp__month_year_select');
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

      picker.querySelectorAll('.dp__cell_inner').forEach(function(cell) {
        if (cell.classList.contains('dp__cell_offset')) return;
        if (cell.getAttribute('data-blocked') === 'true') return; // already processed

        var day = parseInt(cell.textContent.trim(), 10);
        if (isNaN(day)) return;

        var cellDate = new Date(year, month, day);
        var dateStr = year + '-' + pad(month + 1) + '-' + pad(day);
        var weekday = cellDate.getDay();

        var block = false;
        if (cellDate < todaySG) block = true;
        if (dateStr === tk && cp) block = true;
        if (BLOCKED_WEEKDAYS.indexOf(weekday) !== -1) block = true;
        if (BLOCKED_DATES.indexOf(dateStr) !== -1) block = true;

        if (block) {
          cell.classList.add('dp__cell_disabled');
          cell.style.pointerEvents = 'none';
          cell.style.opacity = '0.3';
          cell.style.textDecoration = 'line-through';
          cell.setAttribute('data-blocked', 'true');
          cell.setAttribute('title', 'Not available');
        }
      });
    });
  }

  // Watch for the datepicker rendering or changing months
  var observer = new MutationObserver(function() {
    applyBlocks();
  });

  function start() {
    if (typeof Ecwid === 'undefined' || !Ecwid.OnAPILoaded) {
      setTimeout(start, 500);
      return;
    }

    Ecwid.OnAPILoaded.add(function() {
      console.log('[OysterCart DateBlocker] Loaded');
    });

    Ecwid.OnPageLoaded.add(function(page) {
      if (page.type !== 'PRODUCT') return;
      if (TARGET_PRODUCT_ID !== null && page.productId !== TARGET_PRODUCT_ID) return;

      observer.disconnect();
      observer.observe(document.body, { childList: true, subtree: true });
      applyBlocks();
    });
  }

  start();
})();
