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
/**
 * wishlist-auto-toggle
 * This directive manages the wishlist's display
 * @return {Object}
 */
    .directive('wishlistAutoToggle',['$rootScope', function($rootScope){
        return {
            restrict: 'A',
            link: function(scope) {
                scope.wishlistAutoTimeoutLength = 3000;
                scope.wishlistShouldCloseAfterTimeout = false;
                scope.wishlistTimeOut = void 0;

                var closeWishlist = function(fromTimeout)
                {
                    //update angulars data binding to showWishlist
                    $rootScope.showWishlist = false;
                    scope.wishlistShouldCloseAfterTimeout = false;
                    if (fromTimeout) {
                        scope.$apply();
                    }

                };

                scope.createWishlistTimeout = function()
                {
                    //create a timeout object in order to close the wishlist if it's not hovered
                    scope.wishlistTimeOut = _.delay(
                        function()
                        {
                            //close the wishlist
                            closeWishlist(true);
                        },
                        scope.wishlistAutoTimeoutLength);
                };

                var unbind2 = $rootScope.$on('wishlist:closeAfterTimeout', function(){
                    scope.wishlistShouldCloseAfterTimeout = true;
                    //create a timeout object in order to close the wishlist if it's not hovered
                    scope.createWishlistTimeout();
                });

                var unbind3 = $rootScope.$on('wishlist:closeNow', function(){
                    scope.wishlistShouldCloseAfterTimeout = true;
                    $rootScope.showWishlist = false;
                });

                scope.$on('$destroy', unbind2, unbind3);

                scope.wishlistHover = function()
                {
                    clearTimeout(scope.wishlistTimeOut);
                };

                scope.keepWishlistOpen = function(){
                    scope.wishlistShouldCloseAfterTimeout = false;
                };

                scope.wishlistUnHover = function()
                {
                    //if none of the inputs are focused then create the 3 second timer after mouseout
                    if( !$('#wishlist input').is(':focus') && scope.wishlistShouldCloseAfterTimeout )
                    {
                        closeWishlist();
                    }

                };
            }
        };
    }]);
