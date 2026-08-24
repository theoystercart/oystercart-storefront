/* =========================================================
   OYSTER CART — ECWID CART HANDOFF BRIDGE
   =========================================================

   Custom Wix storefront -> real Ecwid cart.

   IMPORTANT:
   Wix sends the customer to Ecwid using:

       cart/create=<payload>

   Ecwid itself processes that cart/create command.

   Therefore this bridge MUST NOT call Cart.addProduct()
   for cart/create commands.

   The bridge now:
   1. Finds and decodes the Wix cart/create payload.
   2. Lets Ecwid perform the native cart import.
   3. Waits for the real Ecwid cart to populate.
   4. Normalizes Ecwid option data.
   5. Verifies product + options + quantity.
   6. Opens the cart only after verification.

   Cart.addProduct() is retained ONLY for the old
   legacy ocAdd command.
========================================================= */

(function () {
  'use strict';

  var PREFIX = '[OysterCart Cart Bridge]';

  var VERIFY_INTERVAL_MS = 500;
  var VERIFY_MAX_ATTEMPTS = 20;

  console.log(PREFIX, 'script running');


  /* =======================================================
     LOGGING
  ======================================================= */

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
     UTF-8 BASE64 DECODING
  ======================================================= */

  function decodeBase64Utf8(base64) {

    try {

      var decodedUrlPart =
        decodeURIComponent(
          base64
        );


      var binary =
        atob(
          decodedUrlPart
        );


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
        source.indexOf(
          marker
        );


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
        src.indexOf(
          'ocAdd'
        ) === -1
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
          new URLSearchParams(
            qs
          );


        if (
          params.get(
            'ocAdd'
          )
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
      Array.isArray(
        value
      )
    ) {

      return value
        .map(
          function (item) {

            if (
              typeof item !== 'object' ||
              item === null
            ) {

              return String(
                item
              )
                .trim()
                .toLowerCase();

            }


            var nestedValue =
              item.value !== undefined
                ? item.value
                : item.text !== undefined
                  ? item.text
                  : item.name !== undefined
                    ? item.name
                    : safeStringify(
                        item
                      );


            return String(
              nestedValue
            )
              .trim()
              .toLowerCase();

          }
        )
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


      return safeStringify(
        value
      )
        .trim()
        .toLowerCase();

    }


    return String(
      value
    )
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
      Array.isArray(
        options
      )
    ) {

      options.forEach(
        function (entry) {

          if (
            entry === undefined ||
            entry === null
          ) {

            return;

          }


          if (
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
              normalizeName(
                name
              )
            ] =
              normalizeValue(
                value
              );

          }

        }
      );


      return normalized;

    }


    if (
      typeof options === 'object'
    ) {

      Object.keys(
        options
      )
        .forEach(
          function (name) {

            var value =
              options[name];


            if (
              /^\d+$/.test(
                name
              ) &&
              value &&
              typeof value === 'object'
            ) {

              var nested =
                normalizeOptionObject(
                  [value]
                );


              Object.keys(
                nested
              )
                .forEach(
                  function (
                    nestedName
                  ) {

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
              normalizeName(
                name
              )
            ] =
              normalizeValue(
                value
              );

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

  function getItemProductId(
    item
  ) {

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


  function getItemQuantity(
    item
  ) {

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

      candidates.push({
        source:
          'item.options',

        value:
          item.options
      });

    }


    if (
      item.selectedOptions !== undefined
    ) {

      candidates.push({
        source:
          'item.selectedOptions',

        value:
          item.selectedOptions
      });

    }


    if (
      item.productOptions !== undefined
    ) {

      candidates.push({
        source:
          'item.productOptions',

        value:
          item.productOptions
      });

    }


    if (
      item.product &&
      item.product.options !== undefined
    ) {

      candidates.push({
        source:
          'item.product.options',

        value:
          item.product.options
      });

    }


    if (
      item.product &&
      item.product.selectedOptions !== undefined
    ) {

      candidates.push({
        source:
          'item.product.selectedOptions',

        value:
          item.product.selectedOptions
      });

    }


    if (
      item.product &&
      item.product.productOptions !== undefined
    ) {

      candidates.push({
        source:
          'item.product.productOptions',

        value:
          item.product.productOptions
      });

    }


    return candidates;

  }


  function findMatchingOptionCandidate(
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
          candidates[i].value
        )
      ) {

        return {
          matched:
            true,

          source:
            candidates[i].source,

          value:
            candidates[i].value,

          normalized:
            normalizeOptionObject(
              candidates[i].value
            )
        };

      }

    }


    return {
      matched:
        false,

      source:
        null,

      value:
        null,

      normalized:
        {}
    };

  }


  function matchingQuantity(
    cart,
    requestedProduct
  ) {

    if (
      !cart ||
      !Array.isArray(
        cart.items
      )
    ) {

      return 0;

    }


    var total = 0;


    cart.items.forEach(
      function (item) {

        if (
          getItemProductId(
            item
          ) !==
          Number(
            requestedProduct.id
          )
        ) {

          return;

        }


        var optionMatch =
          findMatchingOptionCandidate(
            item,
            requestedProduct.options ||
            {}
          );


        if (
          !optionMatch.matched
        ) {

          return;

        }


        total +=
          getItemQuantity(
            item
          );

      }
    );


    return total;

  }


  function totalQuantityForProduct(
    cart,
    productId
  ) {

    if (
      !cart ||
      !Array.isArray(
        cart.items
      )
    ) {

      return 0;

    }


    var total = 0;


    cart.items.forEach(
      function (item) {

        if (
          getItemProductId(
            item
          ) ===
          Number(
            productId
          )
        ) {

          total +=
            getItemQuantity(
              item
            );

        }

      }
    );


    return total;

  }


  /* =======================================================
     DIAGNOSTIC CART SUMMARY
  ======================================================= */

  function summarizeItem(
    item
  ) {

    var candidates =
      getItemOptionCandidates(
        item
      );


    return {

      id:
        getItemProductId(
          item
        ),

      quantity:
        getItemQuantity(
          item
        ),

      combinationId:
        item &&
        item.combinationId !== undefined
          ? item.combinationId
          : item &&
            item.product &&
            item.product.combinationId !== undefined
              ? item.product.combinationId
              : null,

      variationId:
        item &&
        item.variationId !== undefined
          ? item.variationId
          : item &&
            item.product &&
            item.product.variationId !== undefined
              ? item.product.variationId
              : null,

      sku:
        item &&
        item.sku !== undefined
          ? item.sku
          : item &&
            item.product &&
            item.product.sku !== undefined
              ? item.product.sku
              : null,

      optionCandidates:
        candidates.map(
          function (
            candidate
          ) {

            return {

              source:
                candidate.source,

              raw:
                candidate.value,

              normalized:
                normalizeOptionObject(
                  candidate.value
                )

            };

          }
        )

    };

  }


  function summarizeCart(
    cart
  ) {

    if (
      !cart ||
      !Array.isArray(
        cart.items
      )
    ) {

      return [];

    }


    return cart.items.map(
      function (item) {

        return summarizeItem(
          item
        );

      }
    );

  }


  function logRawCart(
    label,
    cart
  ) {

    log(
      label,
      safeStringify(
        cart
      )
    );


    log(
      label +
      ' SUMMARY',
      summarizeCart(
        cart
      )
    );

  }


  /* =======================================================
     SESSION GUARD
  ======================================================= */

  function getGuardKey(
    payload
  ) {

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
        payload.charCodeAt(
          i
        );


      hash =
        hash & hash;

    }


    return (
      'oystercart_cart_import_v4_' +
      String(
        hash
      )
    );

  }


  function alreadyProcessed(
    payload
  ) {

    try {

      return (
        sessionStorage.getItem(
          getGuardKey(
            payload
          )
        ) === 'done'
      );

    } catch (e) {

      return false;

    }

  }


  function markProcessed(
    payload
  ) {

    try {

      sessionStorage.setItem(
        getGuardKey(
          payload
        ),
        'done'
      );

    } catch (e) {}

  }


  /* =======================================================
     VERIFY EXACT CART LINE
     Used by LEGACY ocAdd only
  ======================================================= */

  function waitForExactCartLine(
    job,
    targetQuantity,
    productQuantityBefore,
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


        var productQuantityNow =
          totalQuantityForProduct(
            cart,
            job.id
          );


        log(
          'verification #' +
          attempt,
          {

            id:
              job.id,

            requestedOptions:
              job.options ||
              {},

            normalizedRequestedOptions:
              normalizeOptionObject(
                job.options ||
                {}
              ),

            targetQuantity:
              targetQuantity,

            actualQuantity:
              actualQuantity,

            productQuantityBefore:
              productQuantityBefore,

            productQuantityNow:
              productQuantityNow,

            cart:
              summarizeCart(
                cart
              )

          }
        );


        if (
          actualQuantity >=
          targetQuantity
        ) {

          log(
            'VERIFIED requested cart line',
            {

              id:
                job.id,

              options:
                job.options ||
                {},

              quantity:
                actualQuantity

            }
          );


          callback(
            true,
            cart,
            'exact'
          );


          return;

        }


        if (
          productQuantityNow >
          productQuantityBefore
        ) {

          error(
            'PRODUCT QUANTITY INCREASED BUT REQUESTED OPTIONS DID NOT MATCH',
            {

              job:
                job,

              productQuantityBefore:
                productQuantityBefore,

              productQuantityNow:
                productQuantityNow,

              rawCart:
                safeStringify(
                  cart
                ),

              cartSummary:
                summarizeCart(
                  cart
                )

            }
          );


          callback(
            false,
            cart,
            'merged-or-normalized'
          );


          return;

        }


        if (
          attempt >=
          VERIFY_MAX_ATTEMPTS
        ) {

          error(
            'VERIFY TIMEOUT — requested cart line not found',
            {

              job:
                job,

              targetQuantity:
                targetQuantity,

              actualQuantity:
                actualQuantity,

              productQuantityBefore:
                productQuantityBefore,

              productQuantityNow:
                productQuantityNow,

              rawCart:
                safeStringify(
                  cart
                ),

              cartSummary:
                summarizeCart(
                  cart
                )

            }
          );


          callback(
            false,
            cart,
            'timeout'
          );


          return;

        }


        setTimeout(
          function () {

            waitForExactCartLine(
              job,
              targetQuantity,
              productQuantityBefore,
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
     ADD ONE CART LINE
     LEGACY ocAdd ONLY
  ======================================================= */

  function addAndVerify(
    job,
    done
  ) {

    Ecwid.Cart.get(
      function (
        beforeCart
      ) {

        var beforeQuantity =
          matchingQuantity(
            beforeCart,
            job
          );


        var totalProductBefore =
          totalQuantityForProduct(
            beforeCart,
            job.id
          );


        var quantityToAdd =
          Number(
            job.quantity ||
            1
          );


        var targetQuantity =
          beforeQuantity +
          quantityToAdd;


        logRawCart(
          'RAW CART BEFORE LEGACY ADD',
          beforeCart
        );


        log(
          'legacy adding cart line',
          {

            id:
              job.id,

            quantityToAdd:
              quantityToAdd,

            exactLineQuantityBefore:
              beforeQuantity,

            totalProductQuantityBefore:
              totalProductBefore,

            targetExactLineQuantity:
              targetQuantity,

            options:
              job.options ||
              {}

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
            job.options ||
            {},

          callback:
            function (
              success,
              product,
              callbackCart,
              cartError
            ) {

              log(
                'legacy addProduct callback',
                {

                  success:
                    success,

                  product:
                    product ||
                    null,

                  error:
                    cartError,

                  requestedOptions:
                    job.options ||
                    {}

                }
              );


              if (
                callbackCart
              ) {

                logRawCart(
                  'RAW LEGACY CALLBACK CART',
                  callbackCart
                );

              }


              if (
                !success
              ) {

                error(
                  'could not add legacy product',
                  job,
                  cartError
                );


                done(
                  false,
                  'addProduct-failed'
                );


                return;

              }


              setTimeout(
                function () {

                  waitForExactCartLine(
                    job,
                    targetQuantity,
                    totalProductBefore,
                    1,
                    function (
                      verified,
                      verifiedCart,
                      reason
                    ) {

                      done(
                        verified,
                        reason,
                        verifiedCart
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
     PROCESS cart/create

     IMPORTANT:
     Ecwid processes cart/create itself.

     This function DOES NOT call Cart.addProduct().
  ======================================================= */

  function processCartCreate(
    encodedPayload
  ) {

    if (
      !encodedPayload
    ) {

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


    log(
      'waiting for Ecwid native cart/create import'
    );


    var attempt = 0;


    function checkNativeCartImport() {

      attempt++;


      Ecwid.Cart.get(
        function (cart) {

          logRawCart(
            'NATIVE CART CHECK #' +
            attempt,
            cart
          );


          var failures = [];


          cartPayload.products.forEach(
            function (
              requested
            ) {

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


              log(
                'native cart line comparison',
                {

                  id:
                    requested.id,

                  options:
                    requested.options ||
                    {},

                  normalizedOptions:
                    normalizeOptionObject(
                      requested.options ||
                      {}
                    ),

                  expected:
                    expected,

                  actual:
                    actual

                }
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


          if (
            failures.length === 0
          ) {

            log(
              'NATIVE cart/create import verified'
            );


            markProcessed(
              encodedPayload
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


          if (
            attempt >=
            VERIFY_MAX_ATTEMPTS
          ) {

            error(
              'NATIVE cart/create import timeout',
              {

                attempts:
                  attempt,

                missing:
                  failures,

                cart:
                  summarizeCart(
                    cart
                  )

              }
            );


            /*
             * Deliberately DO NOT call
             * Ecwid.Cart.addProduct() here.
             *
             * Doing that would recreate the
             * duplicate-cart race.
             */

            return;

          }


          setTimeout(
            checkNativeCartImport,
            VERIFY_INTERVAL_MS
          );

        }
      );

    }


    /*
     * Give Ecwid's own cart/create handler
     * a short head start before inspecting
     * the real cart.
     */

    setTimeout(
      checkNativeCartImport,
      500
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
        ) ||
        1
      );


    var options = {};


    var rawOpts =
      params.get(
        'opts'
      );


    if (
      rawOpts
    ) {

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
        verified,
        reason
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
            'legacy cart line could not be verified',
            reason
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


        /*
         * Ecwid needs time to begin handling
         * its native cart/create route.
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
