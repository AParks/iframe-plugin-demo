angular.module('wizehive', []).controller('AppCntl', ['$scope', '$http', '$templateCache', function(
		$scope, $http, $templateCache
) {

	$http.get('/iframe-plugin-demo/plugin/plugin.html').then(function(response) {
		var pluginContext = {
			prefix: 'demoPlugin',
			controller: 'demoPluginCntl',
			template: 'demo-plugin-main'
		}
	    wizehive.formatHtml(raw_html, pluginContext, $templateCache);
	});

	console.log('main controller');

}]);
