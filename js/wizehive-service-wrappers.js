angular.module('wizehive.services')
	/**
	 * znConfirm - plugin wrapper/namespace for confirm
	 * 
	 * Copyright (c) WizeHive - http://www.wizehive.com
	 * 
	 * @author	Wes DeMoney <wes@wizehive.com>
	 * @since	0.5.44
	 */
	.service('znConfirm', ['confirm', function(confirm) {		
		return confirm;
	}])
	/**
	 * znData - plugin wrapper/namespace for Data
	 * 
	 * Copyright (c) WizeHive - http://www.wizehive.com
	 * 
	 * @author	Wes DeMoney <wes@wizehive.com>
	 * @since	0.5.44
	 */
	.service('znData', ['Data', function(Data) {
		return Data;
	}])
	/**
	 * znMessage - plugin wrapper/namespace for message
	 * 
	 * Copyright (c) WizeHive - http://www.wizehive.com
	 * 
	 * @author	Wes DeMoney <wes@wizehive.com>
	 * @since	0.5.44
	 */
	.service('znMessage', ['message', function(message) {
		return message;
	}])
	/**
	 * znModal - plugin wrapper/namespace for modal
	 * 
	 * Copyright (c) WizeHive - http://www.wizehive.com
	 * 
	 * @author	Wes DeMoney <wes@wizehive.com>
	 * @since	0.5.44
	 */
	.service('znModal', ['modal', function(modal) {
		return modal;
	}])
	/**
	 * znPluginEvents - plugin wrapper/namespace for PluginEvents
	 * 
	 * Copyright (c) WizeHive - http://www.wizehive.com
	 * 
	 * @author	Wes DeMoney <wes@wizehive.com>
	 * @since	0.5.44
	 */
	.service('znPluginEvents', ['PluginEvents', function(PluginEvents) {
		return PluginEvents;
	}])
	/**
	 * znFiltersPanel - plugin wrapper/namespace for Filters Panel
	 * 
	 * Copyright (c) WizeHive - http://www.wizehive.com
	 * 
	 * @author	Wes DeMoney <wes@wizehive.com>
	 * @since	0.5.51
	 */
	.service('znFiltersPanel', ['filtersPanel', function(filtersPanel) {
		return filtersPanel;
	}]);


