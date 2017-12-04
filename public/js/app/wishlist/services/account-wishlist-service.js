/**
 * [y] hybris Platform
 *
 * Copyright (c) 2000-2015 hybris AG
 * All rights reserved.
 *
 * This software is the confidential and proprietary information of hybris
 * ("Confidential Information"). You shall not disclose such Confidential
 * Information and shall use it only in accordance with the terms of the
 * license agreement you entered into with hybris.
 */

'use strict';

angular.module('ds.wishlist')
    .factory('WishListSvc', ['settings', 'GlobalData', 'WishlistREST','PriceSvc', function(settings, GlobalData, WishlistREST,PriceSvc){

        var getWishlist = function (parms) {
            var wishlistPromise = WishlistREST.Wishlist.one('wishlists').get();
            wishlistPromise.then(function(response) {
                if (response.headers) {
                    GlobalData.wishlist.meta.total = parseInt(response.headers[settings.headers.paging.total], 10) || 0;
                }
            });
            return wishlistPromise;
        }; 

        return {
            /**
             * Issues a query request on the order resource.
             * @param {parms} query parameters - optional
             * @return The result array as returned by Angular $resource.query().
             */
            query: function(parms) {
                return getWishlist(parms);
            }

        };

    }]);
