/**
 * Wizehive plugins
 *
 * Copyright (c) WizeHive - http://www.wizehive.com
 *
 * @since 0.x.x
 */
(function(wizehive) {
	var debugMode = !!wizehive.config('debug');
	/* Converts a snake-case string to camelCase. */
	var SNAKE_CASE_REGEXP = /([\:\-\_]+(.))/g;
	function camelCase(name, capFirst) {
		return name.
			replace(SNAKE_CASE_REGEXP, function(_, separator, letter, offset) {
				return (offset || capFirst) ? letter.toUpperCase() : letter;
			});
	}

	function onSuccess(plugin, options) {
		if(typeof options.success === 'function') {
			options.success(plugin);
		}
		if(options.fullPage) {
			//addRoute(plugin, options);
		}
	}

	var _plugins = [],
		_reference = {};

	wizehive.deregister = function(name) {
		name = name.toLowerCase();
		var deregisteredPlugin;
		if (_reference[name]) {
			angular.forEach(_plugins, function(plugin, index){
				if (plugin.name === name) {
					deregisteredPlugin = plugin;
					_plugins.splice(index, 1);
					delete _reference[name];
				}
			});
		}
		return deregisteredPlugin;
	};

	wizehive.register = function(name, options) {

		name = name.toLowerCase();

		options = $.extend({
			debug: !!debugMode, 
			fullPage: false, 
			nested: 0,
			nestedId: 0,
			topNav: false, // keep for backwards compatibiility
			fullWidth: false,
			pageTitle: false,
			template: '', // keep for backwards compatibiility
			redirect: false, 
			path: '/plugins', 
			success: angular.noop,
			route: '/' + name,
			routes: false, // keep for backwards compatibiility
			context: 'workspace', // keep for backwards compatibiility
			location: '', // keep for backwards compatibiility
			isThirdParty: false,
			namespace: null,
			type: options.fullPage ? 'fullPage' : 'inline',
			interfaces: null,
			order: 0 // keep for backwards compatibiility
		}, options);

		if(!options.pageTitle && options.pageTitle !== false) {
			options.pageTitle = options.title;
		}
		
		var basePath = options.path;
		if(!options.camelName) {
			options.camelName = camelCase('-' + name, true);
		}

		if(basePath[basePath.length-1] !== '/') {
			basePath += '/';
		}
		basePath += name + '/';

		// If this plugin has already been registered, just run the success function
		if(_reference[name]) {
			onSuccess(_reference[name], options);
		} else {

			// URL Route
			var route = options.route,
				routes = [],
				nested = options.nested,
				nestedId = options.nestedId;

			// only construct URL routes if routable (i.e. settings, fullPage) plugin
			var onRoutableMatch = function(interface) {

				if (interface.routes) {
					
					// add baseRoute to list of routes
					routes.push(route);

					// prepend each passed route with the baseRoute
					if (angular.isArray(interface.routes)) {
						angular.forEach(interface.routes, function(partialRoute, index) {
							routes.push(route + partialRoute);
						});
					} else if (angular.isString(interface.routes)) {
						routes.push(route + options.routes);
					}
					
				} else {
					// Handle nesting
					if(typeof nested === 'number' && nested > 0) {
						if(nested > 10) { nested = 10; } // enforce some sanity
						while(nested--) {
							route = route.replace(/\-/, '/');
						}
					}
					if(typeof nestedId && nestedId > 0) {
						var urlParts = route.split('/');
						if(urlParts.length > nestedId) {
							urlParts[nestedId] = ':' + urlParts[nestedId];
						}
						route = urlParts.join('/');
					}

					routes.push(route);

				}
			};

			wizehive.plugins.matchesTypes(options, ['settings', 'fullPage'], onRoutableMatch);

			// Construct new plugin object
			var plugin = {
				name: name,
				title: options.title,
				pageTitle: options.pageTitle,
				routes: routes,
				camelName: options.camelName,
				fullPage: options.fullPage,
				location: options.location,
				template: options.template,
				order: options.order,
				type: options.type,
				fullWidth: options.fullWidth,
				topNav: options.topNav,
				icon: options.icon,
				context: options.context,
				isThirdParty: options.isThirdParty,
				interfaces: options.interfaces,
				namespace: options.namespace,
				controller: options.controller || options.camelName + 'Cntl'
			};
			_plugins.push(plugin);
			_reference[name] = plugin;
			onSuccess(plugin, options);
		}
		
		return wizehive;
	};

	wizehive.plugins = function() {
		return _plugins;
	};

	wizehive.plugins.getByRoute = function(path) {
		var name = path.replace('/', '').replace(/\//g, '-');
		return _reference[name];
	};

	/**
	 * Determine if a plugin has an interface with any of the specified types
	 *
	 * @since   0.5.63
	 * @author  Anna Parks <anna@wizehive.com>
	 *
	 * @param    {Object}	plugin - registered plugin object
	 * @param    {Array}	types - list of types to match against
	 * @param    {Function}	onMatch - callback to excute when a type match is found
	 * @returns    {Boolean} - whether plugin contains any of the passed types
	 */
	wizehive.plugins.matchesTypes = function(plugin, types, onMatch) {


		if (plugin.interfaces) {

			var routableInterfaces = plugin.interfaces.filter(function(interface) {

				if (types === true || types.indexOf(interface.type) !== -1) {

					if (typeof onMatch === 'function') {
						onMatch(interface);
					}

					return true;
				}

				return false;
			});

			return routableInterfaces.length > 0;

		}

		// backwards compatibility
		var isDeprecatedType = types === true || types.indexOf(plugin.type) !== -1;

		if (types.length && types.indexOf('fullPage') !== -1) {
			isDeprecatedType = isDeprecatedType || plugin.fullPage;
		}

		if (isDeprecatedType && typeof onMatch === 'function') {
			onMatch(plugin);
		}

		return isDeprecatedType;

	};
})(wizehive);

/**
 * Plugins factory
 *
 * @author Unknow
 * @since 0.x.x
 */
angular.module('wizehive.plugins', [])
.factory('plugins', function($rootScope, $location, $route, UserPlugin, debugMode) {
	/* Converts a snake-case string to camelCase. */
	var SNAKE_CASE_REGEXP = /([\:\-\_]+(.))/g;
	function camelCase(name, capFirst) {
		return name.
			replace(SNAKE_CASE_REGEXP, function(_, separator, letter, offset) {
				return (offset || capFirst) ? letter.toUpperCase() : letter;
			});
	}

	/* Dynamically add URL routes for post-app load injected plugins */
	function addRoute(plugin, options) {
		var urlPath = '/' + plugin.name,
			workspaceUrlPath = '/workspaces/:workspace_id' + urlPath;

		// Don't override a path if it's already there. Prevents plugins from overriding other plugins or core features
		if(!$route.routes[urlPath]) {
			var templatePath = plugin.basePath + 'templates/' + plugin.name + '.html';
			// Define new routes for both with and without a workspace prefix.
			$route.routes[urlPath] = { reloadOnSearch:true, templateUrl:templatePath };
			$route.routes[workspaceUrlPath] = { reloadOnSearch:true, templateUrl:templatePath };

			// Redirect to the new route if register asked to do so
			if(options.redirect) {
				var redirectTo = urlPath;
				if($route.current.params.workspace_id) {
					redirectTo = '/workspaces/' + $route.current.params.workspace_id + redirectTo;
				}
				$location.path(redirectTo);
			}
		}
	}

	function loadFile(path, success, dataType, sync) {
		return $.ajax({
			url: path, 
			dataType: dataType || 'script',
			async: !sync,
			success: function(resp) {
				if(typeof success === 'function') {
					success(resp);
				}
			},
			error: function() {
				throw "Couldn't load expected plugin file.";
			}
		});
	}

	function loadFiles(plugin, options, complete) {
		if(options.debug) {
			// Load config to load other files
			loadFile(plugin.basePath + 'config.json', function(config) {
				var toLoad = [];
				if(config) {
					if(config.files) {
						angular.forEach(config.files, function(files, key) {
							if(key.indexOf('.js') > -1) {
								angular.forEach(files, function(file) {
									toLoad.push(loadFile(plugin.basePath + 'js/' + file));
								});
							} else if(key.indexOf('.css') > -1) {
								angular.forEach(files, function(file) {
									$('<link />', {
										rel: 'stylesheet',
										type: 'text/css',
										href: plugin.basePath + 'css/' + file
									}).appendTo('head');
								});
							}
						});
						delete config.files;
					}
					plugin = $.extend(plugin, config);
				}

				$.when.apply($, toLoad).then(function() {
					if(typeof complete === 'function') {
						complete(plugin);
					}
				});
			}, 'json');
		} else {
			$.when(
				loadFile('/dest/' + plugin.name + '/' + plugin.name + '.min.js'),
				loadFile('/dest/' + plugin.name + '/' + plugin.name + '.min.css')
			).then(function() {
				if(typeof complete === 'function') {
					complete(plugin);
				}
			});
		}
	}

	function loadDevPlugin(pluginName) {
		var dfd = new jQuery.Deferred();
		wizehive.register(pluginName, {
			success: function(plugin) {
				dfd.resolve(plugin);
			}
		});
		return dfd.promise();
	}

	function loadDevPlugins() {
		var dfd = new jQuery.Deferred();
			
		if(debugMode) {
			var debugPlugins = wizehive.config('debugPlugins');
			if(debugPlugins && debugPlugins.length) {
				var toLoad = [];
				angular.forEach(debugPlugins, function(pluginName) {
					toLoad.push(loadDevPlugin(pluginName));
				});
				$.when.apply($, toLoad).done(function() {
					dfd.resolve(Array.prototype.slice.call(arguments, 0));
				});
			}
		} else {
			dfd.resolve([]);
		}
		
		return dfd.promise();
	}

	function loadUserPlugins(userId) {
		var dfd = new jQuery.Deferred();
		
		UserPlugin.query({ user: {id: userId }}, function(plugins) {
			dfd.resolve(plugins);
		});
		
		return dfd.promise();
	}

	var service = {
		// Helper function that allows plugins to dynamically load templates located relative to wherever the plugin was registered.
		template: function(pluginId, relativePath) {
			if(_plugins[pluginId]) {
				return _plugins[pluginId].basePath + 'templates/' + relativePath;
			}
		},
		loadPlugins: function(userId, complete) {
			$.when(loadDevPlugins(), loadUserPlugins(userId)).done(function(devPlugins, userPlugins) {
				var plugins = [];
				if(angular.isArray(devPlugins)) {
					plugins = plugins.concat(devPlugins);
				}
				if(angular.isArray(userPlugins)) {
					plugins = plugins.concat(userPlugins);
				}
				if(typeof complete === 'function') {
					complete(plugins);
				}
			});
		}
	};
	return service;
});
