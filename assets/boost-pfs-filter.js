// Fix the confict suggestion search in Debut theme
if (typeof theme !== 'undefined' && theme.hasOwnProperty('settings')) theme.settings.predictiveSearchEnabled = false;
// Override Settings
var boostPFSFilterConfig = {
	general: {
		limit: boostPFSThemeConfig.custom.products_per_page,
		// Optional
		loadProductFirst: false,
		styleScrollToTop: 'style2',
		defaultDisplay: boostPFSThemeConfig.custom.layout,
		showPlaceholderProductList: true
	},
  selector: {
		otpButtons: '.grid-view-item .grid-view-item__image-wrapper'
	},
};

(function() {
	BoostPFS.inject(this);

	ProductGridItem.prototype.compileTemplate = function(data) {
		if (!data) data = this.data;
		/*** Prepare data ***/
		var images = data.images_info;
		// Displaying price base on the policy of Shopify, have to multiple by 100
		var soldOut = !data.available; // Check a product is out of stock
		var onSale = data.compare_at_price_min > data.price_min; // Check a product is on sale
		var priceVaries = data.price_min != data.price_max; // Check a product has many prices
		// Get First Variant (selected_or_first_available_variant)
		var firstVariant = data['variants'][0];
		if (Utils.getParam('variant') !== null && Utils.getParam('variant') != '') {
			var paramVariant = data.variants.filter(function(e) {
				return e.id == Utils.getParam('variant');
			});
			if (typeof paramVariant[0] !== 'undefined') firstVariant = paramVariant[0];
		} else {
			for (var i = 0; i < data['variants'].length; i++) {
				if (data['variants'][i].available) {
					firstVariant = data['variants'][i];
					break;
				}
			}
		}
		/*** End Prepare data ***/

		// Get Template
		var itemHtml = boostPFSTemplate.productGridItemHtml;
		// Add a specific class for grid item
		var itemGridWidthClass = '';
		var imageSize = '600x600';

		switch (boostPFSConfig.custom.products_per_row) {
			case 2:
				itemGridWidthClass = 'medium-up--one-half';
				imageSize = '540x600';
				break;
			case 3:
				itemGridWidthClass = 'small--one-half medium-up--one-third';
				imageSize = '345x550';
				break;
			case 4:
				itemGridWidthClass = 'small--one-half medium-up--one-quarter';
				imageSize = '250x';
				break;
			case 5:
				itemGridWidthClass = 'small--one-half medium-up--one-fifth';
				imageSize = '195x';
				break;
		}
		itemHtml = itemHtml.replace(/{{itemGridWidthClass}}/g, itemGridWidthClass);

		// Add soldOut class
		var itemSoldOutClass = soldOut ? boostPFSTemplate.soldOutClass : '';
		itemHtml = itemHtml.replace(/{{itemSoldOutClass}}/g, itemSoldOutClass);

		// Add soldOut label
		var itemSoldOutLabel = soldOut ? boostPFSTemplate.soldOutLabelGridHtml : '';
		itemHtml = itemHtml.replace(/{{itemSoldOutLabel}}/g, itemSoldOutLabel);

		var imgId = 'ProductCardImage-' + data.id;
		var wrapperId = 'ProductCardImageWrapper-' + data.id;

		// Build Image style
		var imageStyle = buildImageStyle(data);
		itemHtml = itemHtml.replace(/{{imageStyle}}/g, imageStyle);

		// Add Images
		var aspect_ratio = '';
		var itemImagesHtml = '<div id="' + wrapperId + '" class="grid-view-item__image-wrapper js">';
		itemImagesHtml += '<div style="padding-top:';
		if (images.length > 0) {
			aspect_ratio = images[0]['width'] / images[0]['height'];
			itemImagesHtml += 1 / aspect_ratio * 100;
		} else {
			itemImagesHtml += 100;
		}
		itemImagesHtml += '%;">';
		itemImagesHtml += '<img id="' + imgId + '" ' +
			'class="grid-view-item__image lazyload" ' +
			'src="' + Utils.getFeaturedImage(images, '300x300') + '" ' +
			'data-src="' + Utils.getFeaturedImage(images, '{width}x') + '" ' +
			'data-widths="[180, 360, 540, 720, 900, 1080, 1296, 1512, 1728, 2048]" ' +
			'data-aspectratio="' + aspect_ratio + '" ' +
			'data-sizes="auto" ' +
			'alt="{{itemTitle}}">';
		itemImagesHtml += '</div>';
		itemImagesHtml += '</div>';

		var image_size = boostPFSConfig.custom.max_height + 'x' + boostPFSConfig.custom.max_height;
		var max_width = images.length > 0 ? boostPFSConfig.custom.max_height * aspect_ratio : 0;
		itemImagesHtml += '<noscript><img class="grid-view-item__image" src="' + Utils.getFeaturedImage(images, image_size + '@2x') + '" alt="{{itemTitle}}" style="max-width: ' + max_width + 'px;"></noscript>';
		itemHtml = itemHtml.replace(/{{itemImages}}/g, itemImagesHtml);

		// Add Vendor
		var itemVendorHtml = boostPFSConfig.custom.vendor_enable ? boostPFSTemplate.vendorGridHtml : '';
		itemHtml = itemHtml.replace(/{{itemVendor}}/g, itemVendorHtml);

		// Add Price
		var itemPriceHtml = buildPrice(data, onSale, priceVaries);
		itemHtml = itemHtml.replace(/{{itemPrice}}/g, itemPriceHtml);

		// Add Reviews
		if (typeof Integration === 'undefined' || !Integration.hascompileTemplate('reviews')) {
			itemHtml = itemHtml.replace(/{{itemReviews}}/g, '');
		}

		// Add main attribute
		itemHtml = itemHtml.replace(/{{itemId}}/g, data.id);
		itemHtml = itemHtml.replace(/{{itemTitle}}/g, data.title);
		itemHtml = itemHtml.replace(/{{itemVendorLabel}}/g, data.vendor);
		itemHtml = itemHtml.replace(/{{itemUrl}}/g, Utils.buildProductItemUrl(data));

		if(typeof Utils.compileShopifyProductVariables == 'function'){
          itemHtml = Utils.compileShopifyProductVariables(data, itemHtml);
        }

        if(typeof Utils.compileShopifyProductMetafield == 'function'){
        	itemHtml = Utils.compileShopifyProductMetafield(data, itemHtml);
        }

		return itemHtml;
	}

	ProductListItem.prototype.compileTemplate = function(data) {
		if (!data) data = this.data;
		/*** Prepare data ***/
		var images = data.images_info;
		// Displaying price base on the policy of Shopify, have to multiple by 100
		var soldOut = !data.available; // Check a product is out of stock
		var onSale = data.compare_at_price_min > data.price_min; // Check a product is on sale
		var priceVaries = data.price_min != data.price_max; // Check a product has many prices
		// Get First Variant (selected_or_first_available_variant)
		var firstVariant = data['variants'][0];
		if (Utils.getParam('variant') !== null && Utils.getParam('variant') != '') {
			var paramVariant = data.variants.filter(function(e) {
				return e.id == Utils.getParam('variant');
			});
			if (typeof paramVariant[0] !== 'undefined') firstVariant = paramVariant[0];
		} else {
			for (var i = 0; i < data['variants'].length; i++) {
				if (data['variants'][i].available) {
					firstVariant = data['variants'][i];
					break;
				}
			}
		}
		/*** End Prepare data ***/

		// Get Template
		var itemHtml = boostPFSTemplate.productListItemHtml;

		// Add onSale label
		var itemSaleLabel = onSale ? boostPFSTemplate.saleLabelListHtml : '';
		itemHtml = itemHtml.replace(/{{itemSaleLabel}}/g, itemSaleLabel);

		// Add soldOut label
		var itemSoldOutLabel = soldOut ? boostPFSTemplate.soldOutLabelListHtml : '';
		itemHtml = itemHtml.replace(/{{itemSoldOutLabel}}/g, itemSoldOutLabel);

		// Add Thumbnail
		var itemThumbUrl = images.length > 0 ? Utils.optimizeImage(images[0]['src'], '600x600') : boostPFSConfig.general.no_image_url;
		itemHtml = itemHtml.replace(/{{itemThumbUrl}}/g, itemThumbUrl);

		// Add Vendor
		var itemSmallVendorHtml = boostPFSConfig.custom.vendor_enable ? boostPFSTemplate.vendorSmallListHtml : '';
		itemHtml = itemHtml.replace(/{{itemSmallVendor}}/g, itemSmallVendorHtml);
		var itemMediumVendorHtml = boostPFSConfig.custom.vendor_enable ? boostPFSTemplate.vendorMediumListHtml : '';
		itemHtml = itemHtml.replace(/{{itemMediumVendor}}/g, itemMediumVendorHtml);

		// Add Price
		var itemPriceHtml = buildPrice(data, onSale, priceVaries);
		itemHtml = itemHtml.replace(/{{itemPrice}}/g, itemPriceHtml);

		// Add Reviews
		if (typeof Integration === 'undefined' || !Integration.hascompileTemplate('reviews')) {
			itemHtml = itemHtml.replace(/{{itemReviews}}/g, '');
		}

		// Add main attribute
		itemHtml = itemHtml.replace(/{{itemTitle}}/g, data.title);
		itemHtml = itemHtml.replace(/{{itemVendorLabel}}/g, data.vendor);
		itemHtml = itemHtml.replace(/{{itemUrl}}/g, Utils.buildProductItemUrl(data));

		if(typeof Utils.compileShopifyProductVariables == 'function'){
          itemHtml = Utils.compileShopifyProductVariables(data, itemHtml);
        }

        if(typeof Utils.compileShopifyProductMetafield == 'function'){
        	itemHtml = Utils.compileShopifyProductMetafield(data, itemHtml);
        }

		return itemHtml;
	}

	// Build Image style
	function buildImageStyle(data) {
		var images = data.images_info;
		var imgId = 'ProductCardImage-' + data.id;
		var wrapperId = 'ProductCardImageWrapper-' + data.id;
		var imageStyle = '';
		if (images.length > 0) {
			var image = images[0];
			var width = boostPFSConfig.custom.max_height;
			var height = boostPFSConfig.custom.max_height;
			var aspect_ratio = image.width / image.height;
			var small_style = true;
			var container_aspect_ratio = width * 1.0 / height;

			if (image.aspect_ratio < 1.0) {
				var maximum_width = height * aspect_ratio;
				if (image.height <= height) {
					var maximum_height = image.height;
					maximum_width = image.width;
				} else {
					var maximum_height = height;
				}
			} else if (aspect_ratio < container_aspect_ratio) {
				var maximum_height = height / aspect_ratio;
				if (image.height <= height) {
					var maximum_height = image.height;
					var maximum_width = image.width;
				} else {
					var maximum_height = height;
					var maximum_width = height * aspect_ratio;
				}
			} else {
				var maximum_height = height / aspect_ratio;
				if (image.width <= width) {
					maximum_height = image.height;
					var maximum_width = image.width
				} else {
					var maximum_width = width;
					maximum_height = maximum_width / aspect_ratio;
				}
			}

			imageStyle += '<style>';
			if (small_style) imageStyle += '@media screen and (min-width: 750px) {';
			imageStyle += '#' + imgId + ' {' +
				'max-width: ' + maximum_width + 'px;' +
				'max-height: ' + maximum_height + 'px;' +
				'}' +
				'#' + wrapperId + ' {' +
				'max-width: ' + maximum_width + 'px;' +
				'max-height: ' + maximum_height + 'px;' +
				'}';
			if (small_style) imageStyle += '}';

			if (small_style) {
				if (aspect_ratio < 1) {
					maximum_width = 750 * aspect_ratio;
				} else {
					if (image.width < 750) {
						maximum_width = image.width;
					} else {
						maximum_width = 750;
					}
				}
				imageStyle += '@media screen and (max-width: 749px) {'
				imageStyle += '#' + imgId + ' {' +
					'max-width: ' + maximum_width + 'px;' +
					'max-height: 750px;' +
					'}' +
					'#' + wrapperId + ' {' +
					'max-width: ' + maximum_width + 'px;' +
					'}';
				imageStyle += '}';
			}
			imageStyle += '</style>';
		}
		return imageStyle;
	}

	function buildPrice(data, onSale, priceVaries) {
		var priceHtml = '',
			onSaleClass = onSale ? ' price--on-sale' : '';
		var soldOutClass = data.available ? '' : ' price--sold-out';
		var comparePriceVaries = data.compare_at_price_min != data.compare_at_price_max;
		var priceVariesClass = !priceVaries && comparePriceVaries ? ' price--compare-price-hidden' : '',
			variant = data.variants[0],
			unitPriceMeasurementClass = '',
			unitPriceSeparatorHtml = '',
			unitPriceBaseUnitHtml = '';

		if (variant.hasOwnProperty('unit_price_measurement')) {
			unitPriceMeasurementClass = ' price--unit-available';
		}

		priceHtml += '<dl class="price price--listing' + onSaleClass + soldOutClass + priceVariesClass + unitPriceMeasurementClass + '" data-price>';
		if (boostPFSConfig.custom.hasOwnProperty('vendor_enable') && boostPFSConfig.custom.vendor_enable == true && boostPFSConfig.custom.layout !== 'list') {
			priceHtml += '<div class="price__vendor price__vendor--listing"><dt>';
			priceHtml += '<span class="visually-hidden">' + boostPFSConfig.label.vendor + '</span>';
			priceHtml += '</dt><dd>';
			priceHtml += data.vendor;
			priceHtml += '</dd></div>';
		}

		priceHtml += '<div class="price__regular">';
		priceHtml += '<dt><span class="visually-hidden visually-hidden--inline">' + boostPFSConfig.label.regular_price + '</span>';
		priceHtml += '</dt><dd>';
		priceHtml += '<span class="price-item price-item--regular" data-regular-price>';
		if (priceVaries) {
			priceHtml += boostPFSConfig.label.from_lowest_price_html.replace(/{{ lowest_price }}/, boostPFSConfig.custom.currency_code_enabled ? Utils.formatMoney(data.price_min, 'money_with_currency') : Utils.formatMoney(data.price_min));
		} else {
			priceHtml += boostPFSConfig.custom.currency_code_enabled ? Utils.formatMoney(data.price_min, 'money_with_currency') : Utils.formatMoney(data.price_min);
		}
		priceHtml += '</span></dd></div>';

		priceHtml += '<div class="price__sale"> <dt> <span class="visually-hidden visually-hidden--inline">';
		priceHtml += boostPFSConfig.label.sale_price +
			'</span></dt>';
		priceHtml += '<dd> <span class="price-item price-item--sale">';
		if (priceVaries) {
			priceHtml += boostPFSConfig.label.from_lowest_price_html.replace(/{{ lowest_price }}/, boostPFSConfig.custom.currency_code_enabled ? Utils.formatMoney(data.price_min, 'money_with_currency') : Utils.formatMoney(data.price_min));
		} else {
			priceHtml += boostPFSConfig.custom.currency_code_enabled ? Utils.formatMoney(data.price_min, 'money_with_currency') : Utils.formatMoney(data.price_min);
		}
		priceHtml += '</span></dd>';
		priceHtml += '<div class="price__compare"> <dt> <span class="visually-hidden visually-hidden--inline">';
		priceHtml += boostPFSConfig.label.regular_price;
		priceHtml += '</span></dt>';
		priceHtml += '<dd> <s class="price-item price-item--regular">';
		priceHtml += boostPFSConfig.custom.currency_code_enabled ? Utils.formatMoney(data.compare_at_price_min, 'money_with_currency') : Utils.formatMoney(data.compare_at_price_min);
		priceHtml += '</s></dd></div>';
		priceHtml += '</div>';

		priceHtml += '<div class="price__unit"> <dt> <span class="visually-hidden visually-hidden--inline">';
		priceHtml += boostPFSConfig.label.unit_price_label;
		priceHtml += '</span></dt>';
		priceHtml += '<dd class="price-unit-price">';

		unitPriceSeparatorHtml += '<span aria-hidden="true">/</span><span class="visually-hidden">';
		unitPriceSeparatorHtml += boostPFSConfig.label.unit_price_separator + '&nbsp;</span>';

		if (variant.hasOwnProperty('unit_price_measurement') && variant.unit_price_measurement) {
			unitPriceBaseUnitHtml += '<span>';
			if (variant.hasOwnProperty('reference_value') && variant.unit_price_measurement.reference_value != 1) {
				unitPriceBaseUnitHtml += variant.unit_price_measurement.reference_value;
			}
			if (variant.hasOwnProperty('reference_unit')) {
				unitPriceBaseUnitHtml += variant.unit_price_measurement.reference_unit;
			}
			unitPriceBaseUnitHtml += '</span>';
		}

		if (variant.hasOwnProperty('unit_price')) {
			priceHtml += '<span>' + Utils.formatMoney(variant.unit_price) + '</span>';
		}

		priceHtml += unitPriceSeparatorHtml + unitPriceBaseUnitHtml;
		priceHtml += '</dd></div>';

		priceHtml += '<div class="price__badges price__badges--listing">' +
			'<span class="price__badge price__badge--sale" aria-hidden="true"> <span>';
		priceHtml += boostPFSConfig.label.sale + '</span></span>';
		priceHtml += '<span class="price__badge price__badge--sold-out">' +
			boostPFSConfig.label.sold_out +
			'</span></span></div>';

		priceHtml += '</dl>';

		return priceHtml;
	}

	/// Build Pagination
	ProductPaginationDefault.prototype.compileTemplate = function(totalProduct) {
		if (!totalProduct) totalProduct = this.totalProduct;
		// Get page info
		var currentPage = parseInt(Globals.queryParams.page);
		var totalPage = Math.ceil(totalProduct / Globals.queryParams.limit);

		// If it has only one page, clear Pagination
		if (totalPage <= 1) {
			return '';
		}

		var paginationHtml = boostPFSTemplate.paginateHtml;

		// Build Previous
		var previousHtml = (currentPage > 1) ? boostPFSTemplate.previousActiveHtml : boostPFSTemplate.previousDisabledHtml;
		previousHtml = previousHtml.replace(/{{itemUrl}}/g, Utils.buildToolbarLink('page', currentPage, currentPage - 1));
		paginationHtml = paginationHtml.replace(/{{previous}}/g, previousHtml);

		// Build Next
		var nextHtml = (currentPage < totalPage) ? boostPFSTemplate.nextActiveHtml : boostPFSTemplate.nextDisabledHtml;
		nextHtml = nextHtml.replace(/{{itemUrl}}/g, Utils.buildToolbarLink('page', currentPage, currentPage + 1));
		paginationHtml = paginationHtml.replace(/{{next}}/g, nextHtml);

		// Build page items
		var currentPage = boostPFSConfig.label.current_page.replace(/{{ current }}/g, currentPage).replace(/{{ total }}/g, totalPage);
		paginationHtml = paginationHtml.replace(/{{pageItems}}/g, currentPage);

		return paginationHtml;
	};

	// Build Sorting
	ProductSorting.prototype.compileTemplate = function() {
		var html = '';
		if (boostPFSTemplate.hasOwnProperty('sortingHtml')) {
			var sortingArr = Utils.getSortingList();
			if (sortingArr) {
				// Build content
				var sortingItemsHtml = '';
				for (var k in sortingArr) {
					sortingItemsHtml += '<option value="' + k + '">' + sortingArr[k] + '</option>';
				}
				html = boostPFSTemplate.sortingHtml.replace(/{{sortingItems}}/g, sortingItemsHtml);
			}
		}
		return html;
	};

	// Build Display type
	ProductDisplayType.prototype.compileTemplate = function() {
		var itemHtml = '<span>View As </span>';
		itemHtml += '<a href="' + Utils.buildToolbarLink('display', 'list', 'grid') + '" title="Grid view" class="{{class.productDisplayType}}-item {{class.productDisplayType}}-grid" data-view="grid"><span class="icon-fallback-text"><span class="fallback-text">Grid view</span></span></a>';
		itemHtml += '<a href="' + Utils.buildToolbarLink('display', 'grid', 'list') + '" title="List view" class="{{class.productDisplayType}}-item {{class.productDisplayType}}-list" data-view="list"><span class="icon-fallback-text"><span class="fallback-text">List view</span></span></a>';
		itemHtml = itemHtml.replace(/{{class.productDisplayType}}/g, Class.productDisplayType);

		return itemHtml;
	};

	// Add additional feature for product list, used commonly in customizing product list
	ProductList.prototype.afterRender = function(data) {
		if (!data) data = this.data;
		var productSelector = jQ(Selector.products);
		if (Globals.queryParams.display == 'list') {
			if (productSelector.children('.list-view-items').length == 0) {
				productSelector.children().wrapAll('<ul class="list-view-items"></ul>');
			}
			productSelector.removeClass('grid grid--uniform grid--view-items');
		} else {
			if (productSelector.children('.list-view-items').length > 0) {
				productSelector.children('.list-view-items').children().unwrap();
			}
			productSelector.addClass('grid grid--uniform grid--view-items');
		}
	}

	// Build Additional Elements
	FilterResult.prototype.afterRender = function(data, eventType) {
		if (!data) data = this.data;
		var totalProduct = '';
		if (data.total_product == 1) {
			totalProduct = boostPFSConfig.label.items_with_count_one.replace(/{{ count }}/g, data.total_product);
		} else {
			totalProduct = boostPFSConfig.label.items_with_count_other.replace(/{{ count }}/g, data.total_product);
		}
		jQ('.boost-pfs-filter-total-product').html(totalProduct);
	};
})();