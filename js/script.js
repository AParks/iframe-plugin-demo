angular.module('wizehive', []).controller('AppCntl', ['$scope', '$http', '$templateCache', function(
		$scope, $http, $templateCache
) {

	window.wizehive = window.parent.window.wizehive;
	console.log(wizehive.token());
	$http.get('/iframe-plugin-demo/plugin/plugin.html').then(function(response) {
		var pluginContext = {
			prefix: 'demoPlugin',
			controller: 'demoPluginCntl',
			template: 'demo-plugin-main'
		}
	    wizehive.formatHtml(response.data, pluginContext, $templateCache);
	    console.log($templateCache.get('demo-plugin-main'));

	});

	console.log('main controller');

}]);
