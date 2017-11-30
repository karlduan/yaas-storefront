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
    /** This controller manages the interactions of the wishlist view. The controller is listening to the 'wishlist:udpated' event
     * and will refresh the scope's wishlist instance when the event is received. */
    .controller('WishlistCtrl', ['$scope', '$state', '$rootScope', 'WishlistSvc', 'GlobalData', 'settings', 'AuthSvc', 'AuthDialogManager', 'FeeSvc',
            function($scope, $state, $rootScope, WishlistSvc, GlobalData, settings, AuthSvc, AuthDialogManager, FeeSvc) {

                // Helper function to retrieve fees for the current wishlist
                // If no wishlist data is provided, the current wishlist will be retrieved
                function getFeesForProductsInWishlist(wishlist) {

                    // Helper function to build a map of fees information for productYrns
                    // This fees/products map will be exposed to the controller $scope
                    function buildFeesInformationForProductYrnsMap(wishlist) {
                        if (wishlist.items && Array.isArray(wishlist.items)) {
                            // This array will hold the list of productYrns of the current wishlist
                            var wishlistItemsYrn = [];
                            wishlist.items.forEach(function (item) {
                                wishlistItemsYrn.push(item.itemYrn);
                            });
                            // Get the fees for the list of productYrns
                            FeeSvc.getFeesForItemYrnList(wishlistItemsYrn).then(function (feesForProductsMap) {
                                $scope.feesInformationForProductsYrnMap = feesForProductsMap;
                            });
                        }
                    }

                    if(arguments.length === 0) {
                        // Initial call (no wishlist data provided)
                        WishlistSvc.getWishlist().then(function (wishlistData) {
                            buildFeesInformationForProductYrnsMap(wishlistData);
                        });
                    }
                    else if (arguments.length === 1) {
                        // On wishlist update (wishlist data provided)
                        buildFeesInformationForProductYrnsMap(wishlist);
                    }
                }

                // Get fees for products in wishlist (initial call without wishlist data)
                getFeesForProductsInWishlist();

                $scope.wishlist = WishlistSvc.getLocalWishlist();

                $scope.currencySymbol = GlobalData.getCurrencySymbol($scope.wishlist.currency);

                $scope.showTaxEstimation = false;

                $scope.taxConfiguration = GlobalData.getCurrentTaxConfiguration();

                $scope.couponCollapsed = true;
                $scope.taxType = GlobalData.getTaxType();

                $scope.calculateTax = WishlistSvc.getCalculateTax();
                $scope.taxableCountries = GlobalData.getTaxableCountries();

                var unbind = $rootScope.$on('wishlist:updated', function(eve, eveObj){
                    $scope.wishlist = eveObj.wishlist;
                    $scope.currencySymbol = GlobalData.getCurrencySymbol($scope.wishlist.currency);
                    $scope.taxType = GlobalData.getTaxType();
                    $scope.taxConfiguration = GlobalData.getCurrentTaxConfiguration();
                    $scope.calculateTax = WishlistSvc.getCalculateTax();

                    // Retrieve fees for the updated wishlist
                    getFeesForProductsInWishlist($scope.wishlist);
                });


                $scope.$on('$destroy', unbind);

                /** Remove a product from the wishlist.
                 * @param wishlist item id
                 * */
                $scope.removeProductFromWishlist = function (itemId) {
                    WishlistSvc.removeProductFromWishlist(itemId);
                };

                /** Toggles the "show wishlist view" property.
                 */
                $scope.toggleWishlist = function (){
                    $rootScope.showWishlist = false;
                };

                /**
                 *  Issues an "update wishlist" call to the service or removes the item if the quantity is undefined or zero.
                 */
                $scope.updateWishlistItemQty = function (item, itemQty, config) {
                    if (itemQty > 0) {
                        WishlistSvc.updateWishlistItemQty(item, itemQty, config);
                    }
                    else if (!itemQty || itemQty === 0) {
                        WishlistSvc.removeProductFromWishlist(item.id);
                    }
                };

                $scope.toCheckoutDetails = function () {
                    $scope.keepWishlistOpen();
                    if (!AuthSvc.isAuthenticated()) {
                        var dlg = AuthDialogManager.open({windowClass:'mobileLoginModal'}, {}, {}, true);

                        dlg.then(function(){
                                if (AuthSvc.isAuthenticated()) {
                                    $state.go('base.checkout.details');
                                }
                            },
                            function(){

                            }
                        );
                    }
                    else {
                        $state.go('base.checkout.details');
                    }
                };

                $scope.applyTax = function () {
                    $scope.taxEstimationError = false;
                    if ($scope.calculateTax.countryCode !== '' && $scope.calculateTax.zipCode !== '') {
                        //Save countryCode and zipCode in service
                        WishlistSvc.setCalculateTax($scope.calculateTax.zipCode, $scope.calculateTax.countryCode, $scope.wishlist.id);

                        $scope.calculateTax.taxCalculationApplied = true;

                    }
                    else {
                        //Show error message
                        $scope.calculateTax.taxCalculationApplied = false;
                        $scope.showTaxEstimation = false;
                        $scope.taxEstimationError = true;
                    }

                };

    }]);
