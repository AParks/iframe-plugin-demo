/**
 * Wizehive resources
 *
 * Copyright (c) WizeHive - http://www.wizehive.com
 *
 * 
 * @since 0.x.x
 */
angular.module('wizehive.auth', [])
/**
 * Auth
 *
 * @author Unknown
 * @since 0.x.x
 */
.factory('Auth', ['$q', function($q) {
	var _auth = { refreshing:false },
		_pending = [],
		refreshRetryTimeout = 5000,
		refreshMaxRetries = 12;

	function _processToken(data){
		if (data.accessToken) {
			wizehive.token(data.accessToken);
			wizehive.tokenExpires(data.expires);
			wizehive.serverTime(data.serverTime);
			wizehive.adjustTokenExpiration();
		} else {
			window.location.href = '/logout';
		}
	}

	_auth.queue = function(request) {
		_pending.push(request);
	};

	_auth.refresh = function(request) {

		var attemptCount = 0;

		if (request) {
			_auth.queue(request);
		}

		if (_auth.refreshing) {
			// Refresh already in progress; queued request will execute when done
			return;
		}

		_auth.refreshing = true;

		var deferred = $q.defer();
		
		/**
		 * Make actual refresh token request. If connection fails, retry until limit is reached.
		 * This allows for recovery from network problems without forcing a logout
		 * 
		 * @author	Paul W. Smith <paul@wizehive.com>
		 * @since	0.5.64
		 */
		function makeRefreshRequest() {
			
			jQuery.ajax({
				method: 'POST',
				url: '/refresh-token',
				dataType: 'json'
			})
			.done(function(data) {
				_auth.refreshing = false;
				_processToken(data);
				_pending.forEach(function(request) {
					request.execute().then(
						function(resp) {
							if (request.deferred) {
								request.deferred.resolve(resp);
							}
						}, function(err) {
							if (request.deferred) {
								request.deferred.reject(err);
							}
						}
					);
				});
				_pending = [];
				deferred.resolve();
			})
			.fail(function(xhr, textStatus, error) {

				attemptCount++;

				if (xhr.status === 0 && attemptCount <= refreshMaxRetries) {
					// connection failure - wait and try again so computer has a chance to connect to internet
					setTimeout(makeRefreshRequest, refreshRetryTimeout);
				} else {
					// Can't get refresh token - log out
					window.location.href = '/logout';
				}

			});

		}

		makeRefreshRequest();
		return deferred.promise;
		
	};

	return _auth;
}]);

/**
 * Data factory
 *
 * @author Unknown
 * @since 0.x.x
 */
angular.module('wizehive.resources', ['ngResource', 'wizehive.auth'])
.factory('DataFactory', ['$rootScope', '$http', '$q', '$resource', 'Auth', function($rootScope, $http, $q, $resource, Auth) {

	return function(data) {

		var pluginData = data || null;

		var _apiBaseUrl = wizehive.config('constants').API_URL || '';
		
		/**
		 * Maximum request duration, in ms, beyond which an auth token refresh + retry should not be attempted.
		 * Authentication failures return very quickly. Helps prevent duplicate requests on server failure
		 *
		 * @since 0.5.62
		 *
		 * @type {Number}
		 */
		var retryTimeout = 5000;

		// originated from: https://gist.github.com/penguinboy/762197
		function _flattenObject(ob) {
			var toReturn = {};

			for (var i in ob) {
				if (!ob.hasOwnProperty(i)) continue;
				if ((typeof ob[i]) == 'object') {
					if (ob[i] instanceof Array) {
						toReturn[i] = ob[i].join(',');
					} else {
						var flatObject = _flattenObject(ob[i]);
						for (var x in flatObject) {
							if (!flatObject.hasOwnProperty(x)) continue;
							toReturn[i + '.' + x] = flatObject[x];
						}
					}
				} else {
					toReturn[i] = ob[i];
				}
			}
			return toReturn;
		}

		function beforeFilter(params) {
			params = _flattenObject(params);

			return params;
		}

		/**
		 * Helper function for translating camelCase to snake-case.
		 *
		 * @since 0.5.55
		 * @author Anna Parks <anna@wizehive.com>
		*/
		function snakeCase(name){
			var regexp = /[A-Z]/g;
			var separator = '-';
			return name.replace(regexp, function(letter, pos) {
			  return (pos ? separator : '') + letter.toLowerCase();
			});
		}


		/**
		 * Has Validate Only Param
		 *
		 * @param	{object}	params
		 * @returns	{boolean}
		 *
		 * @author	Paul W. Smith <paul@wizehive.com>
		 * @author	Anna Parks <anna@wizehive.com>
		 * @since	0.5.64-4
		 */
		function hasValidateOnlyParam(params) {

			var hasValidateOnly = false;

			if (params && params.validate_only && params.validate_only === true) {
				hasValidateOnly = true;
			}

			if (params && params.validate && params.validate === 'only') {
				hasValidateOnly = true;
			}

			return hasValidateOnly;
		}


		/**
		 * Broadcast internally and to plugins
		 * an event with data about the successful resource call
		 *
		 * @since 0.5.55
		 * @author Anna Parks <anna@wizehive.com>
		*/
		function broadcastResourceSuccess(resourceName, resourceData, action, params) {

			var actionMap = {
				get: 'read',
				query: 'read',
				create: 'saved',
				createAll: 'saved-all',
				update: 'saved',
				updateAll: 'updated-all',
				delete: 'deleted',
				deleteAll: 'deleted-all'
			};

			var eventName = snakeCase(resourceName) + '-' + actionMap[action];

			var args = [eventName, params, resourceData];

			var pluginArgs = ['zn-data-' + eventName, resourceData, params];

			// If the action is one of: create, createAll, update or updateAll
			// and the param `validate_only` is present and set to `true` it 
			// will NOT broadcast events
			if (
				hasValidateOnlyParam(params) &&
				(action === 'create' || action === 'createAll' || action === 'update' || action === 'updateAll')
			) {
				return;
			}

			switch(action) {
				case 'get':
					// so that data coming from `read` event
					// will always be an array, regardless of
					// whether the originating request was a get or query
					pluginArgs[1] = [resourceData];
					args[2] = [resourceData];
					break;
				case 'create':
					pluginArgs.splice(2, 0, true); // add created = true
					break;
				case 'update':
					pluginArgs.splice(2, 0, false); // add created = false
					break;
				case 'updateAll':
				case 'delete':
				case 'deleteAll':
					// API only returns a 200 status code,
					// so dont return payload
					pluginArgs.splice(1, 1);
					args.pop();
					break;
				default:
					break;
			}

			//PluginEvents.$broadcast.apply(PluginEvents, pluginArgs);
			$rootScope.$broadcast.apply($rootScope, args);

		}

		function Request(resource, name, action, params, data, success, error) {
			var _self = this;
			if(typeof params === 'function') {
				error = data;
				success = params;
				data = {};
				params = {};
			} else if(typeof data === 'function') {
				error = success;
				success = data;
				data = {};
			}
			this.resource = resource;
			this.action = action;
			this.params = params;
			this.data = data;
			this.success = success;
			this.error = error;
			this.deferred = $q.defer();
			this.execute = function() {
				_self.params = params = beforeFilter(params);
				var requestStartTime = new Date().getTime();
				var defaultVal = action === 'query' ? [] : null,
					successFn = function(resp, headers) {
						
						var resourceData = defaultVal;

						if (angular.isArray(resp)) {
							resourceData = JSON.parse(angular.toJson(resp));
						}

						if (resp.data) {
							resourceData = resp.data;
						}

						// Currently the API return an array with IDs but as string
						// instead of update the API for now we are type casting in here
						// for plugins and this will be fixed in a future upgrade of the API
						if (action === 'createAll') {
							var ids = [];
							angular.forEach(resourceData, function(data, idx) {
								ids.push(parseInt(data, 10));
							});
							resourceData = ids;
						}

						// Filter out `access_token` on `updateAll` and `deleteAll`
						if (action === 'updateAll' || action === 'deleteAll' && params.access_token) {
							delete params.access_token;
						}

						broadcastResourceSuccess(name, resourceData, action, params);

						if(typeof success === 'function') {
							success(resourceData, {
								status:resp.status,
								code:resp.code,
								totalCount:resp.totalCount,
								limit:resp.limit,
								offset:resp.offset
							}, headers);
						}
						_self.deferred.resolve(resourceData);
					},
					errorFn = function(resp) {
						var elapsedTime = new Date().getTime() - requestStartTime;

						if (resp.redirect) {
							window.location.href = resp.redirect;
						} else if (!params.lastTry && (
							(resp.status === 0 && elapsedTime < retryTimeout) ||
							resp.status === 401))
						{
							params.lastTry = true;
							Auth.refresh(_self);
						} else {

							if (resp.status === 429 && !hasValidateOnlyParam(params)) {
							//	sharedMessages.rateLimitExceeded(pluginData);
							}

							if (params.lastType) {
								delete params.lastTry;
							}
							if (typeof error === 'function') {
								error(resp);
							}

							_self.deferred.reject(resp);
						}
					};
				if(action === 'get' || action === 'query') {
					resource[action](params, successFn, errorFn);
				} else {
					resource[action](params, data, successFn, errorFn);
				}
				return _self.deferred.promise;
			};
		}

		function request(resource, name, action, params, data, success, error) {
			var req = new Request(resource, name, action, params, data, success, error);
			if (Auth.refreshing) {
				req.deferred = $q.defer();
				Auth.queue(req);
				return req.deferred.promise;
			}
			return req.execute();
		}

		/**
		 * Response transform function - fills in empty 'data' array if none is present,
		 * for instances where API returns a response without data
		 *
		 * @param	{object} data
		 * @param	{function} headersGetter
		 * @returns	{array}
		 *
		 * @author	Paul W. Smith <paul@wizehive.com>
		 * @since	0.5.29
		 */
		function saveArrayResponseTransform(data, headersGetter) {
			var response = angular.fromJson(data);
			if (angular.isDefined(response.data)) {
				return response.data;
			} else {
				return response;
			}
		}

		/**
		 * Build a $resource object for an API endpoint
		 *
		 * @param	string		path
		 * @param	[string]	idField
		 * @param	object		options - multi, objectVersion
		 * @author	Unknown
		 * @since	0.5.x
		 */
		function resource(name, path, idField, options) {
			// Note - null return from any header function causes that header to be removed from the request
			var defaultHeaders = {
				'Authorization': function() {
					return (parent.window.wizehive.token() && 'Bearer ' + parent.window.wizehive.token()) || null;
				},
				'X-User-ID': function() {
					return ($rootScope.user && $rootScope.user.id) || null;
				},
				'X-Plugin': function() {
					return pluginData || null;
				}
			};

			var actions = {
				get: {headers: defaultHeaders},
				query: {method: 'GET', headers: defaultHeaders}, // override sets isArray to false
				create: {method: 'POST', headers: defaultHeaders},
				update: {method: 'PUT', headers: defaultHeaders},
				'delete': {method: 'DELETE', headers: defaultHeaders},
				remove: {method: 'DELETE', headers: defaultHeaders},
				createAll: {method: 'POST', isArray: true, transformResponse: saveArrayResponseTransform, headers: defaultHeaders},
				updateAll: {method: 'PUT', headers: defaultHeaders},
				deleteAll: {method: 'DELETE', headers: defaultHeaders}
			};

			// Transform multipart form data for file uploads
			if (options && options.multipart === true) {
				actions.create.headers['Content-Type'] = actions.update.headers['Content-Type'] = undefined;
				actions.create.transformRequest = actions.update.transformRequest = function (data) {
					var fd = new FormData();
					angular.forEach(data, function (value, key) {
						fd.append(key, value);
					});
					return fd;
				};
			}

			// Set up ObjectVersion / If-Match header checking if enabled for this resource - workaround
			// for lack of proper request header support in $resource
			if (options && options.objectVersionField) {
				var currentObjectVersion = null; // To be updated by save function

				// Set X-If-ObjectVersion-Matches header to a copy of currentObjectVersion
				actions.update.headers['X-If-ObjectVersion-Matches'] = function() {
					return currentObjectVersion;
				};
			}

			idField = idField || 'id';

			// Remove ID param from `query` path, Use `query` for `index` and `get` for `view`
			if (path.substring(path.length-idField.length-1) == ':' + idField) {
				actions.query.url = _apiBaseUrl + path.substring(0, path.length-idField.length-1);
			}

			var regex = new RegExp(':([a-z]+)', 'ig');
			var pathParams = path.match(regex);
			
			var rsource = $resource(_apiBaseUrl + path, {}, actions);

			var save = function(params, data, success, error) {
					
					if (typeof data === 'function') {
						error = success;
						success = data;
						data = params;
						params = {};
					} else if (typeof data === 'undefined') {
						data = params;
						params = {};
					}

					// These query params names will be used to check whether or not params as field attributes
					// if true will use `update` action rather then `create`.
					var updateActionWhitelist = ['timezone', 'limit', 'sort', 'page', 'direction', 'access_token', 'validate_only'];

					// Set whether it's an update or create
					var action = 'create';
					
					var idFieldValue = params[idField] || data[idField];

					var isMultiIdField = ('string' === typeof idFieldValue && idFieldValue.indexOf('|') !== -1);

					var hasBatchConditions = false;

					if (idFieldValue) {
						
						action = 'update';
						
						if (isMultiIdField) {
							actions.updateAll.url = _apiBaseUrl + path.substring(0, path.length-idField.length-1);
						}

					} else if (params) {
						
						angular.forEach(params, function(value, key) {
							if (updateActionWhitelist.indexOf(key) === -1 && pathParams.indexOf(':' + key) === -1) {
								hasBatchConditions = true;
							}
						});
						
						if (hasBatchConditions) {
							action = 'update';
						}

					}

					// Set wheter it's a bulk or single operation
					if (angular.isArray(data) || isMultiIdField || hasBatchConditions) {
						action += 'All';
					}

					// I think this logic is faulty...
					if (action === 'update' && typeof params[idField] === 'undefined') {
						params[idField] = data[idField];
					}

					if (action === 'update' && options && options.objectVersionField && params[options.objectVersionField]) {
						// Set currentObjectVersion to be used for headers, and remove from query params
						currentObjectVersion = params[options.objectVersionField];
						delete params[options.objectVersionField];
					}

					var returnValue = request(rsource, name, action, params, data, success, error);
					
					// Clear currentObjectVersion if it has been set before returning so it doesn't affect any other requests
					currentObjectVersion = null;
					
					return returnValue;

				};

			return {
				'get': request.curry(rsource, name, 'get'),
				query: request.curry(rsource, name, 'query'),
				update: request.curry(rsource, name, 'update'),
				updateAll: save,
				save: save,
				saveAll: save,
				'delete': request.curry(rsource, name, 'delete'),
				deleteAll: function(params, success, error) {
					actions.deleteAll.url = _apiBaseUrl + path.substring(0, path.length-idField.length-1);
					return request(rsource, name, 'deleteAll', params, success, error);
				},
				del: request.curry(rsource, name, 'delete'),
				remove: request.curry(rsource, name, 'remove')
			};
		}

		/**
		 * Throw an error when an unsupported method on a particular resource is called
		 *
		 * @param	{string}	method - method name
		 * @returns	{function}
		 *
		 * @author	Paul W. Smith <paul@wizehive.com>
		 * @since	0.5.51
		 */
		function unsupportedMethod(method) {
			return function() {
				throw new Error('Method "' + method + '" is not supported by this resource');
			};
		}

		var _resources = {
			Activities: ['/activities/:id'],
			AppTemplates: ['/app_templates/:id'],
			AppTemplateInstallJobs: ['/app_template_install_jobs/:id'],
			Calculate: (function() {
				var _resource = resource('Calculate', '/calculate');
				var ret = {};
				// query uses POST to send request to API
				ret.query = function(params, success, error) {
					return _resource.save({}, params, success, error);
				};
				// No other methods supported for this verb endpoint
				for (var method in _resource) {
					ret[method] = ret[method] || unsupportedMethod(method);
				}
				
				return ret;
			})(),
			CalculationSettings: ['/calculation_settings/:id'],
			DataViews: ['/data_views/:id'],
			Events: ['/events/:id'],
			Files: ['/files/:id'],
			Forms: ['/forms/:id'],
			DefaultFormPermissions: ['/forms/permissions'],
			FormRecordPermissions: ['/forms/:formId/records/permissions', 'formId'],
			FormFields: ['/forms/:formId/fields/:id'],
			FormFolders: ['/forms/:formId/folders/:id'],
			FormRecords: ['/forms/:formId/records/:id', null, {
				objectVersionField: 'objectVersion'
			}],
			FormUploads: ['/forms/:formId/uploads', null, {
				multipart: true
			}],
			FormFieldTaxonomy: ['/form_field_taxonomy'],
			RecordImportJobs: ['/record_import_jobs/:id'],
			RecordExportJobs: ['/record_export_jobs/:id', null],
			RecordImportFiles: ['/record_import_files/:id', null, {
				multipart: true
			}],
			Roles: ['/workspaces/:workspaceId/roles/:id'],
			Notes: ['/notes/:id'],
			NoteReplies: ['/notes/:noteId/replies/:id'],
			Notifications: ['/notifications/:id'],
			NotificationEmails: ['/notification_emails/:id'],
			Tasks: ['/tasks/:id'],
			TaskLists: ['/task_lists/:id'],
			TaskPriorities: ['/task_priorities'],
			TaskStatuses: ['/task_statuses'],
			Users: ['/users/:id'],
			TaskPreferences: ['/users/:userId/task_preferences', 'userId'],
			Webhooks: ['/webhooks/:id'],
			ScheduledWebhooks: ['/scheduled_webhooks/:id'],
			WebhookEvents: ['/webhook_events/:id'],
			Workspaces: ['/workspaces/:id'],
			WorkspaceInvitees: ['/workspaces/:workspaceId/invitees/:id'],
			WorkspaceMembers: ['/workspaces/:workspaceId/members/:id'],
			WorkspaceTransferRequests: ['/workspaces/:workspaceId/transfer_requests/:id'],
			WorkspaceTaskPreferences: ['/workspaces/:workspaceId/members/:memberId/task_preferences', 'memberId'],
			WorkspaceLogo: ['/workspaces/:workspaceId/logo', null, {
				multipart: true
			}],
			WorkspaceCopyJobs: ['/workspace_copy_jobs'],
			Countries: ['/countries'],
			States: ['/states'],
			Subscriptions: ['/subscriptions/:id'],
			Plugins: ['/plugins/:id', null, {
				objectVersionField: 'objectVersion'
			}],
			PluginScreenshots: ['/plugins/:pluginId/screenshots'],
			PluginServices: ['/plugins/:pluginId/services/:id'],
			PluginServiceUploads: ['/plugins/:pluginId/services/:serviceId/uploads', null, {
				multipart: true
			}],
			WorkspacePluginLinks: ['/workspace_plugin_links/:id']
		};

		var _data = function(name) {
			if(!(name in _resources)) {
				throw new Error("Resource '" + name + "' doesn't exist.");
			}

			if (name === 'Calculate') {
				return _resources[name];
			}

			var args = _resources[name];
			// add resource name to list of arguments if not already present
			if (args[0] !== name) {
				args.unshift(name);
			}

			return resource.apply(this, args);
		};
		_data.queue = function(items) {
			var promise = $q.all(items);
			return {
				done: function(callback) {
					if(typeof callback === 'function') {
						promise.then(function(args) {
							callback.apply(promise, args);
						});
					}
				}
			};
		};
		return _data;
	};
}])
.factory('Data', ['DataFactory', function(DataFactory) {

	// Create a default data factory with no plugin data, for regular app use
	return DataFactory(null);
	
}])
/**
 * Plugin Data Factory
 *
 * @author	Wes DeMoney <wes@wizehive.com>
 * @since	0.5.62
 */
.factory('PluginDataFactory', ['$rootScope', '$http', '$q', 'PluginModel', function($rootScope, $http, $q, PluginModel) {

	return function(data) {

		var pluginData = data || null;

		var _pluginsBaseUrl = wizehive.config('constants').PLUGINS_URL || '';
		
		// originated from: https://gist.github.com/penguinboy/762197
		function _flattenObject(ob) {
			var toReturn = {};

			for (var i in ob) {
				if (!ob.hasOwnProperty(i)) continue;
				if ((typeof ob[i]) == 'object') {
					if (ob[i] instanceof Array) {
						toReturn[i] = ob[i].join(',');
					} else {
						var flatObject = _flattenObject(ob[i]);
						for (var x in flatObject) {
							if (!flatObject.hasOwnProperty(x)) continue;
							toReturn[i + '.' + x] = flatObject[x];
						}
					}
				} else {
					toReturn[i] = ob[i];
				}
			}
			return toReturn;
		}

		function beforeFilter(params, namespace) {
			
			// Allowed params
			var whitelist = ['params', 'headers'],
				tmp = {};
			
			// Filter params by whitelist
			angular.forEach(whitelist, function(key) {
				tmp[key] = _flattenObject(params[key]);
			});

			// Note - null return from any header function causes that header to be removed from the request
			var defaultHeaders = {
				'Authorization': function() {
					return (parent.window.wizehive.token() && 'Bearer ' + parent.window.wizehive.token()) || null;
				},
				'X-User-ID': function() {
					return ($rootScope.user && $rootScope.user.id) || null;
				},
				'X-Plugin': function() {
					return pluginData || null;
				},
				'X-Plugin-Draft': function() {
					if (PluginModel.data &&
						PluginModel.data.namespace &&
						PluginModel.data.namespace == data &&
						data == namespace) {
						return parent.window.wizehive.token() || null;
					}
					return null;
				}
			};

			tmp.headers = angular.extend({}, defaultHeaders, tmp.headers);
			
			return tmp;
		}
		
		function displayDebugInfo(headers) {

			var headersToDisplay = {
				'X-Plugin-Log': {
					format: function(header) {
						return atob(header);
					},
					type: 'log'
				},
				'X-Plugin-Error': {
					format: function(header) {

						var obj = JSON.parse(header);

						if (obj && obj.errorType && obj.errorMessage && obj.stackTrace) {

							return 'Uncaught ' + obj.errorType + ': ' + obj.errorMessage + '\n' +
									obj.stackTrace.join('\n');

						}

						return header;
					},
					type: 'error'
				}
			};

			if (!headers) {
				return;
			}

			angular.forEach(headersToDisplay, function(options, name) {

				var header = headers(name);

				if (header) {
					var method = options.type || 'log';

					console[method](name + ':\n\n' + options.format(header));
				}
			});

		}

		function Request(endpoint, action, params, data, success, error, namespace) {
			
			// Params are required for workspaceId, so only data is optional
			if (typeof data === 'function') {
				error = success;
				success = data;
				data = {};
			}
			
			params = beforeFilter(params, namespace);
			var args = [endpoint];

			// `data` comes before `params` for POST and PUT
			if (action === 'post' || action === 'put') {
				args.push(data);
			}
			
			args.push(params);
			
			var deferred = $q.defer();

			$http[action].apply(this, args)
				.success(function(data, status, headers) {
					if (typeof success === 'function') {
						success(data, status, headers);
					}
					displayDebugInfo(headers);
					deferred.resolve(data);
				})
				.error(function(data, status, headers) {
					if (typeof error === 'function') {
						error(data, status, headers);
					}
					displayDebugInfo(headers);
					deferred.reject(data);
				});
		
			return deferred.promise;
			
		}
		
		return function(namespace) {
			
			function endpoint(route, params) {
				if (!params.workspaceId) {
					return false;
				}
				return _pluginsBaseUrl + '/workspaces/' + params.workspaceId + '/' + namespace + route;
			}
			
			function request(action, route, params, data, success, error) {				
				var url = endpoint(route, params);
				if (!url) {
					return false;
				}
				return Request(url, action, params, data, success, error, namespace);
			}
			
			return {
				get: request.curry('get'),
				post: request.curry('post'),
				put: request.curry('put'),
				delete: request.curry('delete')
			};
			
		};

	};
}])
.factory('znPluginData', ['PluginDataFactory', function(PluginDataFactory) {

	// Create a default data factory with no plugin data, for regular app use
	return PluginDataFactory(null);
	
}]);
