/* =========================================================
   OYSTER CART — ADDITIVE ECWID CART BRIDGE
   VERSION 5

   Custom Wix storefront -> existing real Ecwid cart.

   IMPORTANT:
   We DO NOT use Ecwid native cart/create.

   Wix sends:
       ?ocCartAdd=<payload>

   Bridge:
   1. Decodes desired Wix cart lines.
   2. Reads existing Ecwid cart.
   3. Compares product + options.
   4. Adds ONLY missing quantity.
   5. Verifies each addition.
   6. Opens cart when complete.
========================================================= */

(function () {

  'use strict';

  var PREFIX =
    '[OysterCart Additive Bridge]';

  var VERIFY_INTERVAL_MS =
    500;

  var VERIFY_MAX_ATTEMPTS =
    20;


  function log() {

    var args =
      [PREFIX].concat(
        Array.prototype.slice.call(
          arguments
        )
      );

    console.log.apply(
      console,
      args
    );
  }


  function error() {

    var args =
      [PREFIX].concat(
        Array.prototype.slice.call(
          arguments
        )
      );

    console.error.apply(
      console,
      args
    );
  }


  function safeStringify(value) {

    try {

      return JSON.stringify(
        value,
        null,
        2
      );

    } catch (e) {

      return String(value);

    }
  }


  /* =======================================================
     UTF-8 BASE64
  ======================================================= */

  function decodeBase64Utf8(base64) {

    try {

      var decoded =
        decodeURIComponent(
          base64
        );

      var binary =
        atob(decoded);

      var bytes = [];

      for (
        var i = 0;
        i < binary.length;
        i++
      ) {

        bytes.push(
          '%' +
          (
            '00' +
            binary
              .charCodeAt(i)
              .toString(16)
          ).slice(-2)
        );
      }

      return decodeURIComponent(
        bytes.join('')
      );

    } catch (e) {

      error(
        'Base64 decode failed',
        e
      );

      return null;
    }
  }


  /* =======================================================
     FIND OUR COMMAND
  ======================================================= */

  function findAddPayload() {

    var sources = [];

    try {

      sources.push(
        window.location.href
      );

    } catch (e) {}


    try {

      if (
        window.ec &&
        window.ec.config &&
        window.ec.config.currentRoute
      ) {

        sources.push(
          window.ec.config.currentRoute
        );
      }

    } catch (e) {}


    try {

      sources.push(
        document.referrer
      );

    } catch (e) {}


    for (
      var i = 0;
      i < sources.length;
      i++
    ) {

      var source =
        sources[i];

      if (!source) {
        continue;
      }

      var match =
        source.match(
          /[?&]ocCartAdd=([^&#]+)/
        );

      if (
        match &&
        match[1]
      ) {

        log(
          'ocCartAdd payload found'
        );

        return match[1];
      }
    }

    return null;
  }


  /* =======================================================
     NORMALIZE OPTIONS
  ======================================================= */

  function normalizeName(value) {

    return String(
      value === undefined ||
      value === null
        ? ''
        : value
    )
      .trim()
      .toLowerCase();
  }


  function normalizeValue(value) {

    if (
      value === undefined ||
      value === null
    ) {

      return '';
    }


    if (
      Array.isArray(value)
    ) {

      return value
        .map(function (item) {

          if (
            typeof item !== 'object' ||
            item === null
          ) {

            return String(item)
              .trim()
              .toLowerCase();
          }


          var nested =
            item.value !== undefined
              ? item.value
              : item.text !== undefined
                ? item.text
                : item.name !== undefined
                  ? item.name
                  : safeStringify(item);


          return String(nested)
            .trim()
            .toLowerCase();

        })
        .sort()
        .join('|');
    }


    if (
      typeof value === 'object'
    ) {

      if (
        value.value !== undefined
      ) {

        return normalizeValue(
          value.value
        );
      }


      if (
        value.text !== undefined
      ) {

        return normalizeValue(
          value.text
        );
      }


      return safeStringify(value)
        .trim()
        .toLowerCase();
    }


    return String(value)
      .trim()
      .toLowerCase();
  }


  function normalizeOptionObject(
    options
  ) {

    var normalized = {};


    if (
      options === undefined ||
      options === null
    ) {

      return normalized;
    }


    if (
      Array.isArray(options)
    ) {

      options.forEach(
        function (entry) {

          if (
            !entry ||
            typeof entry !== 'object'
          ) {

            return;
          }


          var name =
            entry.name !== undefined
              ? entry.name
              : entry.optionName !== undefined
                ? entry.optionName
                : entry.title !== undefined
                  ? entry.title
                  : entry.label !== undefined
                    ? entry.label
                    : null;


          var value =
            entry.value !== undefined
              ? entry.value
              : entry.optionValue !== undefined
                ? entry.optionValue
                : entry.text !== undefined
                  ? entry.text
                  : entry.selectedValue !== undefined
                    ? entry.selectedValue
                    : entry.values !== undefined
                      ? entry.values
                      : null;


          if (
            name !== null
          ) {

            normalized[
              normalizeName(name)
            ] =
              normalizeValue(value);
          }
        }
      );

      return normalized;
    }


    if (
      typeof options === 'object'
    ) {

      Object.keys(options)
        .forEach(
          function (name) {

            var value =
              options[name];


            if (
              /^\d+$/.test(name) &&
              value &&
              typeof value === 'object'
            ) {

              var nested =
                normalizeOptionObject(
                  [value]
                );


              Object.keys(nested)
                .forEach(
                  function (nestedName) {

                    normalized[
                      nestedName
                    ] =
                      nested[
                        nestedName
                      ];
                  }
                );

              return;
            }


            normalized[
              normalizeName(name)
            ] =
              normalizeValue(value);
          }
        );

      return normalized;
    }


    return normalized;
  }


  function optionsMatch(
    expected,
    actual
  ) {

    var a =
      normalizeOptionObject(
        expected
      );

    var b =
      normalizeOptionObject(
        actual
      );

    var names =
      Object.keys(a);


    for (
      var i = 0;
      i < names.length;
      i++
    ) {

      var name =
        names[i];


      if (
        !Object.prototype
          .hasOwnProperty.call(
            b,
            name
          )
      ) {

        return false;
      }


      if (
        a[name] !==
        b[name]
      ) {

        return false;
      }
    }


    return true;
  }


  /* =======================================================
     CART HELPERS
  ======================================================= */

  function getItemProductId(item) {

    if (!item) {
      return null;
    }


    if (
      item.product &&
      item.product.id !== undefined
    ) {

      return Number(
        item.product.id
      );
    }


    if (
      item.productId !== undefined
    ) {

      return Number(
        item.productId
      );
    }


    if (
      item.id !== undefined
    ) {

      return Number(
        item.id
      );
    }


    return null;
  }


  function getItemQuantity(item) {

    if (!item) {
      return 0;
    }


    return Number(
      item.quantity ||
      item.count ||
      0
    );
  }


  function getItemOptionCandidates(
    item
  ) {

    var candidates = [];


    if (!item) {
      return candidates;
    }


    if (
      item.options !== undefined
    ) {

      candidates.push(
        item.options
      );
    }


    if (
      item.selectedOptions !== undefined
    ) {

      candidates.push(
        item.selectedOptions
      );
    }


    if (
      item.productOptions !== undefined
    ) {

      candidates.push(
        item.productOptions
      );
    }


    if (
      item.product &&
      item.product.options !== undefined
    ) {

      candidates.push(
        item.product.options
      );
    }


    if (
      item.product &&
      item.product.selectedOptions !==
        undefined
    ) {

      candidates.push(
        item.product.selectedOptions
      );
    }


    if (
      item.product &&
      item.product.productOptions !==
        undefined
    ) {

      candidates.push(
        item.product.productOptions
      );
    }


    return candidates;
  }


  function itemOptionsMatch(
    item,
    requestedOptions
  ) {

    var candidates =
      getItemOptionCandidates(
        item
      );


    for (
      var i = 0;
      i < candidates.length;
      i++
    ) {

      if (
        optionsMatch(
          requestedOptions || {},
          candidates[i]
        )
      ) {

        return true;
      }
    }


    if (
      Object.keys(
        normalizeOptionObject(
          requestedOptions || {}
        )
      ).length === 0 &&
      candidates.length === 0
    ) {

      return true;
    }


    return false;
  }


  function matchingQuantity(
    cart,
    requested
  ) {

    if (
      !cart ||
      !Array.isArray(cart.items)
    ) {

      return 0;
    }


    var total = 0;


    cart.items.forEach(
      function (item) {

        if (
          getItemProductId(item) !==
          Number(requested.id)
        ) {

          return;
        }


        if (
          !itemOptionsMatch(
            item,
            requested.options || {}
          )
        ) {

          return;
        }


        total +=
          getItemQuantity(item);
      }
    );


    return total;
  }


  /* =======================================================
     VERIFY ONE ADDITION
  ======================================================= */

  function waitForQuantity(
    job,
    targetQuantity,
    attempt,
    callback
  ) {

    attempt =
      attempt || 1;


    Ecwid.Cart.get(
      function (cart) {

        var actual =
          matchingQuantity(
            cart,
            job
          );


        log(
          'verify #' + attempt,
          {
            id:
              job.id,

            options:
              job.options || {},

            target:
              targetQuantity,

            actual:
              actual
          }
        );


        if (
          actual >= targetQuantity
        ) {

          callback(
            true,
            cart
          );

          return;
        }


        if (
          attempt >=
          VERIFY_MAX_ATTEMPTS
        ) {

          error(
            'verification timeout',
            {
              job:
                job,

              target:
                targetQuantity,

              actual:
                actual,

              cart:
                cart
            }
          );


          callback(
            false,
            cart
          );

          return;
        }


        setTimeout(
          function () {

            waitForQuantity(
              job,
              targetQuantity,
              attempt + 1,
              callback
            );

          },
          VERIFY_INTERVAL_MS
        );
      }
    );
  }


  /* =======================================================
     ADD ONE PAYLOAD LINE
  ======================================================= */

  function addPayloadLine(
    job,
    done
  ) {

    Ecwid.Cart.get(
      function (beforeCart) {

        var existing =
          matchingQuantity(
            beforeCart,
            job
          );


        var quantityToAdd =
          Number(
            job.quantity || 1
          );


        var target =
          existing +
          quantityToAdd;


        log(
          'adding line',
          {
            id:
              job.id,

            existing:
              existing,

            add:
              quantityToAdd,

            target:
              target,

            options:
              job.options || {}
          }
        );


        Ecwid.Cart.addProduct({

          id:
            Number(job.id),

          quantity:
            quantityToAdd,

          options:
            job.options || {},

          callback:
            function (
              success,
              product,
              callbackCart,
              cartError
            ) {

              log(
                'addProduct callback',
                {
                  success:
                    success,

                  product:
                    product || null,

                  error:
                    cartError || null
                }
              );


              if (!success) {

                error(
                  'Ecwid addProduct failed',
                  job,
                  cartError
                );

                done(false);

                return;
              }


              setTimeout(
                function () {

                  waitForQuantity(
                    job,
                    target,
                    1,
                    function (
                      verified
                    ) {

                      done(
                        verified
                      );
                    }
                  );

                },
                VERIFY_INTERVAL_MS
              );
            }
        });
      }
    );
  }


  /* =======================================================
     PROCESS PAYLOAD LINES SEQUENTIALLY
  ======================================================= */

  function processLines(
    products,
    index
  ) {

    index =
      index || 0;


    if (
      index >= products.length
    ) {

      log(
        'ALL ADDITIONS VERIFIED'
      );


      setTimeout(
        function () {

          Ecwid.openPage(
            'cart'
          );

        },
        300
      );

      return;
    }


    var job =
      products[index];


    addPayloadLine(
      job,
      function (success) {

        if (!success) {

          error(
            'handoff stopped — line could not be verified',
            job
          );

          return;
        }


        processLines(
          products,
          index + 1
        );
      }
    );
  }


  /* =======================================================
     PROCESS COMMAND
  ======================================================= */

  function processAddCommand(
    encodedPayload
  ) {

    if (!encodedPayload) {
      return;
    }


    var json =
      decodeBase64Utf8(
        encodedPayload
      );


    if (!json) {

      error(
        'payload could not be decoded'
      );

      return;
    }


    var payload;


    try {

      payload =
        JSON.parse(json);

    } catch (e) {

      error(
        'payload JSON invalid',
        e,
        json
      );

      return;
    }


    log(
      'decoded additive payload',
      payload
    );


    if (
      !payload ||
      !Array.isArray(
        payload.products
      ) ||
      payload.products.length === 0
    ) {

      error(
        'payload contains no products'
      );

      return;
    }


    processLines(
      payload.products,
      0
    );
  }


  /* =======================================================
     RUN
  ======================================================= */

  function runCartCommand() {

    var payload =
      findAddPayload();


    if (!payload) {

      log(
        'no ocCartAdd command found'
      );

      return;
    }


    processAddCommand(
      payload
    );
  }


  /* =======================================================
     WAIT FOR ECWID
  ======================================================= */

  function startCartBridge() {

    if (
      typeof Ecwid ===
        'undefined' ||
      !Ecwid.OnAPILoaded
    ) {

      setTimeout(
        startCartBridge,
        500
      );

      return;
    }


    Ecwid.OnAPILoaded.add(
      function () {

        log(
          'Ecwid API loaded'
        );


        setTimeout(
          runCartCommand,
          250
        );
      }
    );
  }


  log(
    'Loaded'
  );


  startCartBridge();

})();

/* =========================================================
   OYSTER CART — DATE BLOCKER
   Mussel Madness Ticket
   =========================================================

   v5
   Adds ALLOWED_DATES to override weekday blocks.

   Last updated:
   2026-06-10
========================================================= */

(function () {

  'use strict';


  var BLOCKED_WEEKDAYS =
    [0, 1, 3, 5, 6];


  var BLOCKED_DATES =
    [];


  var ALLOWED_DATES =
    [];


  var CUTOFF_HOUR =
    0;


  var CUTOFF_MINUTE =
    30;


  var SGT_OFFSET_HOURS =
    8;


  var TARGET_PRODUCT_ID =
    806985688;


  function log() {

    var args =
      [
        '[OysterCart DateBlocker]'
      ].concat(
        Array.prototype.slice.call(
          arguments
        )
      );


    console.log.apply(
      console,
      args
    );

  }


  function pad(n) {

    return String(n)
      .padStart(
        2,
        '0'
      );

  }


  function nowInSGT() {

    var now =
      new Date();


    return new Date(
      now.getTime() +
      (
        now.getTimezoneOffset() *
        60000
      ) +
      (
        SGT_OFFSET_HOURS *
        3600000
      )
    );

  }


  function isPastCutoffSGT() {

    var s =
      nowInSGT();


    if (
      s.getHours() >
      CUTOFF_HOUR
    ) {

      return true;

    }


    if (
      s.getHours() ===
        CUTOFF_HOUR &&
      s.getMinutes() >=
        CUTOFF_MINUTE
    ) {

      return true;

    }


    return false;

  }


  function todayKeySGT() {

    var d =
      nowInSGT();


    return (
      d.getFullYear() +
      '-' +
      pad(
        d.getMonth() +
        1
      ) +
      '-' +
      pad(
        d.getDate()
      )
    );

  }


  function applyBlocks() {

    var menus =
      document.querySelectorAll(
        '.dp__menu, .dp__instance_calendar'
      );


    if (
      menus.length ===
      0
    ) {

      return;

    }


    var monthNames = [

      'january',
      'february',
      'march',
      'april',
      'may',
      'june',
      'july',
      'august',
      'september',
      'october',
      'november',
      'december'

    ];


    menus.forEach(
      function (menu) {

        var header =
          menu.querySelector(
            '.dp__month_year_wrap, .dp__month_year_select'
          );


        if (!header) {

          return;

        }


        var headerText =
          header.textContent
            .trim()
            .toLowerCase();


        var month =
          -1;


        var year =
          -1;


        monthNames.forEach(
          function (
            name,
            index
          ) {

            if (
              headerText.indexOf(
                name
              ) !== -1
            ) {

              month =
                index;

            }

          }
        );


        var yearMatch =
          headerText.match(
            /\d{4}/
          );


        if (
          yearMatch
        ) {

          year =
            parseInt(
              yearMatch[0],
              10
            );

        }


        if (
          month === -1 ||
          year === -1
        ) {

          return;

        }


        var singaporeNow =
          nowInSGT();


        var todaySG =
          new Date(
            singaporeNow.getFullYear(),
            singaporeNow.getMonth(),
            singaporeNow.getDate()
          );


        var todayKey =
          todayKeySGT();


        var pastCutoff =
          isPastCutoffSGT();


        var cells =
          menu.querySelectorAll(
            '.dp__cell_inner'
          );


        var blockedCount =
          0;


        var cellArray =
          Array.prototype.slice.call(
            cells
          );


        cellArray.forEach(
          function (
            cell,
            index
          ) {

            if (
              cell.getAttribute(
                'data-blocked'
              ) === 'true'
            ) {

              return;

            }


            var day =
              parseInt(
                cell.textContent.trim(),
                10
              );


            if (
              isNaN(
                day
              )
            ) {

              return;

            }


            var cellMonth =
              month;


            var cellYear =
              year;


            var isOffset =
              cell.classList.contains(
                'dp__cell_offset'
              );


            if (
              isOffset
            ) {

              var rowIndex =
                Math.floor(
                  index / 7
                );


              if (
                rowIndex === 0 &&
                day > 20
              ) {

                cellMonth =
                  month - 1;


                if (
                  cellMonth < 0
                ) {

                  cellMonth =
                    11;


                  cellYear =
                    year - 1;

                }


              } else {

                cellMonth =
                  month + 1;


                if (
                  cellMonth > 11
                ) {

                  cellMonth =
                    0;


                  cellYear =
                    year + 1;

                }

              }

            }


            var cellDate =
              new Date(
                cellYear,
                cellMonth,
                day
              );


            var dateString =
              cellYear +
              '-' +
              pad(
                cellMonth +
                1
              ) +
              '-' +
              pad(
                day
              );


            var weekday =
              cellDate.getDay();


            var block =
              false;


            if (
              cellDate <
              todaySG
            ) {

              block =
                true;

            }


            if (
              dateString ===
                todayKey &&
              pastCutoff
            ) {

              block =
                true;

            }


            if (
              BLOCKED_WEEKDAYS
                .indexOf(
                  weekday
                ) !== -1
            ) {

              block =
                true;

            }


            if (
              BLOCKED_DATES
                .indexOf(
                  dateString
                ) !== -1
            ) {

              block =
                true;

            }


            if (
              ALLOWED_DATES
                .indexOf(
                  dateString
                ) !== -1 &&

              cellDate >=
                todaySG &&

              BLOCKED_DATES
                .indexOf(
                  dateString
                ) === -1 &&

              !(
                dateString ===
                  todayKey &&
                pastCutoff
              )
            ) {

              block =
                false;

            }


            if (
              block
            ) {

              cell.classList.add(
                'dp__cell_disabled'
              );


              cell.style.pointerEvents =
                'none';


              cell.style.opacity =
                '0.3';


              cell.style.textDecoration =
                'line-through';


              cell.setAttribute(
                'data-blocked',
                'true'
              );


              cell.setAttribute(
                'title',
                'Not available'
              );


              blockedCount++;

            }

          }
        );


        if (
          blockedCount >
          0
        ) {

          log(
            'Blocked',
            blockedCount,
            'dates in',
            headerText
          );

        }

      }
    );

  }


  var observer =
    new MutationObserver(
      function () {

        applyBlocks();

      }
    );


  function startDateBlocker() {

    if (
      typeof Ecwid ===
        'undefined' ||
      !Ecwid.OnAPILoaded
    ) {

      setTimeout(
        startDateBlocker,
        500
      );


      return;

    }


    Ecwid.OnAPILoaded.add(
      function () {

        log(
          'Ecwid API loaded'
        );

      }
    );


    Ecwid.OnPageLoaded.add(
      function (
        page
      ) {

        if (
          page.type !==
          'PRODUCT'
        ) {

          return;

        }


        if (
          TARGET_PRODUCT_ID !==
            null &&
          page.productId !==
            TARGET_PRODUCT_ID
        ) {

          return;

        }


        log(
          'Target product detected, watching for date picker'
        );


        observer.disconnect();


        observer.observe(
          document.body,
          {

            childList:
              true,

            subtree:
              true

          }
        );

      }
    );

  }


  log(
    'Loaded'
  );


  startDateBlocker();

})();
