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

angular.module('ds.account')

    .controller('AccountCtrl', ['$scope', 'addresses', 'account', 'orders', 'OrderListSvc','wishlist', 'PriceSvc','AccountSvc','ProductSvc', '$uibModal', 'GlobalData', '$translate',

        function ($scope, addresses, account, orders, OrderListSvc, wishlist, PriceSvc, AccountSvc,ProductSvc,$uibModal, GlobalData, $translate) {

            var self = this;
            self.allOrdersLoaded = false;
            var modalInstance;
            var customerNumber = !!account ? account.customerNumber : null;

            var getDefaultAddress = function () {
                return _.find($scope.addresses, function (addr) {
                    return addr.isDefault;
                });
            };

            $scope.errors = [];
            $scope.account = account;
            $scope.addresses = addresses;
            $scope.orders = orders;	    
            $scope.products= [];
            $scope.prices = {};
            $scope.defaultAddress = getDefaultAddress();

            // show more or less addresses.
            $scope.showAddressDefault = 6;
            $scope.showAddressButtons = ($scope.addresses.length > $scope.showAddressDefault);
            $scope.showAllAddressButton = true;
            $scope.showAddressFilter = $scope.showAddressDefault;

            // show more or less orders.
            $scope.showOrdersDefault = 10;
            $scope.showAllOrdersButton = true;
            $scope.showOrderButtons = ($scope.orders.length >= $scope.showOrdersDefault);
            $scope.showOrdersFilter = $scope.showOrdersDefault;

            var extractServerSideErrors = function (response) {
                var errors = [];
                if (response.status === 400) {
                    if (response.data && response.data.details && response.data.details.length) {
                        errors = response.data.details;
                    }
                } else if (response.status === 403 || response.status === 409 || response.status === 401 || response.status === 404) {
                    if (response.data && response.data.message) {
                        errors.push({ message: response.data.message });
                    }
                }
                return errors;
            };

            var extractAddressErrors = function (response, errorMsg) {
                var errors = extractServerSideErrors(response);
                if (response.status === 500) {
                    errors.push({ message: errorMsg });
                }
                return errors;
            };

            // handle dialog dismissal if user select back button, etc
            $scope.$on('$destroy', function () {
                if (modalInstance) {
                    modalInstance.dismiss('cancel');
                }
            });

            $scope.save = function (address, formValid, form /*,formObj*/) {
                // console.log('AddrForm', formObj.$error.required); // Important debug for dynamic form validation.
                $scope.$broadcast('submitting:form', form);
                if (formValid) {
                    AccountSvc.saveAddress(address).then(
                        function () {
                            modalInstance.close();
                        },
                        function (response) {
                            $scope.errorAddressId = null;
                            $scope.errors = extractAddressErrors(response, $translate.instant('SAVE_ADDRESS_ERROR'));
                        });
                } else {
                    $scope.showPristineErrors = true;
                }
            };

            $scope.saveOnEnter = function ($event, address, formValid, form) {
                if ($event.keyCode === 13) {
                    $event.preventDefault();
                    $scope.save(address, formValid, form);
                }
            };

            $scope.openAddressModal = function (address) {
                var fullName = '';
                if ($scope.account.firstName) {
                    fullName = fullName + $scope.account.firstName + ' ';
                }
                if ($scope.account.middleName) {
                    fullName = fullName + $scope.account.middleName + ' ';
                }
                if ($scope.account.lastName) {
                    fullName = fullName + $scope.account.lastName;
                }
                $scope.address = angular.copy(address || {
                    account: customerNumber,
                    contactName: fullName
                });
                $scope.showPristineErrors = false;
                $scope.errors = [];
                modalInstance = $uibModal.open({
                    templateUrl: './js/app/account/templates/address-form.html',
                    scope: $scope,
                    backdrop: 'static'
                });

                modalInstance.opened.then(function () {
                    setTimeout(function () {
                        // once dialog is open initialize dynamic localized address.
                        $scope.$emit('localizedAddress:updated', address.country, 'addAddress');
                    }, 10);
                });

                modalInstance.result.then(function () {
                    $scope.refreshAddresses();
                });
            };

            $scope.closeAddressModal = function () {
                modalInstance.close();
            };

            $scope.removeAddress = function (address) {
                address.account = customerNumber;

                $uibModal.open({
                    templateUrl: 'js/app/account/templates/dialogs/address-remove-dialog.html',
                    controller: 'AddressRemoveDialogCtrl'
                }).result.then(function (deleteAddress) {

                    if (deleteAddress) {
                        AccountSvc.removeAddress(address)
                            .then(function () {
                                $scope.refreshAddresses();
                            }, function (response) {
                                $scope.errorAddressId = address.id;
                                $scope.errors = extractAddressErrors(response, $translate.instant('REMOVE_ADDRESS_ERROR'));
                            });
                    }
                });
            };

            $scope.refreshAddresses = function () {
                AccountSvc.getAddresses().then(function (addresses) {
                    $scope.addresses = addresses;
                    $scope.defaultAddress = getDefaultAddress();
                    $scope.showAddressButtons = ($scope.addresses.length > $scope.showAddressDefault);
                    $scope.showAllAddressButton = ($scope.addresses.length > $scope.showAddressFilter - 1);
                });
            };

            $scope.setAddressAsDefault = function (address) {
                address.isDefault = true;
                address.account = customerNumber;
                AccountSvc.saveAddress(address).then(
                    function () {
                        $scope.refreshAddresses();
                    },
                    function (response) {
                        $scope.refreshAddresses();
                        $scope.errorAddressId = address.id;
                        $scope.errors = extractAddressErrors(response, $translate.instant('UPDATE_DEFAULT_ADDRESS_ERROR'));
                    }
                );
            };


            $scope.showAllOrders = function () {
                $scope.showAllOrdersButton = !$scope.showAllOrdersButton;

                var parms = {
                    pageSize: GlobalData.orders.meta.total
                };
                if (self.allOrdersLoaded) {
                    $scope.showOrdersFilter = $scope.showAllOrdersButton ? $scope.showOrdersDefault : $scope.orders.length;
                    $scope.showOrderButtons = ($scope.orders.length > $scope.showOrdersDefault);
                } else {
                    OrderListSvc.query(parms).then(function (orders) {
                        $scope.orders = orders;

                        // show filtered list or show all orders. Hide if all data is shown within filter.
                        $scope.showOrdersFilter = $scope.showAllOrdersButton ? $scope.showOrdersDefault : $scope.orders.length;
                        $scope.showOrderButtons = ($scope.orders.length > $scope.showOrdersDefault);
                        self.allOrdersLoaded = true;
                    });
                }
            };

            $scope.showAllAddresses = function () {
                $scope.showAllAddressButton = !$scope.showAllAddressButton;
                $scope.showAddressFilter = $scope.showAllAddressButton ? $scope.showAddressDefault : $scope.addresses.length;
                $scope.showAddressButtons = ($scope.addresses.length > $scope.showAddressDefault);
            };
            function getProductIdsFromWishlist(items){
              return _.map(items, function(item){
                return item.itemYrn ? getIdFromItemYrn(item.itemYrn) : '';
              }).join(',');
            };
            function getProductNamesFromWishlist(wishlist) {
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
             };
            /*
             need to set the currency symbol for each order
             */
            angular.forEach($scope.orders, function (order) {
                order.currencySymbol = GlobalData.getCurrencySymbol(order.currency);
            });

        }]);
