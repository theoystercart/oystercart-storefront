/* =========================================================
   OYSTER CART — ECWID CART HANDOFF BRIDGE
   =========================================================

   Custom Wix storefront -> real Ecwid cart.

   IMPORTANT:
   Products with the same Ecwid product ID but different
   options MUST remain separate cart lines.

   This version:
   1. Decodes the Wix cart handoff.
   2. Checks exact product + exact options.
   3. Adds ONE cart line at a time.
   4. Waits until Ecwid.Cart.get() confirms that exact
      line exists before adding the next line.
   5. Only opens the cart after every requested line
      has been verified.
========================================================= */

(function () {
  'use strict';

  var PREFIX = '[OysterCart Cart Bridge]';

  var VERIFY_INTERVAL_MS = 400;
  var VERIFY_MAX_ATTEMPTS = 15;

  console.log(PREFIX, 'script running');


  /* =======================================================
     LOGGING
  ======================================================= */

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


  /* =======================================================
     UTF-8 BASE64 DECODING
  ======================================================= */

  function decodeBase64Utf8(base64) {

    try {

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


  /* =======================================================
     FIND cart/create PAYLOAD
  ======================================================= */

  function findCartCreatePayload() {

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

      var marker =
        'cart/create=';

      var markerIndex =
        source.indexOf(marker);

      if (
        markerIndex === -1
      ) {
        continue;
      }

      var payload =
        source.substring(
          markerIndex +
          marker.length
        );

      var questionIndex =
        payload.indexOf('?');

      if (
        questionIndex !== -1
      ) {

        payload =
          payload.substring(
            0,
            questionIndex
          );

      }

      var ampIndex =
        payload.indexOf('&');

      if (
        ampIndex !== -1
      ) {

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


  /* =======================================================
     LEGACY ocAdd SUPPORT
  ======================================================= */

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


  /* =======================================================
     OPTION NORMALIZATION
  ======================================================= */

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


  function normalizeOptionObject(options) {

    options =
      options || {};

    var normalized = {};

    Object.keys(options)
      .sort()
      .forEach(
        function (name) {

          normalized[
            String(name)
              .trim()
              .toLowerCase()
          ] =
            normalizeValue(
              options[name]
            );

        }
      );

    return normalized;
  }


  /*
   * EXACT option comparison.
   *
   * Previous version only checked option names contained
   * in "expected".
   *
   * This version requires both cart positions to have
   * exactly the same normalized option set.
   */
  function optionsMatch(
    expected,
    actual
  ) {

    var expectedNormalized =
      normalizeOptionObject(
        expected
      );

    var actualNormalized =
      normalizeOptionObject(
        actual
      );

    var expectedNames =
      Object.keys(
        expectedNormalized
      );

    var actualNames =
      Object.keys(
        actualNormalized
      );


    if (
      expectedNames.length !==
      actualNames.length
    ) {

      return false;
    }


    for (
      var i = 0;
      i < expectedNames.length;
      i++
    ) {

      var name =
        expectedNames[i];


      if (
        !Object.prototype
          .hasOwnProperty.call(
            actualNormalized,
            name
          )
      ) {

        return false;
      }


      if (
        expectedNormalized[name] !==
        actualNormalized[name]
      ) {

        return false;
      }

    }


    return true;
  }


  /* =======================================================
     CART ITEM HELPERS
  ======================================================= */

  function getItemProductId(item) {

    if (!item) {
      return null;
    }

    /*
     * Ecwid normally returns:
     *
     * item.product.id
     *
     * Keep fallbacks for diagnostics/compatibility.
     */
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


  function getItemOptions(item) {

    if (!item) {
      return {};
    }

    return (
      item.options ||
      {}
    );
  }


  function matchingQuantity(
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
          getItemProductId(item) !==
          Number(
            requestedProduct.id
          )
        ) {

          return;
        }


        if (
          !optionsMatch(
            requestedProduct.options || {},
            getItemOptions(item)
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


  /* =======================================================
     DIAGNOSTIC CART SUMMARY
  ======================================================= */

  function summarizeCart(cart) {

    if (
      !cart ||
      !Array.isArray(cart.items)
    ) {

      return [];
    }


    return cart.items.map(
      function (item) {

        return {

          id:
            getItemProductId(
              item
            ),

          quantity:
            Number(
              item.quantity || 0
            ),

          options:
            getItemOptions(
              item
            )

        };

      }
    );
  }


  /* =======================================================
     SESSION GUARD
  ======================================================= */

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


  /* =======================================================
     VERIFY EXACT CART LINE

     After addProduct callback fires, DON'T immediately
     add the next item.

     Poll the real cart until the exact option combination
     reaches the quantity we expect.
  ======================================================= */

  function waitForExactCartLine(
    job,
    targetQuantity,
    attempt,
    callback
  ) {

    attempt =
      attempt || 1;


    Ecwid.Cart.get(
      function (cart) {

        var actualQuantity =
          matchingQuantity(
            cart,
            job
          );


        log(
          'verification #' + attempt,
          {
            id:
              job.id,

            options:
              job.options || {},

            targetQuantity:
              targetQuantity,

            actualQuantity:
              actualQuantity,

            cart:
              summarizeCart(cart)
          }
        );


        if (
          actualQuantity >=
          targetQuantity
        ) {

          log(
            'VERIFIED exact cart line',
            {
              id:
                job.id,

              options:
                job.options || {},

              quantity:
                actualQuantity
            }
          );


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
            'VERIFY TIMEOUT — exact cart line not found',
            {
              job:
                job,

              targetQuantity:
                targetQuantity,

              actualQuantity:
                actualQuantity,

              cart:
                summarizeCart(cart)
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

            waitForExactCartLine(
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
     ADD ONE EXACT CART LINE
  ======================================================= */

  function addAndVerify(
    job,
    done
  ) {

    /*
     * First read current quantity of THIS exact line.
     *
     * Example:
     *
     * 1 kg currently = 0
     * adding          = 1
     * target          = 1
     */
    Ecwid.Cart.get(
      function (beforeCart) {

        var beforeQuantity =
          matchingQuantity(
            beforeCart,
            job
          );


        var quantityToAdd =
          Number(
            job.quantity || 1
          );


        var targetQuantity =
          beforeQuantity +
          quantityToAdd;


        log(
          'adding exact cart line',
          {
            id:
              job.id,

            quantityToAdd:
              quantityToAdd,

            beforeQuantity:
              beforeQuantity,

            targetQuantity:
              targetQuantity,

            options:
              job.options || {}
          }
        );


        Ecwid.Cart.addProduct({

          id:
            Number(
              job.id
            ),

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

                  productId:
                    product
                      ? product.id
                      : null,

                  error:
                    cartError,

                  requestedOptions:
                    job.options || {}
                }
              );


              if (!success) {

                error(
                  'could not add product',
                  job,
                  cartError
                );


                done(
                  false
                );

                return;
              }


              /*
               * Critical change:
               *
               * Callback success does NOT mean we immediately
               * trust the cart mutation.
               *
               * Wait until Ecwid.Cart.get() can see the exact
               * product + exact options.
               */
              setTimeout(
                function () {

                  waitForExactCartLine(
                    job,
                    targetQuantity,
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
     ADD JOBS SEQUENTIALLY

     Job 2 is not started until Job 1 has been verified
     in the real Ecwid cart.
  ======================================================= */

  function addProductsSequentially(
    jobs,
    index,
    done
  ) {

    if (
      index >=
      jobs.length
    ) {

      done(
        true
      );

      return;
    }


    var job =
      jobs[index];


    log(
      'starting job ' +
      (index + 1) +
      ' of ' +
      jobs.length,
      job
    );


    addAndVerify(
      job,
      function (verified) {

        if (!verified) {

          error(
            'cart import stopped because this line could not be verified',
            job
          );


          done(
            false
          );

          return;
        }


        /*
         * Give Ecwid a little extra time after verification
         * before mutating the cart again.
         */
        setTimeout(
          function () {

            addProductsSequentially(
              jobs,
              index + 1,
              done
            );

          },
          300
        );

      }
    );
  }


  /* =======================================================
     VERIFY COMPLETE REQUESTED CART
  ======================================================= */

  function verifyRequestedCart(
    requestedProducts,
    callback
  ) {

    Ecwid.Cart.get(
      function (cart) {

        var failures = [];


        requestedProducts.forEach(
          function (requested) {

            var expected =
              Number(
                requested.quantity ||
                1
              );


            var actual =
              matchingQuantity(
                cart,
                requested
              );


            if (
              actual < expected
            ) {

              failures.push({

                id:
                  requested.id,

                options:
                  requested.options ||
                  {},

                expected:
                  expected,

                actual:
                  actual

              });

            }

          }
        );


        log(
          'FINAL CART SUMMARY',
          summarizeCart(cart)
        );


        if (
          failures.length > 0
        ) {

          error(
            'FINAL CART VERIFICATION FAILED',
            failures
          );


          callback(
            false,
            cart
          );

          return;
        }


        log(
          'FINAL CART VERIFIED — all requested option combinations exist separately'
        );


        callback(
          true,
          cart
        );

      }
    );
  }


  /* =======================================================
     PROCESS cart/create
  ======================================================= */

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

      Ecwid.openPage(
        'cart'
      );

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
        JSON.parse(
          json
        );

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
     * Get REAL Ecwid cart.
     */
    Ecwid.Cart.get(
      function (currentCart) {

        log(
          'real Ecwid cart loaded',
          summarizeCart(
            currentCart
          )
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
              matchingQuantity(
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
         * Already present.
         */
        if (
          jobs.length === 0
        ) {

          log(
            'real cart already contains all requested items'
          );


          verifyRequestedCart(
            cartPayload.products,
            function (
              verified
            ) {

              if (
                verified
              ) {

                markProcessed(
                  encodedPayload
                );

                Ecwid.openPage(
                  'cart'
                );

              }

            }
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
          function (
            success
          ) {

            if (!success) {

              error(
                'cart import did not complete successfully'
              );

              return;
            }


            log(
              'all add jobs individually verified'
            );


            /*
             * One final verification against the ORIGINAL
             * requested cart payload.
             */
            verifyRequestedCart(
              cartPayload.products,
              function (
                verified,
                finalCart
              ) {

                if (!verified) {

                  error(
                    'not opening cart because final verification failed',
                    summarizeCart(
                      finalCart
                    )
                  );

                  return;
                }


                markProcessed(
                  encodedPayload
                );


                log(
                  'cart import finished successfully'
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


  /* =======================================================
     LEGACY SINGLE PRODUCT COMMAND
  ======================================================= */

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


    var legacyJob = {

      id:
        productId,

      quantity:
        qty,

      options:
        options

    };


    log(
      'legacy add command',
      legacyJob
    );


    addAndVerify(
      legacyJob,
      function (
        verified
      ) {

        if (
          verified
        ) {

          log(
            'legacy cart line verified'
          );

          Ecwid.openPage(
            'cart'
          );

        } else {

          error(
            'legacy cart line could not be verified'
          );

        }

      }
    );


    return true;
  }


  /* =======================================================
     RUN CART COMMAND
  ======================================================= */

  function runCartCommand() {

    var cartPayload =
      findCartCreatePayload();


    if (
      cartPayload
    ) {

      log(
        'processing cart/create command'
      );


      processCartCreate(
        cartPayload
      );


      return;
    }


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
          'API loaded'
        );


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
              pad(day);


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


            /*
             * ALLOWED_DATES overrides weekday blocks,
             * but not:
             *
             * - past dates
             * - explicit blocked dates
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
