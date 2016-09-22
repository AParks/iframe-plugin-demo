angular.module('wizehive', []).controller('AppCntl', ['$scope', '$http', '$templateCache', function(
		$scope, $http, $templateCache
) {

	$http.get('/iframe-plugin-demo/plugin/plugin.html').then(function(response) {
		var pluginContext = {
			prefix: 'demoPlugin',
			controller: 'demoPluginCntl',
			template: 'demo-plugin-main'
		}
		console.log(response.data);
	    wizehive.formatHtml(response.data, pluginContext, $templateCache);
	});

	console.log('main controller');

}]);
