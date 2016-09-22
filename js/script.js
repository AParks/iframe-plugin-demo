angular.module('wizehive', []).controller('AppCntl', ['$scope', function($scope) {
	
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
