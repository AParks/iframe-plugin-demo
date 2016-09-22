(function(wizehive) {

	var SPECIAL_CHARS_REGEXP = /([\:\-\_]+(.))/g;
	var MOZ_HACK_REGEXP = /^moz([A-Z])/;
	var PREFIX_REGEXP = /^(x[\:\-_]|data[\:\-_])/i;

	/**
	 * Converts all accepted directives format into proper directive name.
	 * All of these will become 'myDirective':
	 *   my:Directive
	 *   my-directive
	 *   x-my-directive
	 *   data-my:directive
	 *
	 * Also there is special case for Moz prefix starting with upper case letter.
	 * @param name Name to normalize
	 */
	function directiveNormalize(name) {
		return wizehive.camelCase(name.replace(PREFIX_REGEXP, ''));
	}

	/**
	 * Format Plugin HTML for WizeHive Plugin System
	 *
	 * @author	Wes DeMoney <wes@wizehive.com>
	 * @author	Anna Parks <anna@wizehive.com>
	 * @since	0.5.40
	 * @param	{string}	html
	 * @returns {string}
	 */
	wizehive.formatHtml = function(html, pluginContext, $templateCache) {

		html = html || '';

		var prefix = pluginContext.prefix;
		var controller = pluginContext.controller; // backwards compatibility
		var templateId = pluginContext.template; // backwards compatibility

		// Single Root Container Needed, Will Get Ignored
		html = '<div>' + html + '</div>';

		var htmlObj = angular.element(html);

		// Prefix Script Template IDs and store contents in template cache
		htmlObj.find('script[type="text/ng-template"]').each(function(element) {

			var id = $(this).attr('id');
			var snakePrefix = wizehive.snake_case(prefix, '-');
			if (id.indexOf(snakePrefix) !== 0) {
				// Display warning, but don't completely stop execution by throwing exception
				console.warn('Template id "' + id + '" is not prefixed with the correct namespace; ' +
					'should begin with "' + snakePrefix + '". Skipping.');
				return;
			}

			var scriptTemplate = $(this).html();
			var headerTemplate = '';

			// if routable template, wrap with plugin-container and controller
			if (pluginContext.interfaces) {

				angular.forEach(pluginContext.interfaces, function(interface) {

					if (interface.template === id) {
						controller = interface.controller;
						templateId = interface.template;

						if (interface.type === 'settings') {
							headerTemplate = '<nav>' +
												'<ul class="breadcrumbs">' + 
													'<li class="breadcrumbs-icon"><i class="icon-cog"></i></li>' +
													'<li><a ng-href="/workspaces/{{workspace_id}}/admin">Settings &amp; Tools</a></li>' +
													'<li><a href="javascript:void(0)">' + pluginContext.title + '</a></li>' +
												'</ul>' +
											'</nav>';
						}
					}


				});
			}

			if (id === templateId) {

				scriptTemplate = headerTemplate +
							'<div plugin-container id="' + snakePrefix + '" class="' + snakePrefix + '" plugin-name="'+ prefix + '">' +
								'<div ng-controller="' + controller + '">' +
									scriptTemplate +
								'</div>'+
							'</div>';

			}
			if ($templateCache) {
				$templateCache.put(id, scriptTemplate);
				
console.log(id);
console.log(scriptTemplate);
			}

		});

		var newHtml = htmlObj.html();
		htmlObj = null; //avoid memory leaks

		return newHtml;

	};

	/**
	 *  Look for slugified versions of directive names which are defined in the JS
	 * as attributes, classes or elements in the HTML. Prefix them all.
	 *
	 * Note: based on https://github.com/angular/angular.js/blob/2cde927e58c8d1588569d94a797e43cdfbcedaf9/src/ng/compile.js#L1023
	 *
	 * @param	{object}	htmlObj - jQuery element to look for directives
	 * @author	Anna Parks <anna@wizehive.com>
	 * @since	0.5.40
	 * @todo	Remove this? Unused for now
	 */
	function formatDirectives(htmlObj, prefix) {

		// format for directive names
		var COMMENT_DIRECTIVE_REGEXP = /^\s*directive\:\s*([\d\w_\-]+)\s+(.*)$/,
			CLASS_DIRECTIVE_REGEXP = /(([\d\w_\-]+)(?:\:([^;]+))?;?)/;

		var pluginDirectives = angular.module('wizehive.plugins').directiveList;

		htmlObj.each(function(index, child) {

			angular.forEach(child.getElementsByTagName('*'), function(element) {

					angular.forEach(pluginDirectives, function(directive) {

						if (directive.restrict.indexOf('A') !== -1) {

							// prefix any attributes of the element if they match the directive name
							angular.forEach(element.attributes, function(attribute) {

								if (directive.oldName === directiveNormalize(attribute.name)) {

									attributeValue = $(element).attr(attribute.name);
									attributeName = prefix + '-' + attribute.name.replace(PREFIX_REGEXP, '');

									$(element).attr(attributeName, attributeValue);
									$(element).removeAttr(attribute.name);

								}
							});
						}

						if (directive.restrict.indexOf('E') !== -1) {

							// prefix the element name if it matches the directive name
							var elementName = element.nodeName.toLowerCase();
							if (directive.oldName === directiveNormalize(elementName)) {

								var begin = new RegExp('^<' + elementName);
								var end = new RegExp(elementName + '>$');

								var newName = prefix + '-' + elementName;
								var newHtml = element.outerHTML.replace(begin, '<' + newName)
											.replace(end, '<' + newName);

								element.parentNode.replaceChild($(newHtml)[0], element);
							}

						}

						if (directive.restrict.indexOf('C') !== -1) {
							// prefix any classes on the element if they match the directive name
							var className = element.className;
							var newClassName = className;

							if (angular.isString(className) && className !== '') {
								while ((match = CLASS_DIRECTIVE_REGEXP.exec(className))) {

									if (directive.oldName === directiveNormalize(match[2])) {

										newClassName = newClassName.replace(match[2], prefix + '-' + match[2]);

									}

									className = className.substr(match.index + match[0].length);
								}
							}
							element.className = newClassName;
						}

					});

			});

		});
	}

	/**
	 * Make a new plugin registration object for a third-party plugin to use
	 *
	 * @param	{string}	prefix - used to namespace this plugin and all its providers
	 * @returns {object}
	 * @author	Anna Parks <anna@wizehive.com>
	 * @author	Paul W. Smith <paul@wizehive.com>
	 */
	wizehive.makePlugin = function (prefix) {

		// Object to be returned for use by third-party plugin code
		var plugin = {};

		// Object keyed by directive name, where each value is
		// the number of directives previously registered by that name
		var numberNewDirectives = {};

		// Dependencies generated on the fly with the plugin prefix
		var prefixed = {
			services: [
				'Modal',
				'Data',
				'PluginData'
			]
		};

		// Registry of dependencies that are permitted for use by plugins
		var whiteList = {
			services: [
				// AngularJS core services
				'$anchorScroll',
				'$filter',
				'$http',
				'$interpolate',
				'$interval',
				'$locale',
				'$location',
				'$log',
				'$parse',
				'$q',
				'$resource',
				'$routeParams',
				'$scope',
				'$timeout',
				'$firebase',
				// WizeHive services
				'znConfirm',
				'znData',
				'znFiltersPanel',
				'znMessage',
				'znModal',
				'znPluginData',
				'znPluginEvents',
				'znTemplateCache',
				'znLocalStorage',
				'znCookies',
				'znWindow',
				'znUserDateFilter',
				'znFilterMatcher'
			],
			directives: [
				'ngBlur',
				'ngChange',
				'ngChecked',
				'ngModel',
				'ngClass',
				'ngBind',
				'ngChecked'
			],
			controllers: []
		};

		// Process each allowed provider type except for directives
		var providerTypes = ['services', 'factories', 'filters', 'controllers', 'constants'];

		// Registry of providers specified by this plugin
		var providers = {
			controllers: {},
			services: {},
			factories: {},
			directives: {},
			filters: {},
			constants: {}
		};

		// Flag that is set to true after register() function is called; used to block other function calls
		// after registration
		var registered = false;

		/**
		 * Throw an exception, breaking code execution, if the register() function has already been called
		 *
		 * @author	Anna Parks <anna@wizehive.com>
		 * @author	Paul W. Smith <paul@wizehive.com>
		 * @since	0.5.40
		 */
		function checkIfRegistered() {

			if (registered) {
				throw "Cannot register additional components after plugin registration.";
			}

		}

		/**
		 * Throw an exception, breaking code execution, if dependency locals are not passed in inline aray format
		 *
		 * @author	Anna Parks <anna@wizehive.com>
		 * @author	Paul W. Smith <paul@wizehive.com>
		 * @since	0.5.40
		 */
		function checkLocals(locals) {

			if (!angular.isArray(locals)) {
				throw "Inline array annotation is required for dependency definitions.\n" +
					"See https://docs.angularjs.org/guide/di#inline-array-annotation for details.";
			}

		}

		/**
		 * Throw an exception, breaking code execution, if the provider name is not prefixed with the current namespace
		 *
		 * @author	Paul W. Smith <paul@wizehive.com>
		 * @since	0.5.41
		 */
		function checkNamespace(name, type) {

			if (name.indexOf(prefix) !== 0) {
				throw prefix + ' - [' + type + '] - "' + name + '" is not prefixed with the correct namespace.';
			}

		}

		/**
		 * Set a provider definition.  Actual AngularJS registration happens later
		 *
		 * @param	{string}	name
		 * @param	{array}		locals
		 * @param	{object}	settings
		 *							type - type of AngularJS provider to register
		 *							newName - optionally override automatic prefix name update
		 * @returns	{object}	plugin
		 *
		 * @author	Anna Parks <anna@wizehive.com>
		 * @author	Paul W. Smith <paul@wizehive.com>
		 * @since	0.5.40
		 */
		function setupProvider(name, locals, settings) {

			checkIfRegistered();
			checkLocals(locals);
			checkNamespace(name, settings.type);

			// Swap out $templateCache with our wrapper version if requested
			var i;
			if ((i = locals.indexOf('$templateCache')) !== -1) {
				locals[i] = 'znTemplateCache';
			}
			
			// Swap out $window with our wrapper version if requested
			if ((i = locals.indexOf('$window')) !== -1) {
				locals[i] = 'znWindow';
			}

			// Swap out non-prefixed service with our prefixed wrapper version if requested
			angular.forEach(prefixed.services, function(prefixedService) {

				if ((i = locals.indexOf('zn' + prefixedService)) !== -1) {
					locals[i] = prefix + 'Zn' + prefixedService;
				}

			});

			// delete angular's internal cache of old versions of providers and instances
			var cacheName = name;

			if (settings.type === 'directives') {
				cacheName = cacheName + 'Directive';
			}
			if (settings.type === 'filters') {
				cacheName = cacheName + 'Filter';
			}
			if (wizehive.instanceCache && wizehive.instanceCache.hasOwnProperty(cacheName)) {
				delete wizehive.instanceCache[cacheName];
			}
			if (wizehive.instanceCache && wizehive.instanceCache.hasOwnProperty(cacheName + 'Provider')) {
				delete wizehive.instanceCache[cacheName + 'Provider'];
			}

			providers[settings.type][name] = {
				name: name,
				locals: locals
			};

			return plugin;

		}

		/**
		 * Set a constant definition.  Actual AngularJS registration happens later
		 *
		 * @param	{string}	name
		 * @param	{mixed}		value
		 * @returns	{object}	plugin
		 * @author	Anna Parks <anna@wizehive.com>
		 * @author	Paul W. Smith <paul@wizehive.com>
		 * @since	0.5.40
		 */
		plugin.constant = function(name, value) {

			checkIfRegistered();
			checkNamespace(name, 'constant');

			providers.constants[name] = {
				name: name,
				value: value
			};

			return plugin;
		};

		/**
		 * Set a service provider definition
		 *
		 * @param	{string}	name
		 * @param	{array}		locals
		 * @returns	{object}	plugin
		 *
		 * @author	Anna Parks <anna@wizehive.com>
		 * @author	Paul W. Smith <paul@wizehive.com>
		 * @since	0.5.40
		 */
		plugin.service = function(name, locals) {

			angular.module('wizehive').service(name, locals);
			return plugin;
			/*return setupProvider(name, locals, {
				type: 'services'
			});*/

		};

		/**
		 * Set a service provider definition
		 *
		 * @param	{string}	name
		 * @param	{array}		locals
		 * @returns	{object}	plugin
		 *
		 * @author	Anna Parks <anna@wizehive.com>
		 * @author	Paul W. Smith <paul@wizehive.com>
		 * @since	0.5.40
		 */
		plugin.filter = function(name, locals) {

			angular.module('wizehive').filter(name, locals);
			return plugin;
			/*return setupProvider(name, locals, {
				type: 'filters'
			});*/

		};

		/**
		 * Set a factory provider definition
		 *
		 * @param	{string}	name
		 * @param	{array}		locals
		 * @returns	{object}	plugin
		 *
		 * @author	Anna Parks <anna@wizehive.com>
		 * @author	Paul W. Smith <paul@wizehive.com>
		 * @since	0.5.40
		 */
		plugin.factory = function(name, locals) {

			angular.module('wizehive').factory(name, locals);
			return plugin;
			/*return setupProvider(name, locals, {
				type: 'factories'
			});*/

		};

		/**
		 * Set a controller provider definition
		 *
		 * @param	{string}	name
		 * @param	{array}		locals
		 * @returns	{object}	plugin
		 *
		 * @author	Anna Parks <anna@wizehive.com>
		 * @author	Paul W. Smith <paul@wizehive.com>
		 * @since	0.5.40
		 */
		plugin.controller = function(name, locals) {

			angular.module('wizehive').controller(name, locals);
			return plugin;
			//return setupProvider(name, locals, {
			//	type: 'controllers'
			//});

		};

		/**
		 * Set a directive provider definition
		 *
		 * @param	{string}	name
		 * @param	{array}		locals
		 * @returns	{object}	plugin
		 *
		 * @author	Anna Parks <anna@wizehive.com>
		 * @author	Paul W. Smith <paul@wizehive.com>
		 * @since	0.5.40
		 */
		plugin.directive = function(name, locals) {

			angular.module('wizehive').directive(name, locals);
			return plugin;
			/*if (!numberNewDirectives.hasOwnProperty(name)) {
				numberNewDirectives[name] = 1;
			} else {
				numberNewDirectives[name]++;
			}

			return setupProvider(name, locals, {
				type: 'directives'
			});*/

		};

		/**
		 * Register all components of a third-party plugin.
		 * Must be run after all provider definitions (service, controller, etc.) for this plugin
		 *
		 * @param	{string}	pluginName
		 * @param	{object}	settings
		 * @returns	{object}	plugin
		 *
		 * @author	Anna Parks <anna@wizehive.com>
		 * @author	Paul W. Smith <paul@wizehive.com>
		 * @since	0.5.40
		 */
		plugin.register = function(pluginName, settings) {

			checkIfRegistered();
			registered = true;

			if (!angular.isObject(settings)) {
				throw "Plugin registration settings must be an object";
			}

			/*angular.forEach(prefixed.services, function(prefixedService) {

				angular.module('wizehive.plugins').lazyLoader.service(prefix + 'Zn' + prefixedService, [prefixedService + 'Factory', function(Factory) {
					return Factory(prefix);
				}]);

			});

			angular.forEach(providerTypes, function(type) {

				angular.forEach(providers[type], function(provider, name) {

					if (type !== 'constants') {
						provider.locals = processLocals(type, provider.locals);
					}

					switch (type) {
						case 'constants':
							angular.module('wizehive.plugins').lazyLoader.constant(provider.name, provider.value);
							break;
						case 'controllers':
							angular.module('wizehive.plugins').lazyLoader.controller(provider.name, provider.locals);
							break;
						case 'filters':
							angular.module('wizehive.plugins').lazyLoader.filter(provider.name, provider.locals);
							break;
						case 'services':
							angular.module('wizehive.plugins').lazyLoader.service(provider.name, provider.locals);
							break;
						case 'factories':
							angular.module('wizehive.plugins').lazyLoader.factory(provider.name, provider.locals);
							break;
						case 'directives':
							setupDirective(provider);
							break;
					}

				});

			});

			// Process directives. These require special handling because we need to run the directive constructor function
			// to get the directive definition (so that we can see/update controller, require, templates, etc.).
			// To do that we need to actually provide all the required dependencies so they're available in closure to the
			// generated compile/link functions
			angular.forEach(providers.directives, setupDirective);

			angular.forEach(providers.directives, registerDirective);
*/
			if (settings.route) {
				settings.route = '/plugin' + settings.route;
			}

			if (settings.nested) {
				delete settings.nested;
			}

			settings.namespace = prefix;
			// Default settings
			settings.isThirdParty = true;

			wizehive.register(prefix, settings);

			return plugin;

		};

		/**
		 * Get new name for a directive dependency (controller or other directive)
		 * Checks updated directives/controllers and whitelist
		 *
		 * @param	{string}	name
		 * @param	{string}	providerType - directive or controller
		 * @param	{array}		whiteList - to use for this lookup
		 * @returns	{string}
		 *
		 * @author	Anna Parks <anna@wizehive.com>
		 * @author	Paul W. Smith <paul@wizehive.com>
		 * @since	0.5.40
		 */
		function directiveDependencyName(name, providerType, whiteList) {

			var check = name;
			if (name.match(/^\^/)) {
				check = name.substring(1);
			}

			if (!providers[providerType][check] && whiteList.indexOf(check) === -1) {
				throw "Unknown or prohibited directive: " + check;
			}

			return name;

		}

		/**
		 * Set up a directive
		 * Update locals and instantiate constructor, update 'require' and 'controller',
		 * and register the updated directive
		 *
		 * @param	{object}	directive
		 *
		 * @author	Anna Parks <anna@wizehive.com>
		 * @author	Paul W. Smith <paul@wizehive.com>
		 * @since	0.5.40
		 */
		function setupDirective(directive) {

			directive.locals = processLocals('directives', directive.locals);

			// Instantiate the directive constructor, using the updated dependency list, so we can parse its properties
			var directiveObject = wizehive.injector.invoke(directive.locals);

			// parse out required controllers
			if (directiveObject.controller) {
				directiveObject.controller = directiveDependencyName(directiveObject.controller, 'controllers', whiteList.controllers);
			}

			// parse out 'require' parent directives
			if (directiveObject.require) {

				if (angular.isArray(directiveObject.require)) {
					angular.forEach(directiveObject.require, function(directiveName, index) {
						directiveObject.require[index] = directiveDependencyName(directiveName, 'directives', whiteList.directives);
					});
				} else if (angular.isString(directiveObject.require)) {
					directiveObject.require = directiveDependencyName(directiveObject.require, 'directives', whiteList.directives);
				}

			}

			providers.directives[directive.name].directiveObject = directiveObject;

		}

		/**
		 * Update html on 'template' option and register the updated directive
		 *
		 * @param	{object}	directive
		 *
		 * @author	Anna Parks <anna@wizehive.com>
		 * @author	Paul W. Smith <paul@wizehive.com>
		 * @since	0.5.40
		 */
		function registerDirective(directive) {

			var directiveObject = directive.directiveObject;

			// New constructor that returns the already-DI'd directive object
			var newDirectiveFunction = function() {
				return directiveObject;
			};

			angular.module('wizehive.plugins').lazyLoader.directive(directive.name, [newDirectiveFunction]);

			angular.module('wizehive.plugins').lazyLoader.decorator(directive.name + 'Directive', ['$delegate', function($delegate) {

					// $delegate is array of all directives with this name
					// we only want the directives registered during this makePlugin function call
					var numberOldDirectives = $delegate.length - numberNewDirectives[directive.name];
					$delegate.splice(0, numberOldDirectives);

					return $delegate;
			}]);

		}

		/**
		 * Generate updated locals list with whiteLists
		 *
		 * @param	{string}	type - type of provider
		 * @param	{array}		locals
		 * @returns	{array}		locals - updated
		 *
		 * @author	Anna Parks <anna@wizehive.com>
		 * @author	Paul W. Smith <paul@wizehive.com>
		 * @since	0.5.40
		 */
		function processLocals(type, locals) {

			angular.forEach(locals, function(local, index) {
				// Constructor function should be skipped
				if (angular.isString(local)) {

					var found = false;

					angular.forEach(providerTypes, function(type) {

						if (providers[type][local]) {
							// User-defined provider
							found = true;
						} else if (!found && whiteList.services.indexOf(local) !== -1) {
							// Built-in provider that has been whiteListed
							found = true;
						} else if (!found) {

							var nonPrefixedLocal = local.substring((prefix + 'Zn').length, local.length);

							if (local.indexOf(prefix + 'Zn') === 0 &&
								prefixed.services.indexOf(nonPrefixedLocal) !== -1) {
								// Built-in prefixed provider
								found = true;
							}
						}

					});

					if (!found) {
						throw "Unknown or prohibited provider: " + local;
					}

				}

			});

			return locals;

		}

		return plugin;

	};
	
	jQuery.ajax({
		url: 'https://aparks.github.io/iframe-plugin-demo/plugin/plugin.html',
		success: function(html) {
			console.log(html);
			$('div[ng-controller=AppCntl]').prepend(html);
		}
	});	
})(wizehive);
