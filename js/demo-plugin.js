(function(prefix, wizehive, angular) {

	// Get plugin registration object and protect important items within plugin code
	var plugin = wizehive.makePlugin(prefix);
	wizehive = null;

	angular = angular.extend({}, angular);
	delete angular.module;
	delete angular.injector;
	delete angular.bootstrap;

	var window = null,
		SnapEngage = null,
		UserVoice = null,
		_cio = null,
		userEvent = null;
	
	

/**
 * Demo Controller
 */
plugin.controller('demoPluginCntl', ['$scope', function ($scope) {
	
	$scope.text = 'Hello World!';

}])

/**
 * Demo Settings Controller
 */
.controller('demoPluginSettingsCntl', ['$scope', function ($scope) {
	
	$scope.text = 'Hello Settings World!';

}])

/**
 * Plugin Registration
 */
.register('demo-plugin', {
	route: '/demo-plugin',
	title: 'Demo Plugin',
	icon: 'icon-puzzle',
	interfaces: [
		{
			controller: 'demoPluginCntl',
			template: 'demo-plugin-main',
			type: 'fullPage',
			order: 300,
			topNav: true,
			routes: [
				'/:page'
			]
		},
		{
			controller: 'demoPluginSettingsCntl',
			template: 'demo-plugin-settings',
			type: 'settings'
		}
	]
});
 
})("demoPlugin", wizehive, angular);
