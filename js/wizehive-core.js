/**
 * Wizehive core
 *
 * Copyright (c) WizeHive - http://www.wizehive.com
 *
 * @since 0.x.x
 */
var wizehive = {};

(function(wizehive, global) {
	Function.prototype.curry = Function.prototype.curry || function () {
		var fn = this, args = Array.prototype.slice.call(arguments);
		return function () {
			return fn.apply(this, args.concat(Array.prototype.slice.call(arguments)));
		};
	};

	// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/startsWith
	if (!String.prototype.startsWith) {
		String.prototype.startsWith = function(searchString, position){
			position = position || 0;
			return this.substr(position, searchString.length) === searchString;
		};
	}

	// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/endsWith
	if (!String.prototype.endsWith) {
		String.prototype.endsWith = function(searchString, position) {
			var subjectString = this.toString();
			if (typeof position !== 'number' || !isFinite(position) || Math.floor(position) !== position || position > subjectString.length) {
				position = subjectString.length;
			}
			position -= searchString.length;
			var lastIndex = subjectString.indexOf(searchString, position);
			return lastIndex !== -1 && lastIndex === position;
		};
	}

	String.prototype.splice = String.prototype.splice || function(idx, deleteCount, value) {
    	return (this.slice(0,idx) + value + this.slice(idx + Math.abs(deleteCount)));
	};

	wizehive.inArray = function(search, array) {
		if(array.indexOf) {
			return array.indexOf(search) > -1;
		}
		var i = 0, len = array.length, idx = -1;
		for(; i<len; i++) {
			if(array[i] === search) {
				idx = i;
				break;
			}
		}
		return idx > -1;
	};

	/**
	 * Unique id generator
	 * From http://stackoverflow.com/a/105074
	 *
	 * @since	0.5.51
	 */
	wizehive.guid = (function () {
	   function s4() {
		   return Math.floor((1 + Math.random()) * 0x10000)
				   .toString(16)
				   .substring(1);
	   }
	   return function () {
		   return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
				   s4() + '-' + s4() + s4() + s4();
	   };
	})();

	wizehive.toKeyValue = toKeyValue;
	wizehive.parseKeyValue = parseKeyValue;

	/**
	 * This method is intended for encoding *key* or *value* parts of query component. We need a custom
	 * method becuase encodeURIComponent is too agressive and encodes stuff that doesn't have to be
	 * encoded per http://tools.ietf.org/html/rfc3986:
	 *    query       = *( pchar / "/" / "?" )
	 *    pchar         = unreserved / pct-encoded / sub-delims / ":" / "@"
	 *    unreserved    = ALPHA / DIGIT / "-" / "." / "_" / "~"
	 *    pct-encoded   = "%" HEXDIG HEXDIG
	 *    sub-delims    = "!" / "$" / "&" / "'" / "(" / ")"
	 *                     / "*" / "+" / "," / ";" / "="
	 */
	function encodeUriQuery(val, pctEncodeSpaces) {
		return encodeURIComponent(val).
			replace(/%40/gi, '@').
			replace(/%3A/gi, ':').
			replace(/%24/g, '$').
			replace(/%2C/gi, ',').
			replace((pctEncodeSpaces ? null : /%20/g), '+');
	}
	
	/**
	 * Parses an escaped url query string into key-value pairs.
	 * @returns Object.<(string|boolean)>
	 */
	function parseKeyValue(/**string*/keyValue) {
		var obj = {}, key_value, key;
		angular.forEach((keyValue || "").split('&'), function(keyValue){
			if (keyValue) {
				key_value = keyValue.split('=');
				key = decodeURIComponent(key_value[0]);
				obj[key] = angular.isDefined(key_value[1]) ? decodeURIComponent(key_value[1]) : true;
			}
		});
		return obj;
	}

	function toKeyValue(obj) {
		var parts = [];
		angular.forEach(obj, function(value, key) {
			parts.push(encodeUriQuery(key, true) + (value === true ? '' : '=' + encodeUriQuery(value, true)));
		});
		return parts.length ? parts.join('&') : '';
	}
	
	wizehive.snake_case = snake_case;
	// Copied from angularjs source
	var SNAKE_CASE_REGEXP = /[A-Z]/g;
	function snake_case(name, separator) {
		separator = separator || '_';
		return name.replace(SNAKE_CASE_REGEXP, function(letter, pos) {
			return (pos ? separator : '') + letter.toLowerCase();
		});
	}
	
	wizehive.camelCase = camelCase;
	// Copied from angularjs source
	var SPECIAL_CHARS_REGEXP = /([\:\-\_]+(.))/g;
	var MOZ_HACK_REGEXP = /^moz([A-Z])/;
	var PREFIX_REGEXP = /^(x[\:\-_]|data[\:\-_])/i;

	/**
	 * Converts snake_case to camelCase.
	 * Also there is special case for Moz prefix starting with upper case letter.
	 * @param name Name to normalize
	 */
	function camelCase(name, capFirst) {

		if(capFirst) {
			name = '-' + name;
		}

		return name.
			replace(SPECIAL_CHARS_REGEXP, function(_, separator, letter, offset) {
				return (offset || capFirst)? letter.toUpperCase() : letter;
			}).
			replace(MOZ_HACK_REGEXP, 'Moz$1');
	}

	wizehive.serializeError = serializeError;
	
	function serializeError (error) {
		var errorMessages = {};
		var p, x;
		for(var i in error) {
			if(error.hasOwnProperty(i)) {
				if(!angular.isObject(error[i]) || angular.isArray(error[i])) {
					errorMessages[i] = error[i];
				} else {
					p = serializeError(error[i]);
					for(x in p) {
						if(p.hasOwnProperty(x)) {
							errorMessages[i + '.' + x] = p[x];
						}
					}
				}
			}
		}
		return errorMessages;
	}
	
	function applyError (form, formElement, error) {
		var serialized = serializeError(error);
	}

	function copy(dest, src) {
		for(var p in src) {
			if(src.hasOwnProperty(p)) {
				if(Array.isArray(src[p])) {
					var i = 0, len = src[p].length, a = [];
					for(; i < len; i++) {
						if(typeof src[p][i] === 'object') {
							a.push(copy({}, src[p][i]));
						} else {
							a.push(src[p][i]);
						}
						dest[p] = a;
					}
				}
				else if(typeof src[p] === 'object') {
					dest[p] = copy({}, src[p]);
				} else {
					dest[p] = src[p];
				}
			}
		}
		return dest;
	}

	var _config = copy({
		debug: false,
		constants: {
			S3_URL: 'wizehive-uploads',
			S3_IMG_URL: 'wizehive-imgs',
			WEBFORMS_URL: 'http://webforms.wizehive.com/'
		}
	}, global.wizehiveConfig);

	_config.filterOperators = [
				{
					bit:1,
					label:'Is',
					value:''
				},
				{
					bit:2,
					label:'Isn\'t',
					value:'not'
				},
				{
					bit:4,
					label:'Contains',
					value:'contains'
				},
				{
					bit:8,
					label:'Starts with',
					value:'starts-with'
				},
				{
					bit:16,
					label:'Ends with',
					value:'ends-with'
				},
				{
					bit:32,
					label:'Greater than',
					value:'min'
				},
				{
					bit:64,
					label:'Less than',
					value:'max'
				},
				{
					bit:128,
					label:'Since',
					value:'min'
				},
				{
					bit:256,
					label:'Before',
					value:'max'
				}
			];
			
	wizehive.config = function(name, val) {
		if(typeof val !== 'undefined') {
			_config[name] = val;
			return wizehive;
		}
		return _config[name];
	};
	if(global.wizehiveConfig) {
		global.wizehiveConfig = null;
		delete global.wizehiveConfig;
	}
	
	var options = {};
	function option(key, value) {
		if(value) {
			options[key] = value;
			return wizehive;
		}
		return options[key];
	}
	
	wizehive.token = option.curry('api_token');
	wizehive.tokenExpires = option.curry('api_token_expires');
	wizehive.serverTime = option.curry('server_time');
	
	wizehive.adjustTokenExpiration = function() {
		var expires = wizehive.tokenExpires(),
			serverTime = wizehive.serverTime(),
			localTime = new Date().getTime(),
			offset = localTime - serverTime,
			adjustedExpiration = expires + offset;
		
		wizehive.tokenExpires(adjustedExpiration);
	};
	
})(wizehive, window);
