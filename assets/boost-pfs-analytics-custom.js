/** start: tracking event V2 **/

addEventListener('DOMContentLoaded', (event) => {
  /** variable **/
  if (!Utils.isCollectionPage) {
    const isCollectionPage = () => {
      return window.location.pathname.includes('/collections');
    };

    Utils.isCollectionPage = isCollectionPage;
  }

  if (window.Analytics) {
    var ANALYTICS_KEY = 'boostPFSAnalytics';
    var SESSION_KEY = 'boostPFSSessionId';
    var CLICKED_PRODUCT_KEY = 'boostPFSClickedProduct';
    var CART_TOKEN = '';
    var SESSION = '';
    var VIEWED_PRODUCT_DATA = null;
    var boostPFSRequestIds = 'boostPFSRequestIds';
    var AnalyticsEnum = {
      UserAction: {
        VIEW_PRODUCT: 'view_product',
        QUICK_VIEW: 'quick_view',
        ADD_TO_CART: 'add_to_cart',
        BUY_NOW: 'buy_now',
      },
      Action: {
        FILTER: 'filter',
        SEARCH: 'search',
        SUGGEST: 'suggest',
      },
    };

    /** utils function **/

    /**
     * Init analytics on instant search
     */
    Analytics.initInstantSearch = function () {
      if (Settings.getSettingValue('search.enableSuggestion')) {
        document.addEventListener('click', Analytics.onClickProductInSuggestion, true);
        document.addEventListener('keydown', Analytics.onClickProductInSuggestion, true);
      }
    };

    /**
     * Init analytics on collection/search page
     */
    Analytics.initCollectionSearchPage = function () {
      if (Selector.trackingProduct && jQ(Selector.products).length > 0) {
        document.addEventListener('click', Analytics.onClickProductInFilterResult, true);
      }
    };

    /**
     * Init analytics on product page.
     * Find and send a product click data in localStorage to server.
     */
    Analytics.initOtherPage = function () {
      // Send any analytics that was cancelled before it was sent
      var dataList = Analytics.getLocalStorage(ANALYTICS_KEY);
      if (!Array.isArray(dataList)) return;
      dataList.forEach((data) => {
        Analytics.sendProductClickData(data, true);
        if (data.pid == boostPFSAppConfig.general.product_id) {
          VIEWED_PRODUCT_DATA = data;
        }
      });

      /** If go to product page through our app, bind add to cart & buy now event **/
      if (Utils.isProductPage()) {
        if (Selector.trackingAddToCart) {
          document.addEventListener('click', Analytics.onClickAddToCartInProductPage, true);
        }
        if (Selector.trackingBuyNow) {
          document.addEventListener('click', Analytics.onClickBuyNowInProductPage, true);
        }
      }

      /** Because V2 use Recommendation of V3 so We will listen event clicked to productItem in Recommendation widget
       * Remove this product in clicked data for v2 only tracking add_to_cart, buy_now use v3 when click from here
       * avoid duplicate event add_to_cart, buy_now
       */
      document.addEventListener('click', Analytics.detectClickFromRecommendation, true);
    };

    Analytics.refreshCartToken = function (dataToRetry, retryCount = 3) {
      if (retryCount <= 0) {
        return;
      }

      fetch('/cart.js', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })
        .then((response) => response.json())
        .then((data) => {
          /*** min length token valid => 58, if < 58 token empty **/
          if (data.token && data.token.length > 58) {
            CART_TOKEN = data.token;
            if (dataToRetry) {
              dataToRetry.ct = data.token;
              Analytics.sendProductClickData(dataToRetry, true);
            }
          } else {
            setTimeout(() => Analytics.refreshCartToken(dataToRetry, retryCount - 1), 1000);
          }
        })
        .catch((error) => {
          setTimeout(() => Analytics.refreshCartToken(dataToRetry, retryCount - 1), 1000);
        });
    };

    /**
     * Generates a random unique session ID
     * @return {string} random unique ID
     */
    Analytics.generateUUID = function () {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = (Math.random() * 16) | 0,
          v = c == 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    };

    /**
     * Handle analytic on click product list in the collection/search page.
     * Save the clicked product data to localStorage.
     * @param {Event} event - the click event
     */
    Analytics.onClickProductInFilterResult = function (event) {
      if (!event || !event.target) return;
      var $clickedElement = jQ(event.target);

      var action = Utils.isSearchPage() ? AnalyticsEnum.Action.SEARCH : AnalyticsEnum.Action.FILTER;
      var userAction = AnalyticsEnum.UserAction.VIEW_PRODUCT;
      if (
        Selector.trackingQuickView &&
        $clickedElement.closest(Selector.trackingQuickView).length > 0
      ) {
        userAction = AnalyticsEnum.UserAction.QUICK_VIEW;
      }
      if (
        (Selector.trackingAddToCart &&
          $clickedElement.closest(Selector.trackingAddToCart).length > 0) ||
        ($clickedElement.closest(Selector.products).length > 0 &&
          Analytics.isClickAddToCart(event.target))
      ) {
        userAction = AnalyticsEnum.UserAction.ADD_TO_CART;
      }
      if (Selector.trackingBuyNow && $clickedElement.closest(Selector.trackingBuyNow).length > 0) {
        userAction = AnalyticsEnum.UserAction.BUY_NOW;
      }

      /** If the user clicked quickview button,
       * and then click add to cart/buy now within the quick view modal,
       * but the modal is outside of the product grid item,
       * we'll use the last clicked id from the quick view event
       **/
      var productId = '';
      var $productElement = $clickedElement.closest(Selector.trackingProduct);
      /** If found product grid item **/
      if ($productElement.length > 0) {
        productId = $productElement.attr('data-id');
        /** If not found product grid item, maybe we're inside a quickview modal. **/
      } else if (VIEWED_PRODUCT_DATA) {
        /** Add to cart and buy now within modal **/
        if (
          userAction == AnalyticsEnum.UserAction.ADD_TO_CART ||
          userAction == AnalyticsEnum.UserAction.BUY_NOW
        ) {
          productId = VIEWED_PRODUCT_DATA.pid;
        }
      }
      if (!productId) return;

      var data = Analytics.buildProductClickData(productId, userAction, action);
      Analytics.addProductClickData(data);
      Analytics.sendProductClickData(data, true);

      if (userAction == AnalyticsEnum.UserAction.QUICK_VIEW) {
        VIEWED_PRODUCT_DATA = data;
      } else {
        VIEWED_PRODUCT_DATA = null;
      }
    };

    /**
     * Handle analytic on click product in search suggestion.
     * Save the clicked product data to localStorage.
     * @param {Event} event - the click event
     */
    Analytics.onClickProductInSuggestion = function (event) {
      if (!event || !event.target) return;

      /** Check for keyboard enter event **/
      if (event.type == 'keydown' && event.keyCode != 13) return;

      var $clickedElement = jQ(event.target);
      var $productElement = $clickedElement.closest('.' + Class.searchSuggestionItem + '-product');
      if (!$productElement) return;

      var productId = $productElement.attr('data-id');
      if (!productId) return;

      var data = Analytics.buildProductClickData(
        productId,
        AnalyticsEnum.UserAction.VIEW_PRODUCT,
        AnalyticsEnum.Action.SUGGEST
      );
      Analytics.addProductClickData(data);
    };

    Analytics.isClickAddToCart = function (activeElement) {
      if (!activeElement) return false;
      if (
        ['SPAN', 'XVG'].includes(activeElement.tagName) &&
        activeElement.parentElement?.tagName === 'BUTTON'
      ) {
        activeElement = activeElement.parentElement;
      }

      const addToCartKeywords = [
        'boost-pfs-addtocart-btn',
        'customizeAdd',
        'add to cart',
        'add-to-cart',
        'add to bag',
        'add_to_cart',
        'addtocart',
        'data-product-form-add',
        'name="add"',
        'add to basket',
        'atc-button',
      ];

      const innerText = activeElement?.outerHTML?.toLowerCase() || '';

      return addToCartKeywords.some((keyword) => innerText.includes(keyword));
    };

    Analytics.onClickAddToCartInProductPage = function (event) {
      if (
        event &&
        event.target &&
        (jQ(event.target).closest(Selector.trackingAddToCart).length > 0 ||
          Analytics.isClickAddToCart(event.target))
      ) {
        var data = {
          tid: Globals.shopDomain,
          pid: boostPFSAppConfig.general.product_id.toString(),
          ct: CART_TOKEN,
          r: document.referrer,
          u: AnalyticsEnum.UserAction.ADD_TO_CART,
        };

        var productClickedData = Analytics.getLocalStorage(CLICKED_PRODUCT_KEY) || {};

        if (productClickedData[boostPFSAppConfig.general.product_id]) {
          data = Object.assign(productClickedData[boostPFSAppConfig.general.product_id], data);
          Analytics.addProductClickData(data);
          Analytics.sendProductClickData(data);
        }
      }
    };

    Analytics.onClickBuyNowInProductPage = function (event) {
      if (event && event.target && jQ(event.target).closest(Selector.trackingBuyNow).length > 0) {
        var data = {
          tid: Globals.shopDomain,
          pid: boostPFSAppConfig.general.product_id.toString(),
          u: AnalyticsEnum.UserAction.BUY_NOW,
          ct: CART_TOKEN,
        };

        var productClickedData = Analytics.getLocalStorage(CLICKED_PRODUCT_KEY) || {};

        if (productClickedData[boostPFSAppConfig.general.product_id]) {
          data = productClickedData[boostPFSAppConfig.general.product_id];
          data.u = AnalyticsEnum.UserAction.BUY_NOW;
          Analytics.addProductClickData(data);
          Analytics.sendProductClickData(data);
        }
      }
    };

    /**
     * Build product click data in collection/search page and in instant search.
     * @param {Number} productId
     * @param {AnalyticsEnum.UserAction} userAction - UserAction enum
     * @param {AnalyticsEnum.Action} action - Action enum
     * @return {Object} data - the click data to be add to localStorage/send to server.
     */
    Analytics.buildProductClickData = (productId, userAction, action) => {
      var currentTime = new Date();

      /** Get cart token from global **/
      var cartToken = CART_TOKEN;

      /** Merge quick_view and view_product when sending to backend **/
      var mergeUserAction =
        userAction == AnalyticsEnum.UserAction.QUICK_VIEW
          ? AnalyticsEnum.UserAction.VIEW_PRODUCT
          : userAction;

      /** Get query string data **/
      var queryString = '';
      if (action == AnalyticsEnum.Action.FILTER) {
        queryString += 'collection_scope=' + Globals.collectionId;
      } else {
        queryString += 'q=' + Globals.currentTerm;
      }
      if (action == AnalyticsEnum.Action.FILTER || action == AnalyticsEnum.Action.SEARCH) {
        var filteredKeys = Object.keys(Globals.queryParams).filter((key) =>
          key.startsWith(Globals.prefix)
        );
        if (filteredKeys && filteredKeys.length > 0) {
          filteredKeys.forEach((key) => {
            var values = Globals.queryParams[key];
            if (Array.isArray(values)) {
              values.forEach((value) => {
                queryString += '&' + key + '=' + encodeURIComponent(value);
              });
            } else {
              queryString += '&' + key + '=' + encodeURIComponent(values);
            }
          });
        }
      }

      var requestIds = Analytics.getLocalStorage(boostPFSRequestIds);

      /** Build data **/
      var data = {
        tid: Globals.shopDomain,
        ct: cartToken,
        pid: productId,
        t: currentTime.toISOString(),
        u: mergeUserAction,
        a: action,
        qs: queryString,
        r: document.referrer,
        rid: requestIds[action]?.rid,
      };

      /** save productClickedData key **/
      var preValue = Analytics.getLocalStorage(CLICKED_PRODUCT_KEY) || {};

      Analytics.setLocalStorage(CLICKED_PRODUCT_KEY, {
        [productId]: {
          ...data,
        },
        ...preValue,
      });

      return data;
    };

    /** catch event when click productItem in Recommendation **/
    Analytics.detectClickFromRecommendation = function (event) {
      if (!event || !event.target) return;

      var $clickedElement = jQ(event.target);
      var productItemV3 = $clickedElement.closest('.boost-sd__product-item');
      if (productItemV3.length > 0) {
        var productId = productItemV3[0].id;
        var variantId = productItemV3[0]['data-product-id'];

        productId && Analytics.removeProductIdClickedProductItemInRecommendation(productId);
        variantId && Analytics.removeProductIdClickedProductItemInRecommendation(variantId);
      }
    };

    /** Remove productId from Object CLICKED_PRODUCT_KEY avoid duplicate event when v2 use recommendation **/
    Analytics.removeProductIdClickedProductItemInRecommendation = function (productId) {
      var preValue = Analytics.getLocalStorage(CLICKED_PRODUCT_KEY) || {};

      delete preValue[productId];

      Analytics.setLocalStorage(CLICKED_PRODUCT_KEY, {
        ...preValue,
      });
    };

    /**
     * Add product click data in local storage.
     * @param {Object} data - product click data
     */
    Analytics.addProductClickData = function (data) {
      /** Get data list from local storage **/
      var dataList = Analytics.getLocalStorage(ANALYTICS_KEY);
      if (!Array.isArray(dataList)) dataList = [];

      /** Add new data to the list, without duplicated id **/
      var newDataList = dataList.filter((x) => x.pid != data.productId);
      newDataList.push(data);

      Analytics.setLocalStorage(ANALYTICS_KEY, newDataList);
    };

    Analytics.removeProductClickData = function (productId) {
      /** Get data list from local storage **/
      var dataList = Analytics.getLocalStorage(ANALYTICS_KEY);
      if (!Array.isArray(dataList)) return;

      /** Filter for products that doesn't match the id **/
      var newDataList = dataList.filter((x) => x.pid != productId);
      Analytics.setLocalStorage(ANALYTICS_KEY, newDataList);
    };

    Analytics.getLocalStorage = function (key) {
      try {
        return JSON.parse(localStorage.getItem(key));
      } catch {
        return null;
      }
    };

    Analytics.setLocalStorage = function (key, value) {
      try {
        if (value != null) {
          localStorage.setItem(key, JSON.stringify(value));
        } else {
          localStorage.setItem(key, '');
        }
      } catch {}
    };

    /**
     * Send product click data to server.
     * @param {Object} data - product click data
     * @param {boolean} triedToGetToken - tried to get cart token by calling cart.js or not
     */
    Analytics.sendProductClickData = function (data, triedToGetToken) {
      if (!data.rid) return;
      /** addToCart or BuyNow refresh cartToken  **/
      if (
        [AnalyticsEnum.UserAction.ADD_TO_CART, AnalyticsEnum.UserAction.BUY_NOW].includes(data.u)
      ) {
        triedToGetToken = false;
      }
      if (!triedToGetToken && !data.ct) {
        setTimeout(function () {
          Analytics.refreshCartToken(data);
        }, 1000);
        return;
      }

      data.sid = SESSION;

      Analytics.removeProductClickData(data.pid);

      /** Set up HTTP request **/
      var xhr = new XMLHttpRequest();
      xhr.open('POST', Api.getApiUrl('analytics'));
      xhr.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
      xhr.send(JSON.stringify(data));
    };

    Analytics.getSessionId = function () {
      if (SESSION) {
        return SESSION;
      } else {
        SESSION = Analytics.getLocalStorage(SESSION_KEY);
      }
      if (!SESSION) {
        SESSION = Analytics.generateUUID();
        Analytics.setLocalStorage(SESSION_KEY, SESSION);
      }
      return SESSION;
    };

    /** customize function **/
    if (Utils.isSearchPage() || (Utils.isCollectionPage() && !Utils.isProductPage())) {
      FilterApi.afterCall = function (result, eventType, eventInfo) {
        var key = AnalyticsEnum.Action.FILTER;
        if (Utils.isSearchPage()) {
          key = AnalyticsEnum.Action.SEARCH;
        }

        var preValue = Analytics.getLocalStorage(boostPFSRequestIds) || {};

        Analytics.setLocalStorage(boostPFSRequestIds, {
          ...preValue,
          [key]: {
            rid: result?.meta?.rid,
            data: result,
          },
        });
      };
    }

    InstantSearchApi.afterCall = function (result) {
      var preValue = Analytics.getLocalStorage(boostPFSRequestIds) || {};

      Analytics.setLocalStorage(boostPFSRequestIds, {
        ...preValue,
        [AnalyticsEnum.Action.SUGGEST]: {
          rid: result?.meta?.rid,
          data: result,
        },
      });
    };

    Analytics.init = function () {
      if (!window.XMLHttpRequest) return;

      CART_TOKEN = '';
      SESSION = Analytics.getLocalStorage(SESSION_KEY);
      if (!SESSION) {
        SESSION = Analytics.generateUUID();
        Analytics.setLocalStorage(SESSION_KEY, SESSION);
      }

      Analytics.initInstantSearch();
      Analytics.initCollectionSearchPage();
      Analytics.initOtherPage();
    };

    window.Analytics = Analytics;

    setTimeout(function awaitTriggerDone() {
      Analytics?.init();
      console.log('Have customize tracking events for analytics V2');
    }, 1000);
  } else {
    console.log('This page have not tracking events for analytics V2');
  }
});

/** end: tracking event V2 **/