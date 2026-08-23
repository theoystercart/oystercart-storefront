/* =========================================================
   OYSTER CART — ECWID CART HANDOFF BRIDGE
   =========================================================

   Purpose:
   Custom Wix product pages keep their own temporary cart.

   When customer clicks "Go to Cart", Wix navigates to:

   /online-store/!/~/cart/create=<BASE64_CART_JSON>

   This script runs INSIDE the real Ecwid Wix storefront,
   reads that cart payload, checks the real Ecwid cart,
   adds anything missing, then opens the real cart.

   This same file also contains the Mussel Madness
   date blocker further below.
========================================================= */

(function () {
  'use strict';

  var PREFIX = '[OysterCart Cart Bridge]';

  console.log(PREFIX, 'script running');


  /* ---------------------------------------------------------
     LOGGING
  --------------------------------------------------------- */

  function log() {
    var args =
      [PREFIX].concat(
        Array.prototype.slice.call(arguments)
      );

    console.log.apply(console, args);
  }


  function error() {
    var args =
      [PREFIX].concat(
        Array.prototype.slice.call(arguments)
      );

    console.error.apply(console, args);
  }


  /* ---------------------------------------------------------
     UTF-8 BASE64 DECODING
  --------------------------------------------------------- */

  function decodeBase64Utf8(base64) {

    try {

      /*
       * URL may still contain encoded characters.
       */
      var decodedUrlPart =
        decodeURIComponent(base64);


      var binary =
        atob(decodedUrlPart);


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
        'Base64 UTF-8 decode failed',
        e
      );

      return null;

    }

  }


  /* ---------------------------------------------------------
     FIND CART CREATE PAYLOAD
  --------------------------------------------------------- */

  function findCartCreatePayload() {

    var sources = [];


    /*
     * 1. Current iframe URL
     */
    try {

      sources.push(
        window.location.href
      );

    } catch (e) {}


    /*
     * 2. Ecwid/Wix route.
     *
     * This is the important one.
     *
     * Your logs showed:
     *
     * window.ec.config.currentRoute =
     * ./online-store/!/~/cart/create=...
     */
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


    /*
     * 3. Referrer as fallback
     */
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


      var marker =
        'cart/create=';


      var markerIndex =
        source.indexOf(marker);


      if (markerIndex === -1) {
        continue;
      }


      var payload =
        source.substring(
          markerIndex +
          marker.length
        );


      /*
       * Remove any Wix/Ecwid query parameters
       * that were appended after the payload.
       */
      var questionIndex =
        payload.indexOf('?');


      if (questionIndex !== -1) {

        payload =
          payload.substring(
            0,
            questionIndex
          );

      }


      var ampIndex =
        payload.indexOf('&');


      if (ampIndex !== -1) {

        payload =
          payload.substring(
            0,
            ampIndex
          );

      }


      if (!payload) {
        continue;
      }


      log(
        'cart/create payload found in source',
        i
      );


      return payload;

    }


    return null;

  }


  /* ---------------------------------------------------------
     LEGACY ocAdd SUPPORT

     Keep this temporarily so old links still work.
  --------------------------------------------------------- */

  function getLegacyParams() {

    var sources = [];


    try {

      sources.push(
        window.location.search
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

      var src =
        sources[i];


      if (
        !src ||
        src.indexOf('ocAdd') === -1
      ) {

        continue;

      }


      var qs =
        src.indexOf('?') !== -1
          ? src.slice(
              src.indexOf('?') + 1
            )
          : src;


      try {

        var params =
          new URLSearchParams(qs);


        if (
          params.get('ocAdd')
        ) {

          log(
            'legacy ocAdd params found'
          );


          return params;

        }

      } catch (e) {}

    }


    return null;

  }


  /* ---------------------------------------------------------
     NORMALIZE OPTIONS
  --------------------------------------------------------- */

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

          return String(item)
            .trim()
            .toLowerCase();

        })
        .sort()
        .join('|');

    }


    return String(value)
      .trim()
      .toLowerCase();

  }


  function optionsMatch(
    expected,
    actual
  ) {

    expected =
      expected || {};

    actual =
      actual || {};


    var names =
      Object.keys(expected);


    for (
      var i = 0;
      i < names.length;
      i++
    ) {

      var name =
        names[i];


      if (
        normalizeValue(
          expected[name]
        ) !==
        normalizeValue(
          actual[name]
        )
      ) {

        return false;

      }

    }


    return true;

  }


  /* ---------------------------------------------------------
     FIND QUANTITY OF MATCHING CART LINE
  --------------------------------------------------------- */

  function existingMatchingQuantity(
    cart,
    requestedProduct
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
          !item ||
          !item.product
        ) {

          return;

        }


        if (
          Number(item.product.id) !==
          Number(requestedProduct.id)
        ) {

          return;

        }


        if (
          !optionsMatch(
            requestedProduct.options || {},
            item.options || {}
          )
        ) {

          return;

        }


        total +=
          Number(
            item.quantity || 0
          );

      }
    );


    return total;

  }


  /* ---------------------------------------------------------
     SESSION GUARD

     Prevent accidental re-processing of the exact same
     cart/create command during Ecwid/Wix route reloads.
  --------------------------------------------------------- */

  function getGuardKey(payload) {

    var hash = 0;


    for (
      var i = 0;
      i < payload.length;
      i++
    ) {

      hash =
        (
          (hash << 5) -
          hash
        ) +
        payload.charCodeAt(i);


      hash =
        hash & hash;

    }


    return (
      'oystercart_cart_import_' +
      String(hash)
    );

  }


  function alreadyProcessed(payload) {

    try {

      return (
        sessionStorage.getItem(
          getGuardKey(payload)
        ) === 'done'
      );

    } catch (e) {

      return false;

    }

  }


  function markProcessed(payload) {

    try {

      sessionStorage.setItem(
        getGuardKey(payload),
        'done'
      );

    } catch (e) {}

  }


  /* ---------------------------------------------------------
     ADD PRODUCTS SEQUENTIALLY

     Sequential callbacks make debugging much easier and
     avoid multiple simultaneous Ecwid cart mutations.
  --------------------------------------------------------- */

  function addProductsSequentially(
    jobs,
    index,
    done
  ) {

    if (
      index >= jobs.length
    ) {

      done();

      return;

    }


    var job =
      jobs[index];


    log(
      'adding product',
      {
        id:
          job.id,

        quantity:
          job.quantity,

        options:
          job.options || {}
      }
    );


    var addObject = {

      id:
        Number(job.id),

      quantity:
        Number(
          job.quantity || 1
        ),

      options:
        job.options || {},

      callback:
        function (
          success,
          product,
          cart,
          cartError
        ) {

          log(
            'addProduct callback',
            {
              success:
                success,

              productId:
                product
                  ? product.id
                  : null,

              error:
                cartError
            }
          );


          if (!success) {

            error(
              'could not add product',
              job,
              cartError
            );


            /*
             * Continue with remaining products rather
             * than blocking the whole cart.
             */
          }


          addProductsSequentially(
            jobs,
            index + 1,
            done
          );

        }

    };


    Ecwid.Cart.addProduct(
      addObject
    );

  }


  /* ---------------------------------------------------------
     IMPORT PREFILLED CART INTO REAL ECWID CART
  --------------------------------------------------------- */

  function processCartCreate(
    encodedPayload
  ) {

    if (!encodedPayload) {
      return;
    }


    if (
      alreadyProcessed(
        encodedPayload
      )
    ) {

      log(
        'this cart payload was already processed'
      );


      Ecwid.openPage('cart');

      return;

    }


    var json =
      decodeBase64Utf8(
        encodedPayload
      );


    if (!json) {

      error(
        'cart payload could not be decoded'
      );

      return;

    }


    var cartPayload;


    try {

      cartPayload =
        JSON.parse(json);

    } catch (e) {

      error(
        'cart payload JSON invalid',
        e,
        json
      );

      return;

    }


    log(
      'decoded cart payload',
      cartPayload
    );


    if (
      !cartPayload ||
      !Array.isArray(
        cartPayload.products
      ) ||
      cartPayload.products.length === 0
    ) {

      error(
        'cart payload contains no products'
      );

      return;

    }


    /*
     * Get the REAL Ecwid cart first.
     */
    Ecwid.Cart.get(
      function (currentCart) {

        log(
          'real Ecwid cart loaded',
          currentCart
        );


        var jobs = [];


        cartPayload.products.forEach(
          function (
            requestedProduct
          ) {

            var requestedQty =
              Number(
                requestedProduct.quantity ||
                1
              );


            var existingQty =
              existingMatchingQuantity(
                currentCart,
                requestedProduct
              );


            var missingQty =
              requestedQty -
              existingQty;


            log(
              'cart line comparison',
              {
                id:
                  requestedProduct.id,

                requested:
                  requestedQty,

                existing:
                  existingQty,

                missing:
                  missingQty,

                options:
                  requestedProduct.options ||
                  {}
              }
            );


            /*
             * Ecwid already has enough of this exact
             * product + option combination.
             */
            if (
              missingQty <= 0
            ) {

              return;

            }


            jobs.push({

              id:
                Number(
                  requestedProduct.id
                ),

              quantity:
                missingQty,

              options:
                requestedProduct.options ||
                {}

            });

          }
        );


        /*
         * Nothing missing:
         * Ecwid's native cart/create may already
         * have populated everything.
         */
        if (
          jobs.length === 0
        ) {

          log(
            'real cart already contains requested items'
          );


          markProcessed(
            encodedPayload
          );


          Ecwid.openPage(
            'cart'
          );


          return;

        }


        log(
          'products still needing import',
          jobs
        );


        addProductsSequentially(
          jobs,
          0,
          function () {

            log(
              'cart import finished'
            );


            markProcessed(
              encodedPayload
            );


            /*
             * Read cart one final time for diagnostics.
             */
            Ecwid.Cart.get(
              function (
                finalCart
              ) {

                log(
                  'FINAL REAL CART',
                  finalCart
                );


                Ecwid.openPage(
                  'cart'
                );

              }
            );

          }
        );

      }
    );

  }


  /* ---------------------------------------------------------
     LEGACY SINGLE PRODUCT COMMAND
  --------------------------------------------------------- */

  function processLegacyCommand(
    params
  ) {

    if (!params) {
      return false;
    }


    var productId =
      Number(
        params.get(
          'ocAdd'
        )
      );


    if (!productId) {
      return false;
    }


    var qty =
      Number(
        params.get(
          'qty'
        ) || 1
      );


    var options = {};


    var rawOpts =
      params.get(
        'opts'
      );


    if (rawOpts) {

      try {

        options =
          JSON.parse(
            decodeURIComponent(
              escape(
                atob(
                  rawOpts
                )
              )
            )
          );


      } catch (e) {

        error(
          'could not decode legacy options',
          e
        );

      }

    }


    log(
      'legacy add command',
      {
        id:
          productId,

        quantity:
          qty,

        options:
          options
      }
    );


    Ecwid.Cart.addProduct({

      id:
        productId,

      quantity:
        qty,

      options:
        options,

      callback:
        function (
          success,
          product,
          cart,
          cartError
        ) {

          log(
            'legacy add result',
            success,
            cartError
          );


          if (success) {

            Ecwid.openPage(
              'cart'
            );

          }

        }

    });


    return true;

  }


  /* ---------------------------------------------------------
     RUN CART COMMAND
  --------------------------------------------------------- */

  function runCartCommand() {

    /*
     * NEW cart/create handoff
     */
    var cartPayload =
      findCartCreatePayload();


    if (cartPayload) {

      log(
        'processing cart/create command'
      );


      processCartCreate(
        cartPayload
      );


      return;

    }


    /*
     * OLD ?ocAdd= handoff
     */
    var legacyParams =
      getLegacyParams();


    if (
      processLegacyCommand(
        legacyParams
      )
    ) {

      return;

    }


    log(
      'no cart command found'
    );

  }


  /* ---------------------------------------------------------
     WAIT FOR ECWID
  --------------------------------------------------------- */

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
          'API loaded'
        );


        /*
         * Small delay gives the Wix integration time
         * to populate window.ec.config.currentRoute.
         */
        setTimeout(
          runCartCommand,
          250
        );

      }
    );

  }


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


  /*
   * Always blocked.
   *
   * Overrides ALLOWED_DATES.
   */
  var BLOCKED_DATES =
    [];


  /*
   * Explicit date exceptions.
   *
   * Overrides weekday rules.
   */
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


        if (yearMatch) {

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
              isNaN(day)
            ) {

              return;

            }


            /*
             * Determine actual month.
             *
             * Vue Datepicker may show
             * previous / next month cells.
             */
            var cellMonth =
              month;


            var cellYear =
              year;


            var isOffset =
              cell.classList.contains(
                'dp__cell_offset'
              );


            if (isOffset) {

              var rowIndex =
                Math.floor(
                  index / 7
                );


              if (
                rowIndex === 0 &&
                day > 20
              ) {

                /*
                 * Previous month
                 */
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

                /*
                 * Next month
                 */
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
              pad(day);


            var weekday =
              cellDate.getDay();


            var block =
              false;


            /*
             * Past dates
             */
            if (
              cellDate <
              todaySG
            ) {

              block =
                true;

            }


            /*
             * Today's cutoff
             */
            if (
              dateString ===
                todayKey &&
              pastCutoff
            ) {

              block =
                true;

            }


            /*
             * Weekday restriction
             */
            if (
              BLOCKED_WEEKDAYS
                .indexOf(
                  weekday
                ) !== -1
            ) {

              block =
                true;

            }


            /*
             * Explicit blocks
             */
            if (
              BLOCKED_DATES
                .indexOf(
                  dateString
                ) !== -1
            ) {

              block =
                true;

            }


            /*
             * Explicit allowed dates
             *
             * Override weekday restriction,
             * but NOT:
             *
             * - past dates
             * - explicit BLOCKED_DATES
             * - today's cutoff
             */
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


            if (block) {

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
      function (page) {

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
