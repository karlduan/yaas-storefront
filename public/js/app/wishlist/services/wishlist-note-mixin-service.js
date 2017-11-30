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
.factory('WishlistNoteMixinSvc', ['WishlistSvc', 'WishlistREST', '$q', 'SiteConfigSvc',
    function (WishlistSvc, WishlistREST, $q, siteConfigSvc) {

        return {
            updateNote: function(wishlistItem, noteContent) {
                var updatePromise = $q.defer();
                var noteMixin = {
                    metadata: {
                        mixins: {
                            note: siteConfigSvc.schemas.noteMixinMetadata
                        }
                    },
                    mixins: {
                        note: {
                            comment: noteContent
                        }
                    }
                };

                // Get wishlist info from WishlistSvc
                var wishlist = WishlistSvc.getLocalWishlist();

                WishlistREST.Wishlist.one('wishlists', wishlist.id).all('items').customPUT(noteMixin, wishlistItem.id + '?partial=true').then(function () {
                    WishlistSvc.refreshWishlist(wishlist.id, 'auto');
                    updatePromise.resolve();
                }, function () {
                    updatePromise.reject();
                });

                return updatePromise.promise;
            },

            removeNote: function(wishlistItem) {
                var removeNotePromise = $q.defer();
                var nulledNoteMixin = {
                    metadata: {
                        mixins: null
                    },
                    mixins: {
                        note: null
                    }
                };
                // Get wishlist info from WishlistSvc
                var wishlist = WishlistSvc.getLocalWishlist();

                WishlistREST.Wishlist.one('wishlists', wishlist.id).all('items').customPUT(nulledNoteMixin, wishlistItem.id + '?partial=true').then(function () {
                    WishlistSvc.refreshWishlist(wishlist.id, 'auto');
                    removeNotePromise.resolve();
                }, function () {
                    removeNotePromise.reject();
                });

                return removeNotePromise.promise;
            }
        };
}]);
