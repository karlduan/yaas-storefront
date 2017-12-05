/**
 * [y] hybris Platform
 *
 * Copyright (c) 2000-2016 hybris AG
 * All rights reserved.
 *
 * This software is the confidential and proprietary information of hybris
 * ("Confidential Information"). You shall not disclose such Confidential
 * Information and shall use it only in accordance with the terms of the
 * license agreement you entered into with hybris.
 */

'use strict';

angular.module('ds.wishlist')

    .factory('WishlistSvc', ['$rootScope', 'WishlistREST','ProductSvc', 'AccountSvc', '$q', 'GlobalData', '$location',
        function ($rootScope, WishlistREST, ProductSvc, AccountSvc, $q, GlobalData) {

            // Prototype for outbound "update wishlist item" call
            var Item = function (product, price, qty) {

                this.itemYrn = product.itemYrn;

                var currentSiteCode = GlobalData.getSiteCode();

                if (product.mixins && product.mixins.taxCodes && product.mixins.taxCodes[currentSiteCode]) {
                    this.taxCode = product.mixins.taxCodes[currentSiteCode];
                }
                this.price = price;
                this.quantity = qty;
            };

            // Prototype for wishlist as used in UI
            var Wishlist = function () {
            	this.id = null;
                this.owner = '';
                this.title = '';
                this.description = '';
                this.createdAt = '';
                this.items = [];
            };

            var Item = function () {
            this.product = '';
		    this.amount = '';
		    this.note = '';
		    this.createdAt = '';
	        }

            // application scope wishlist instance
            var wishlist = {};
            var items = [];

            /**  Ensure there is a wishlist associated with the current session.
             * Returns a promise for the existing or newly created wishlist.  Wishlist will only contain the id.
             * (Will create a new wishlist if the current wishlist hasn't been persisted yet).
             */
            function getOrCreateWishlist() {
                var deferredWishlist = $q.defer();
                // Use copy of wishlist from local scope if it exists - don't want to use same instance because we don't want
                //   data binding
                if (wishlist.id) {
                    deferredWishlist.resolve({ wishlistId: wishlist.id });
                } else {

                    var newWishlist = {};
                    var accPromise = AccountSvc.getCurrentAccount();
                    accPromise.then(function (successAccount) {
                        newWishlist.owner = successAccount.id;
                    });
                    accPromise.finally(function () {
                        newWishlist.id=new Date().getTime();                      
                        newWishlist.title = 'test';
			newWishlist.description = 'test';
                        newWishlist.createdAt = new Date();
                        WishlistREST.Wishlist.all('wishlists').post(newWishlist).then(function (response) {
                            deferredWishlist.resolve({ wishlistId: response.id });
                            wishlist.id=response.id

                        }, function () {
                            deferredWishlist.reject();
                        });
                    });
                }
                return deferredWishlist.promise;
            }


            /** Retrieves the current wishlist state from the service, updates the local instance
             * and fires the 'wishlist:updated' event.*/
            function refreshWishlist(wishlistId, updateSource, closeWishlistAfterTimeout) {
                var defWishlist = $q.defer();
                var defWishlistTemp = $q.defer();

                var params = { siteCode: GlobalData.getSiteCode() };

                WishlistREST.Wishlist.one('wishlists', wishlistId).get(params).then(function (response) {
                    wishlist = response.plain();
                    if (wishlist.siteCode !== GlobalData.getSiteCode()) {
                        WishlistREST.Wishlist.one('wishlists', wishlist.id).one('changeSite').customPOST({ siteCode: GlobalData.getSiteCode() }).finally(function () {
                            if (!!GlobalData.customerAccount) {

                                params = angular.extend(params, { customerId: GlobalData.customerAccount.customerNumber });

                                WishlistREST.Wishlist.one('wishlists', wishlistId).get(params).then(function (response) {
                                    wishlist = response.plain();
                                    defWishlistTemp.resolve(wishlist);
                                }, function () {
                                    defWishlistTemp.reject();
                                });
                            }
                            else {
                                WishlistREST.Wishlist.one('wishlists', wishlistId).get(params).then(function (response) {
                                    wishlist = response.plain();
                                    defWishlistTemp.resolve(wishlist);
                                }, function () {
                                    defWishlistTemp.reject();
                                });
                            }
                        });

                    } else {
                        defWishlistTemp.resolve(wishlist);
                    }
                    defWishlistTemp.promise.then(function (curWishlist) {
                        defWishlist.resolve(curWishlist);

                    }, function () {
                        wishlist.error = true;
                    });

                }, function (response) {
                    wishlist = {};
                    if (!response || response.status !== 404) {
                        wishlist.error = true;
                    }
                    else {
                        console.warn('Could not find wishlist. A new wishlist will be created when the user adds an item.');
                    }
                    defWishlist.resolve(wishlist);
                });
                defWishlist.promise.then(function () {

                    var items =  (wishlist.items ? wishlist.items : []);

                    if(!_.isEmpty(items)){
                      var productList = getProductIdsFromWishlist(items);

                      ProductSvc.queryProductList({q:'id:('+productList+')'}).then(function(res){
                        var products = res.plain();
                        _.forEach(items, function(item){
                          if(item.itemYrn){

                            var split = item.itemYrn.split(';');

                            var prod = _.find(products, {id:split[1]});

                            item.product = {
                              id:prod.id,
                              name:prod.name,
                              images:prod.media,
                              sku:prod.code
                            };

                            if(_.contains(item.itemYrn, 'product-variant')){
                              ProductSvc.getProductVariant({productId:split[1],variantId:split[2]}).then(function(variant){

                                item.variants=[];
                                _.forEach(variant.options, function(ele){
                                  for (var key in ele) {
                                    item.variants.push(key+': '+ ele[key] );
                                  }
                                });

                                if(_.isArray(variant.media) && _.size(variant.media) > 0){
                                    item.product.images = variant.media;
                                    item.product.code = variant.code;
                                }
                                if(variant.name) {
                                  item.product.name = variant.name;
                                }
                              });
                            }
                          }
                        });
                      });
                    }

                    $rootScope.$emit('wishlist:updated', { wishlist: wishlist, source: updateSource, closeAfterTimeout: closeWishlistAfterTimeout });
                });
                return defWishlist.promise;
            }

            function mergeAnonymousWishlistIntoCurrent(anonWishlist) {
                var deferred = $q.defer();
                if (anonWishlist && anonWishlist.id) {
                    // merge anon wishlist into user wishlist
                    WishlistREST.Wishlist.one('wishlists', wishlist.id).one('merge').customPOST({ wishlists: [anonWishlist.id] }).then(function () {
                        // merge anonymous wishlist - will change currency if needed
                        refreshWishlist(wishlist.id, 'merge').then(
                            function () {
                                deferred.resolve();
                            },
                            function () {
                                deferred.reject();
                            }
                        );
                    }, function () {
                        wishlist.error = true;
                        deferred.reject();
                    });
                } else {
                    // scope is already equivalent to latest user wishlist
                    if (wishlist.siteCode !== GlobalData.getSiteCode()) {
                        if (wishlist.id) {
                            refreshWishlist(wishlist.id, 'site').then(
                                function () {
                                    deferred.resolve();
                                },
                                function () {
                                    deferred.reject();
                                }
                            );
                        }
                    } else {
                        $rootScope.$emit('wishlist:updated', { wishlist: wishlist });
                        deferred.resolve();
                    }
                }
                return deferred.promise;
            }

            /** Creates a new Wishlist Item.  If the wishlist hasn't been persisted yet, the
             * wishlist is created first.
             */
            function createWishlistItem(product, prices, qty, config) {
                //product.yrn
                var closeWishlistAfterTimeout = (!_.isUndefined(config.closeWishlistAfterTimeout)) ? config.closeWishlistAfterTimeout : undefined;
                var wishlistUpdateMode = (!config.openwishlistAfterEdit) ? 'auto' : 'manual';

                var createItemDef = $q.defer();
                getOrCreateWishlist().then(function (wishlistResult) {

                    var price = {'priceId': prices[0].priceId, 'effectiveAmount': prices[0].effectiveAmount, 'originalAmount': prices[0].originalAmount, 'currency': prices[0].currency};

                    if(prices[0].measurementUnit) {
                        price.measurementUnit =  {'unit' : prices[0].measurementUnit.unitCode, 'quantity' : prices[0].measurementUnit.quantity};
                    }
			var Item = function () {
					this.product = '';
					this.amount = '';
					this.note = 'test';
					this.createdAt = new Date();
				    }
                    var item = new Item();
                    item.product=product.id
                    item.amount=qty                                        
                    WishlistREST.Wishlist.one('wishlists', wishlistResult.wishlistId).all('wishlistItems').post(item).then(function () {
//                        refreshWishlist(wishlistResult.wishlistId, wishlistUpdateMode, closeWishlistAfterTimeout);
                        createItemDef.resolve();
                    }, function () {
                       // refreshWishlist(wishlist.id, wishlistUpdateMode, closeWishlistAfterTimeout);
                        createItemDef.reject();
                    });

                }, function () {
                    createItemDef.reject();
                });
                return createItemDef.promise;
            }


            function getProductInWishlist(wishlist, product){
                return _.find((wishlist.items ? wishlist.items : []),function(item){
                  if(item.itemYrn === product.itemYrn){
                    return item;
                  }
                });
            }

            function getIdFromItemYrn(itemYrn){
              if(_.contains(itemYrn, 'product:product')){
                return itemYrn.split(';')[1];
              } else if(_.contains(itemYrn, 'product:product-variant')){
                return itemYrn.split(';')[2];
              }
            }

            function getProductIdsFromWishlist(items){
              return _.map(items, function(item){
                return item.itemYrn ? getIdFromItemYrn(item.itemYrn) : '';
              }).join(',');
            }

            function reformatWishlistItems(wishlist) {
                var items = [];
                for (var i = 0; i < wishlist.items.length; i++) {
                    var item = {
                        itemId: wishlist.items[i].id,
                        itemYrn: wishlist.items[i].itemYrn,
                        productId: wishlist.items[i].product ? wishlist.items[i].product.id : '',
                        quantity: wishlist.items[i].quantity,
                        unitPrice:{
                            amount: wishlist.items[i].price.effectiveAmount,
                            currency: wishlist.items[i].price.currency
                        },
                        taxCode:wishlist.items[i].taxCode
                    };
                    items.push(item);
                }
                return items;
            }

            /*
             TODO:
             this function is only necessary because the wishlist mashup does not directly consume the coupon as
             it is returned from the coupon service.  That may change in the future
             */
            function parseCoupon(coupon) {
                if (coupon.discountType === 'ABSOLUTE') {
                    coupon.amount = coupon.discountAbsolute.amount;
                    coupon.currency = coupon.discountAbsolute.currency;
                }
                else if (coupon.discountType === 'PERCENT') {
                    coupon.discountRate = coupon.discountPercentage;
                    coupon.currency = GlobalData.getCurrencyId();
                }

                return coupon;
            }

            return {

                /**
                 * Creates a new Wishlist instance that does not have an ID.
                 * This will prompt the creation of a new wishlist once items are added to the wishlist.
                 * Should be invoked once an existing wishlist has been successfully submitted to checkout.
                 */
                resetWishlist: function () {
                    wishlist = new Wishlist();
                    $rootScope.$emit('wishlist:updated', { wishlist: wishlist, source: 'reset' });
                },

                /** Returns the wishlist as stored in the local scope - no GET is issued.*/
                getLocalWishlist: function () {
                    return wishlist;
                },

                /**
                 * Retrieves the current wishlist's state from service and returns a promise over that wishlist.
                 */
                getWishlist: function () {
                    return refreshWishlist(wishlist.id ? wishlist.id : null);
                },

                /**
                 * Retrieve any existing wishlist that there might be for an authenticated user, and merges it with
                 * any content in the current wishlist.
                 */
                refreshWishlistAfterLogin: function (customerId) {
                    var deferred = $q.defer();
                    // store existing anonymous wishlist
                    var anonWishlist = wishlist;

                    // retrieve any wishlist associated with the authenticated user
                    WishlistREST.Wishlist.one('wishlists', null).get({ customerId: customerId, siteCode: GlobalData.getSiteCode() }).then(function (authUserWishlist) {
                        // there is an existing wishlist - update scope instance
                        wishlist = authUserWishlist.plain();
                        mergeAnonymousWishlistIntoCurrent(anonWishlist).then(
                            function () {
                                deferred.resolve();
                            },
                            function () {
                                deferred.reject();
                            }
                        );
                    }, function () {
                        // no existing user wishlist
                        if (anonWishlist && anonWishlist.id) {
                            // create new wishlist for customer so anon wishlist can be merged into it
                            wishlist = {
                                customerId: customerId,
                                currency: GlobalData.getCurrencyId(),
                                siteCode: GlobalData.getSiteCode(),
                                channel: GlobalData.getChannel()
                            };

                            WishlistREST.Wishlist.all('wishlists').post(wishlist).then(function (newWishlistResponse) {
                                wishlist.id = newWishlistResponse.wishlistId;
                                mergeAnonymousWishlistIntoCurrent(anonWishlist).then(
                                    function () {
                                        deferred.resolve();
                                    },
                                    function () {
                                        deferred.reject();
                                    }
                                );
                            }, function () {
                                wishlist.error = true;
                                console.error('new wishlist creation failed');
                                deferred.reject();
                            });
                        } else { // anonymous wishlist was never created
                            // just use empty wishlist - customer-specific wishlist will be created once first item is added
                            wishlist = {};
                            wishlist.currency = GlobalData.getCurrencyId();
                            wishlist.siteCode = GlobalData.getSiteCode();
                            deferred.resolve();
                        }
                    });
                    return deferred.promise;
                },

                // Exposed for use in mixin services, like wishlist-note-mixin-service.js
                refreshWishlist: refreshWishlist,

                /** Persists the wishlist instance via PUT request (if qty > 0). Then, reloads that wishlist
                 * from the API for consistency and in order to display the updated calculations (line item totals, etc).
                 * @return promise to signal success/failure*/
                updateWishlistItemQty: function (item, qty, config) {
                    var closeWishlistAfterTimeout = (!_.isUndefined(config.closeWishlistAfterTimeout)) ? config.closeWishlistAfterTimeout : undefined;
                    var wishlistUpdateMode = (!config.openwishlistAfterEdit) ? 'auto' : 'manual';
                    var updateDef = $q.defer();
                    if (qty > 0) {
                        //this is a partial update, so only quantity data is needed
                        var wishlistItem = {
                            quantity: qty
                        };
                        WishlistREST.Wishlist.one('wishlists', wishlist.id).all('items').customPUT(wishlistItem, item.id + '?partial=true').then(function () {
                            refreshWishlist(wishlist.id, wishlistUpdateMode, closeWishlistAfterTimeout);
                            updateDef.resolve();
                        }, function () {
                            angular.forEach(wishlist.items, function (it) {
                                if (item.id === it.id) {
                                    item.error = true;
                                }
                            });
                            updateDef.reject();
                        });
                    }
                    return updateDef.promise;
                },

                /**
                 * Removes a product from the wishlist, issues a PUT, and then a GET for the updated information.
                 * @param productId
                 */
                removeProductFromWishlist: function (itemId) {
                    WishlistREST.Wishlist.one('wishlists', wishlist.id).one('items', itemId).customDELETE().then(function () {
                        refreshWishlist(wishlist.id, 'manual');
                    }, function () {
                        angular.forEach(wishlist.items, function (item) {
                            if (item.id === itemId) {
                                item.error = true;
                            }
                        });
                    });
                },

                /*
                 *   Adds a product to the wishlist, updates the wishlist (PUT) and then retrieves the updated
                 *   wishlist information (GET).
                 *   @param product to add
                 *   @param productDetailQty quantity to add
                 *   @param closeWishlistAfterTimeout if the
                 *   @return promise over success/failure
                 */
                addProductToWishlist: function (product, prices, productDetailQty, config) {
		    var account = AccountSvc.getCurrentAccount();
                    if(account){
                        if (productDetailQty > 0) {

                         var self = this;
                         var productId = _.has(product, 'itemYrn') ? product.itemYrn.split(';')[1] : product.id;

                         return ProductSvc.getProduct({productId:productId}).then(function(response) {
                             if(!_.has(product, 'itemYrn')){
                               product.itemYrn = response.yrn;
                             }

                             product.mixins = response.mixins;
                             var item = getProductInWishlist(wishlist, product);
                             if(item){
                               return self.updateWishlistItemQty(item, item.quantity + productDetailQty, config);
                             }
                             return createWishlistItem(product, prices, productDetailQty, config);
                         });

                        } else {
                            return $q.when({});
                        }

                    } else {
                        return $q.when({});
                    }
                    
                },


                calculateWishlist: function (wishlistId) {
                    return WishlistREST.CalculateWishlist.one('wishlists', wishlistId).one('wishlistcalculation');
                }

            };

        }]);
