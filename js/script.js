angular.module('wizehive.services', []);
angular.module('wizehive', ['wizehive.services']).controller('AppCntl', ['$scope', '$http', '$templateCache', function($scope, $http, $templateCache) {
	
	$http.get('/iframe-plugin-demo/plugin/plugin.html').then(function(response) {
		var pluginContext = {
			prefix: 'demoPlugin',
			controller: 'demoPluginCntl',
			template: 'demo-plugin-main'
		}
	    wizehive.formatHtml(response.data, pluginContext, $templateCache);
		$scope.template = 'demo-plugin-main';

	});
}]);
