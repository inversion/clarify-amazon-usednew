// ==UserScript==
// @name        Clarify Amazon Used and New Prices
// @require     http://ajax.googleapis.com/ajax/libs/jquery/1.3.2/jquery.min.js
// @namespace   471461
// @description Update the price for 'used and new' items on the product page to include delivery/p&p. Also shows each seller's full price (including delivery/p&p) on the Amazon 'used and new' tab when opened.
// @include     /^https?://www\.amazon\.((com|ca|co\.uk)|(fr|de|it|es))/((gp/(offer-listing|product)/)|(.+?/dp/.+?/)).*$/
// @version     1
// @grant none
// ==/UserScript==

// Disclaimer: Neither the author or script are in any way affiliated with Amazon.com, Inc.

jQuery(document).ready(function($) {
	// Match the tld of current amazon sites, does not currently function for jp and cn
	var tldRegex = /www\.amazon\.((com|ca|co\.uk)|(fr|de|it|es))/;
	// Check whether to use dot separated decimal float values or the european comma separated style
	var isDotFloats = typeof tldRegex.exec(window.location.host)[3] === "undefined"; 
	
	// On a product page or the 'used and new' tabs page?
	if( window.location.pathname.indexOf('/gp/offer-listing') === 0 ) {
		usedNewPage();
	} else {
		productPage();
	}
	
	function usedNewPage() {
		$('tbody.result').each(function() {
			var parseResult = parsePriceRow(this);
			if( parseResult !== null ) {
				$('span.price', this).html($('span.price', this).html() + ' <i>(' + parseResult.currencySym + parseResult.totalPrice + ' inc. P&P)</i>');
			}
		});
	}
	
	function productPage() {
		var lowestPrice = null;
		$('#olpDivId span.olpCondLink').each(function() {
			var olpCondLink = this;
			$.ajax({
				url: $('a.buyAction', this).attr('href'),
				dataType: 'html',
				success: function(data) {
					// Get the total price from the first row of the used/new page
					var fetchedUrl = this.url;
					var page = $(data);
					var row = $('tbody.result', page)[0];
					var parseResult = parsePriceRow(row);
					
					if( parseResult !== null ) {						
						// Create the HTML to be appending to bare prices
						var incHtml = ' <i>(' + parseResult.currencySym + parseResult.totalPrice + ' inc. P&P)</i>';
						
						// Update the price on the product page to be the total price
						$('span.price', olpCondLink).html($('span.price', olpCondLink).html() + incHtml);
							
						// Match the product code and condition
						var urlMatchRegex = /^\/gp\/offer-listing\/(.+?)\/.+condition=([^&]+)$/;
						var urlMatchFetched = urlMatchRegex.exec(fetchedUrl);
											
						// Update the appropriate price in the central table, checking the product code and condition to determine the correct cell
						$('div.cBoxInner td.tmm_olpLinks a').each(function() {
							var urlMatchCell = urlMatchRegex.exec($(this).attr('href'));
							if( urlMatchFetched[1] === urlMatchCell[1] && urlMatchFetched[2] === urlMatchCell[2] ) {
								$(this).html($(this).html() + incHtml);
							}
						});
						
						// Update any prices in the secondary used and new table (right hand side of page)
						$('div#secondaryUsedAndNew div.mbcOlpLink').each(function() {
							var olpLinkDiv = $(this);
							$('a', olpLinkDiv).each(function() {
								var urlMatchCell = urlMatchRegex.exec($(this).attr('href'));
								if( urlMatchFetched[1] === urlMatchCell[1] && urlMatchFetched[2] === urlMatchCell[2] ) {
									$('span.price', olpLinkDiv).html($('span.price', olpLinkDiv).html() + incHtml);
								} else if( urlMatchCell[2] === 'all' ) {
									// Sometimes there is a 'used & new' link, so in this case update it with the lowest of the used/new prices
									// Keep track of the lowest price of used or new, and update the 'used and new' price if there is a new lower one
									if( lowestPrice === null || parseResult.totalPrice < lowestPrice ) {
										lowestPrice = parseResult.totalPrice;
										$('span.price', olpLinkDiv).html(parseResult.currencySym + parseResult.price + incHtml);
									}
								}
							});
						});
					}
				}
			});
		});
	}
	
		// Parse the price and currency symbol from a row in the used and new page table
	function parsePriceRow(row) {
		// Skip rows without a delivery price (eg. Amazon fulfilled free delivery items)
		if( $('span.price', row).html() === null ) {
			return null;
		}
		
		if( $('span.price_shipping', row).html() === null ) {
			var priceDelivery = 0;
		}
	
		// Determine the currency symbol from the start of the price string
		var currencySym = /(^\D+)/.exec($('span.price', row).html())[1];
	
		if( isDotFloats ) {
			var stripRe = /[^\.\d]*/;			
			var price = parseFloat($('span.price', row).html().replace(stripRe, ''));
			if( typeof priceDelivery === 'undefined' ) {
				var priceDelivery = parseFloat($('span.price_shipping', row).html().replace(stripRe, ''));
			}
		} else {
			var stripRe = /[^,\d]*/;
			var price = parseFloat($('span.price', row).html().replace(stripRe, '').replace(',', '.'));
			if( typeof priceDelivery === 'undefined' ) {
				var priceDelivery = parseFloat($('span.price_shipping', row).html().replace(stripRe, '').replace(',', '.'));
			}
		}
		
		return {
			'price': price.toFixed(2),
			'totalPrice': (price + priceDelivery).toFixed(2),
			'currencySym': currencySym
		};
	}
});