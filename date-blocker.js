/* =========================================================
   OYSTER CART — ECWID ADDITIVE CART BRIDGE
   VERSION 7

   Wix parent page:
       #onlineStore1.postMessage(...)

   Ecwid iframe:
       window message receiver

   PURPOSE:
   - Preserve existing Ecwid cart.
   - Add only NEW Wix products.
   - Same configuration can merge quantity naturally.
   - Different configurations remain separate.
   - Prevent duplicate handoff replay.
   - Protect against Back / Forward / refresh.
========================================================= */

(function () {

  'use strict';


  var PREFIX =
    '[OysterCart Bridge V7]';


  var API_READY =
    false;


  var ACTIVE_HANDOFF_ID =
    null;


  var READY_TIMER =
    null;


  var READY_COUNT =
    0;


  var MAX_READY_MESSAGES =
    30;


  var STORAGE_KEY =
    'oysterCart_handoff_state_v7';



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



  /* =======================================================
     SEND MESSAGE TO WIX PARENT
  ======================================================= */

  function sendToWix(message) {

    try {

      window.parent.postMessage(
        message,
        '*'
      );


      log(
        'Sent to Wix:',
        message
      );


    } catch (err) {

      error(
        'Could not message Wix parent:',
        err
      );

    }

  }



  /* =======================================================
     READY HANDSHAKE
  ======================================================= */

  function announceReady() {

    if (
      !API_READY
    ) {

      return;

    }


    sendToWix({

      type:
        'OYSTER_CART_BRIDGE_READY'

    });


    READY_COUNT++;


    if (
      READY_COUNT >=
      MAX_READY_MESSAGES
    ) {

      stopReadyAnnouncements();

    }

  }


  function startReadyAnnouncements() {

    stopReadyAnnouncements();


    READY_COUNT =
      0;


    /*
     * Send immediately.
     */

    announceReady();


    /*
     * Repeat briefly.
     *
     * If Wix page wasn't listening on the first
     * millisecond, the next READY message catches it.
     */

    READY_TIMER =
      setInterval(
        announceReady,
        300
      );

  }


  function stopReadyAnnouncements() {

    if (
      READY_TIMER
    ) {

      clearInterval(
        READY_TIMER
      );


      READY_TIMER =
        null;

    }

  }



  /* =======================================================
     HANDOFF STATE STORAGE
  ======================================================= */

  function readState() {

    try {

      var raw =
        localStorage.getItem(
          STORAGE_KEY
        );


      if (!raw) {

        return {};

      }


      var parsed =
        JSON.parse(
          raw
        );


      if (
        !parsed ||
        typeof parsed !==
          'object'
      ) {

        return {};

      }


      return parsed;


    } catch (err) {

      return {};

    }

  }


  function writeState(state) {

    try {

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(
          state
        )
      );


    } catch (err) {

      error(
        'Could not persist handoff state:',
        err
      );

    }

  }


  function getHandoffState(
    handoffId
  ) {

    var state =
      readState();


    return (
      state[
        handoffId
      ] ||
      null
    );

  }


  function saveHandoffState(
    handoffId,
    handoffState
  ) {

    var state =
      readState();


    state[
      handoffId
    ] =
      handoffState;


    /*
     * Keep storage bounded.
     */

    var ids =
      Object.keys(
        state
      );


    if (
      ids.length >
      40
    ) {

      ids
        .sort(
          function (
            a,
            b
          ) {

            return (
              Number(
                state[a].updatedAt ||
                0
              ) -
              Number(
                state[b].updatedAt ||
                0
              )
            );

          }
        )
        .slice(
          0,
          ids.length -
            40
        )
        .forEach(
          function (id) {

            delete state[id];

          }
        );

    }


    writeState(
      state
    );

  }



  /* =======================================================
     VALIDATE PRODUCT
  ======================================================= */

  function cleanProduct(
    product
  ) {

    if (
      !product ||
      !product.id
    ) {

      return null;

    }


    var clean = {

      id:
        Number(
          product.id
        ),

      quantity:
        Number(
          product.quantity ||
          1
        )

    };


    if (
      !clean.id ||
      isNaN(
        clean.id
      )
    ) {

      return null;

    }


    if (
      !clean.quantity ||
      clean.quantity <
        1
    ) {

      clean.quantity =
        1;

    }


    if (
      product.options &&
      typeof product.options ===
        'object'
    ) {

      clean.options =
        product.options;

    }


    return clean;

  }



  /* =======================================================
     ADD ONE PRODUCT
  ======================================================= */

  function addOneProduct(
    product
  ) {

    return new Promise(
      function (
        resolve,
        reject
      ) {

        var clean =
          cleanProduct(
            product
          );


        if (!clean) {

          reject(
            new Error(
              'Invalid product payload'
            )
          );


          return;

        }


        log(
          'Adding product:',
          clean
        );


        try {

          Ecwid.Cart.addProduct({

            id:
              clean.id,

            quantity:
              clean.quantity,

            options:
              clean.options ||
              {},

            callback:
              function (
                success,
                addedProduct,
                cart,
                cartError
              ) {

                log(
                  'addProduct callback:',
                  {
                    success:
                      success,

                    product:
                      addedProduct ||
                      null,

                    error:
                      cartError ||
                      null
                  }
                );


                if (
                  success
                ) {

                  resolve({
                    product:
                      clean,

                    cart:
                      cart ||
                      null
                  });


                  return;

                }


                reject(
                  new Error(
                    cartError
                      ? String(
                          cartError
                        )
                      : 'Ecwid.Cart.addProduct failed'
                  )
                );

              }

          });


        } catch (err) {

          reject(
            err
          );

        }

      }
    );

  }



  /* =======================================================
     PROCESS HANDOFF
  ======================================================= */

  async function processHandoff(
    message
  ) {

    var handoffId =
      String(
        message.handoffId ||
        ''
      );


    var products =
      Array.isArray(
        message.products
      )
        ? message.products
        : [];


    if (
      !handoffId ||
      products.length ===
        0
    ) {

      error(
        'Invalid handoff:',
        message
      );


      sendToWix({

        type:
          'OYSTER_CART_HANDOFF_ERROR',

        handoffId:
          handoffId,

        error:
          'Invalid handoff payload'

      });


      return;

    }


    /*
     * Stop READY spam after Wix responds.
     */

    stopReadyAnnouncements();


    /* -----------------------------------------------------
       SAME HANDOFF CURRENTLY PROCESSING
    ----------------------------------------------------- */

    if (
      ACTIVE_HANDOFF_ID ===
      handoffId
    ) {

      log(
        'Same handoff already processing — ignored:',
        handoffId
      );


      return;

    }


    var previous =
      getHandoffState(
        handoffId
      );


    /* -----------------------------------------------------
       ALREADY COMPLETED
       This is our replay protection.
    ----------------------------------------------------- */

    if (
      previous &&
      previous.status ===
        'complete'
    ) {

      log(
        'Handoff already completed — replay ignored:',
        handoffId
      );


      sendToWix({

        type:
          'OYSTER_CART_HANDOFF_SUCCESS',

        handoffId:
          handoffId,

        replay:
          true

      });


      setTimeout(
        function () {

          Ecwid.openPage(
            'cart'
          );

        },
        100
      );


      return;

    }


    ACTIVE_HANDOFF_ID =
      handoffId;


    /*
     * If a previous attempt stopped after item 0,
     * completedIndexes allows us to resume without
     * adding item 0 again.
     */

    var completedIndexes =

      previous &&
      Array.isArray(
        previous.completedIndexes
      )

        ? previous.completedIndexes.slice()

        : [];


    saveHandoffState(
      handoffId,
      {

        status:
          'processing',

        completedIndexes:
          completedIndexes,

        updatedAt:
          Date.now()

      }
    );


    try {

      for (
        var index = 0;
        index <
          products.length;
        index++
      ) {

        /*
         * Already successfully added in an earlier
         * attempt? Skip it.
         */

        if (
          completedIndexes.indexOf(
            index
          ) !==
          -1
        ) {

          log(
            'Skipping already completed line:',
            index
          );


          continue;

        }


        await addOneProduct(
          products[index]
        );


        completedIndexes.push(
          index
        );


        saveHandoffState(
          handoffId,
          {

            status:
              'processing',

            completedIndexes:
              completedIndexes.slice(),

            updatedAt:
              Date.now()

          }
        );

      }


      /* ---------------------------------------------------
         ALL PRODUCTS SUCCESSFUL
      --------------------------------------------------- */

      saveHandoffState(
        handoffId,
        {

          status:
            'complete',

          completedIndexes:
            completedIndexes.slice(),

          updatedAt:
            Date.now()

        }
      );


      log(
        'HANDOFF COMPLETE:',
        handoffId
      );


      sendToWix({

        type:
          'OYSTER_CART_HANDOFF_SUCCESS',

        handoffId:
          handoffId

      });


      ACTIVE_HANDOFF_ID =
        null;


      /*
       * Give acknowledgement a moment to reach Wix
       * before changing Ecwid internal page.
       */

      setTimeout(
        function () {

          Ecwid.openPage(
            'cart'
          );

        },
        200
      );


    } catch (err) {

      error(
        'HANDOFF FAILED:',
        handoffId,
        err
      );


      saveHandoffState(
        handoffId,
        {

          status:
            'failed',

          completedIndexes:
            completedIndexes.slice(),

          error:
            String(
              err &&
              err.message
                ? err.message
                : err
            ),

          updatedAt:
            Date.now()

        }
      );


      sendToWix({

        type:
          'OYSTER_CART_HANDOFF_ERROR',

        handoffId:
          handoffId,

        error:
          String(
            err &&
            err.message
              ? err.message
              : err
          )

      });


      ACTIVE_HANDOFF_ID =
        null;


      /*
       * Start announcing READY again so a refresh
       * or retry can resume the incomplete handoff.
       */

      setTimeout(
        startReadyAnnouncements,
        500
      );

    }

  }



  /* =======================================================
     RECEIVE MESSAGE FROM WIX
  ======================================================= */

  window.addEventListener(

    'message',

    function (event) {

      var message =
        event.data;


      if (
        !message ||
        typeof message !==
          'object'
      ) {

        return;

      }


      if (
        message.type ===
        'OYSTER_CART_HANDOFF'
      ) {

        log(
          'Received handoff from Wix:',
          message.handoffId
        );


        processHandoff(
          message
        );


        return;

      }


      if (
        message.type ===
        'OYSTER_CART_OPEN_CART'
      ) {

        log(
          'Open-cart command received'
        );


        if (
          API_READY
        ) {

          Ecwid.openPage(
            'cart'
          );

        }

      }

    }

  );



  /* =======================================================
     ECWID API READY
  ======================================================= */

  function startBridge() {

    if (
      typeof Ecwid ===
        'undefined' ||
      !Ecwid.OnAPILoaded
    ) {

      setTimeout(
        startBridge,
        250
      );


      return;

    }


    Ecwid.OnAPILoaded.add(
      function () {

        API_READY =
          true;


        log(
          'Ecwid API READY'
        );


        startReadyAnnouncements();

      }
    );

  }


  log(
    'Loaded'
  );


  startBridge();

})();



/* =========================================================
   OYSTER CART — DATE BLOCKER
   Mussel Madness Ticket

   Existing date blocker retained.
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
              ) !==
              -1
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
          month ===
            -1 ||
          year ===
            -1
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
              ) ===
              'true'
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


            if (
              isOffset
            ) {

              var rowIndex =
                Math.floor(
                  index /
                  7
                );


              if (
                rowIndex ===
                  0 &&
                day >
                  20
              ) {

                cellMonth =
                  month -
                  1;


                if (
                  cellMonth <
                  0
                ) {

                  cellMonth =
                    11;


                  cellYear =
                    year -
                    1;

                }


              } else {

                cellMonth =
                  month +
                  1;


                if (
                  cellMonth >
                  11
                ) {

                  cellMonth =
                    0;


                  cellYear =
                    year +
                    1;

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
                ) !==
              -1
            ) {

              block =
                true;

            }


            if (
              BLOCKED_DATES
                .indexOf(
                  dateString
                ) !==
              -1
            ) {

              block =
                true;

            }


            if (
              ALLOWED_DATES
                .indexOf(
                  dateString
                ) !==
                -1 &&

              cellDate >=
                todaySG &&

              BLOCKED_DATES
                .indexOf(
                  dateString
                ) ===
                -1 &&

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
          'Target product detected'
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


/* =========================================================
   OYSTER CART — CART PRODUCT LINK REROUTER
   VERSION 1

   PURPOSE:
   - Re-route ONLY selected normal-delivery products from the
     Ecwid cart to their new Wix /products/... pages.
   - Run ONLY while Ecwid is displaying the CART.
   - Leave workshops, events, tickets, and every unlisted
     Ecwid product completely untouched.
   - Preserve Ecwid as the product page for items that still
     depend on Ecwid-specific controls such as date pickers.
========================================================= */

(function () {

  'use strict';


  var PREFIX =
    '[OysterCart Cart Links V1]';


  /*
   * IMPORTANT:
   * This is a strict allow-list.
   *
   * If a product ID is NOT listed here, its Ecwid link
   * is not changed.
   *
   * Therefore workshop/event products remain on Ecwid
   * unless they are deliberately added to this list later.
   */
  var PRODUCT_URLS = {

    '522362757':
      '/products/deluxe',

    '530329925':
      '/products/mix',

    '522415252':
      '/products/premium',

    '207786863':
      '/products/cold-littleneck-clams',

    '488853391':
      '/products/classic-wine-broth-mussel-pot',

    '704106068':
      '/products/dashi-clams',

    '531010906':
      '/products/fine-de-claire',

    '185491924':
      '/products/oyster-soiree',

    '703979636':
      '/products/chilli-tomato-mussels',

    '824351028':
      '/products/green-lipped-mussels-in-wine-broth',

    '438103589':
      '/products/caviar-tart',

    '393943369':
      '/products/kaviari-caviar',

    '445743026':
      '/products/arctic-cold-shrimps',

    '260170144':
      '/products/cocktail-shrimps',

    '374456001':
      '/products/mexican-seafood-ceviche',

    '445455381':
      '/products/seafood-stew',

    '199205320':
      '/products/shrimp-lobster-rolls',

    '807467598':
      '/products/smoked-cream-cheese-platter',

    '810652253':
      '/products/handsmoked-cold-salmon',

    '805505400':
      '/products/aus-striploin',

    '805523047':
      '/products/nz-grain-fed-tomahawk',

    '528371264':
      '/products/beef-tartare'

  };


  var observer =
    null;


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


  function extractProductId(
    href
  ) {

    if (!href) {

      return null;

    }


    /*
     * Standard Ecwid/Wix product URLs look like:
     *
     * /online-store/Deluxe-p522362757
     */
    var match =
      String(href).match(
        /-p(\d+)(?:[/?#]|$)/i
      );


    if (
      match &&
      match[1]
    ) {

      return String(
        match[1]
      );

    }


    return null;

  }


  function rewriteCartProductLinks() {

    var links =
      document.querySelectorAll(
        'a[href*="-p"]'
      );


    var changed =
      0;


    Array.prototype.forEach.call(
      links,
      function (link) {

        var oldHref =
          link.getAttribute(
            'href'
          ) ||
          '';


        var productId =
          extractProductId(
            oldHref
          );


        if (!productId) {

          return;

        }


        var newPath =
          PRODUCT_URLS[
            productId
          ];


        /*
         * Not on our delivery-product allow-list?
         *
         * Leave it exactly as Ecwid created it.
         * This is what protects workshops/events.
         */
        if (!newPath) {

          return;

        }


        var newUrl =
          'https://www.theoystercart.com' +
          newPath;


        if (
          link.href ===
          newUrl
        ) {

          return;

        }


        link.href =
          newUrl;


        /*
         * Ecwid is inside the Wix app iframe.
         * Open the Wix dynamic product page at the
         * top-level site, never inside the Ecwid iframe.
         */
        link.target =
          '_top';


        changed++;


        log(
          'Rewritten:',
          {
            productId:
              productId,

            oldHref:
              oldHref,

            newHref:
              newUrl
          }
        );

      }
    );


    if (
      changed >
      0
    ) {

      log(
        'Cart links updated:',
        changed
      );

    }

  }


  function stopObserver() {

    if (
      observer
    ) {

      observer.disconnect();

      observer =
        null;

    }

  }


  function startObserver() {

    stopObserver();


    rewriteCartProductLinks();


    observer =
      new MutationObserver(
        function () {

          rewriteCartProductLinks();

        }
      );


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


  function startCartLinkRerouter() {

    if (
      typeof Ecwid ===
        'undefined' ||
      !Ecwid.OnAPILoaded ||
      !Ecwid.OnPageLoaded
    ) {

      setTimeout(
        startCartLinkRerouter,
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
          !page ||
          page.type !==
            'CART'
        ) {

          /*
           * Outside the cart, do absolutely nothing.
           */
          stopObserver();

          return;

        }


        log(
          'Cart detected'
        );


        startObserver();

      }
    );

  }


  log(
    'Loaded'
  );


  startCartLinkRerouter();

})();
