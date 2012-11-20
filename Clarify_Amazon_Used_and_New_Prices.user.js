// ==UserScript==
// @name        Clarify Amazon Used and New Prices
// @require     http://ajax.googleapis.com/ajax/libs/jquery/1.3.2/jquery.min.js
// @namespace   471461
// @description Update the price for 'used and new' items on the product page to include delivery/p&p. Shows each seller's full price (including delivery/p&p) on the Amazon 'used and new' tab. Shows prices inc delivery in search results too.
// @include     /^https?://www\.amazon\.((com|ca|co\.uk)|(fr|de|it|es))/((gp/(offer-listing|product)/)|(.+?/dp/.+?/|dp)|s/).*$/
// @version     2.02
// @grant none
// ==/UserScript==

// Disclaimer: Neither the author or script are in any way affiliated with Amazon.com, Inc.

jQuery(document).ready(function($) {
	// Match the tld of current amazon sites, does not currently function for jp and cn
	var tldRegex = /www\.amazon\.((com|ca|co\.uk)|(fr|de|it|es))/;
	// Check whether to use dot separated decimal float values or the european comma separated style
	var isDotFloats = typeof tldRegex.exec(window.location.host)[3] === "undefined";
	// Identifier stem for certain page elements added by this script
	var clarifyStem = 'clarify_grease_';
	// Regex to match the used and new page containing prices for a specific condition
	var usedNewUrlRegex = /^.*?\/gp\/offer-listing\/(.+?)\/.+condition=([^&]+)/;
	
	// Check page type to perform appropriate action
	if( window.location.pathname.indexOf('/gp/offer-listing') === 0 ) {
		usedNewPage();
	} else if( window.location.pathname.indexOf('/s/') === 0 ) {	
		searchPage();
	} else {
		productPage();
	}
	
	function searchPage() {
		var i = 0;
		$('ul.rsltL').each(function() {
			var listItems = $('li.mkp2', this);
			if( listItems.length < 1 ) {
				return;
			}
			var firstLi = $(listItems[0]);
			var id = clarifyStem + i;
			
			// Add the button for getting the full price
			firstLi.html( firstLi.html() + '<button id="' + id + '" style="font-style: italic; border: none; background: none; color: #888888; text-decoration: underline; font-size: 90%;">Get price inc. P&P</button>' );
			
			// Set up event listener for clicking the button
			$('#' + id).click(function() { fetchSearchResultPrice($('#' + id)); });
			
			i++;
		});
	}
	
	function fetchSearchResultPrice(btnElem) {
		function removeLoadingText() {
			// Remove loading text if it's still there (will get removed by first successful AJAX call)
			if( $('#' + btnId).length ) { 
				$('#' + btnId).remove(); 
			}
		}
	
		var btnId = btnElem.attr('id');
	
		// Get all list items containing used and new prices
		var listItems = $.merge([btnElem.parent()], btnElem.parent().siblings('li.mkp2'));
		
		// Set the button/link to loading text
		btnElem.unbind('click');
		btnElem.replaceWith( '<span id="' + btnId + '" style="font-style: italic; font-size: 90%; color: #888888;">Loading...</span>' );
		
		// Get the full price for each list item
		$.each(listItems, function(index, elem) {
			// If there's no link to a used and new page, remove the loading text and exit
			if( $('a', elem).length !== 1 || usedNewUrlRegex.exec($('a', elem).attr('href')) === null ) {
				removeLoadingText();
				return;
			}
			
			$.ajax({
				url: $('a', elem).attr('href'),
				dataType: 'html',
				success: function(data) {
					var parseResult = parseFirstRow(data);
					if( parseResult !== null ) {
						$('span.price', elem).html($('span.price', elem).html() + ' <i>(' + parseResult.currencySym + parseResult.totalPrice + ' inc. P&P)</i>');
					}
				},
				complete: function() {
					removeLoadingText();
				}
			});
		});
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
					var parseResult = parseFirstRow(data);
					
					if( parseResult !== null ) {						
						// Create the HTML to append to bare prices
						var incHtml = ' <i>(' + parseResult.currencySym + parseResult.totalPrice + ' inc. P&P)</i>';
						
						// Update the price on the product page to be the total price
						$('span.price', olpCondLink).html($('span.price', olpCondLink).html() + incHtml);
							
						// Match the product code and condition
						var urlMatchFetched = usedNewUrlRegex.exec(fetchedUrl);
											
						// Update the appropriate price in the central table, checking the product code and condition to determine the correct cell
						$('div.cBoxInner td.tmm_olpLinks a').each(function() {
							var urlMatchCell = usedNewUrlRegex.exec($(this).attr('href'));
							if( urlMatchFetched[1] === urlMatchCell[1] && urlMatchFetched[2] === urlMatchCell[2] ) {
								$(this).html($(this).html() + incHtml);
							}
						});
						
						// Update any prices in the secondary used and new table (right hand side of page)
						$('div#secondaryUsedAndNew div.mbcOlpLink').each(function() {
							var olpLinkDiv = $(this);
							$('a', olpLinkDiv).each(function() {
								var urlMatchCell = usedNewUrlRegex.exec($(this).attr('href'));
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
	
	// Convenience method to parse the first price row of the used and new page
	function parseFirstRow(pageHtml) {
		var page = $(pageHtml);
		if( $('tbody.result', page).length < 1 ) {
			return null;
		}
		var row = $('tbody.result', page)[0];
		return parsePriceRow(row);
	}
	
	// Parse the price and currency symbol from a row in the used and new page table
	function parsePriceRow(row) {
		// Skip rows without a price specified
		if( $('span.price', row).html() === null ) {
			return null;
		}
		
		// In the case of items with no delivery price specified (eg. Amazon fulfilled) assume free delivery
		if( $('span.price_shipping', row).html() === null ) {
			var priceDelivery = 0;
		}
	
		// Determine the currency symbol from the start of the price string
		var currencySym = /(^\D+)/.exec($('span.price', row).html())[1];
	
		if( isDotFloats ) {
			var stripRe = /[^\.\d]*/g;
			var price = parseFloat($('span.price', row).html().replace(stripRe, ''));
			if( typeof priceDelivery === 'undefined' ) {
				var priceDelivery = parseFloat($('span.price_shipping', row).html().replace(stripRe, ''));
			}
		} else {
			var stripRe = /[^,\d]*/g;
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