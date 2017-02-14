'use strict';

var fs = require('fs');
var url = require('url');
var util = require('util');
var http = require('http');
var querystring = require('querystring');
var redis = require('redis');
var moment = require('moment');

var config = require('./config');
var proxyConfig = require('./proxy_config');
var cache = require('./cache');
var request = require('request');

var headerObj = {};

// Connect redis
var redisOpts = config.redis.password ? {
	auth_pass: config.redis.password
} : {};
var redisClient = redis.createClient(config.redis.port, config.redis.host, redisOpts);
redisClient.on('ready', function(res) {
	console.log('Connect redis server ' + config.redis.host + ':' + config.redis.port + ' is ready.');
});
redisClient.on('error', function(error) {
	console.log(error);
	process.exit(1);
});

function findRealUrl(pathname) {
	var loopFind = (path) => {
		if (path == '')
			return null;
		return proxyConfig.list_maps[path] ? {
			key: path,
			value: proxyConfig.list_maps[path]
		} : loopFind(path.substr('0', path.lastIndexOf('/')))
	}
	var result = loopFind(pathname);
	if (result) {
		if (result.value.substr(0, 4) == 'http') {
			return result.value + pathname.substr(result.key.length, pathname.length - result.key.length);
		} else {
			return proxyConfig.default_server + result.value + pathname.substr(result.key.length, pathname.length - result.key.length);
		}
	} else {
		return proxyConfig.forward_rule == 'all' ? proxyConfig.default_server + pathname : null;
	}
}

function findCacheTime(pathname) {
	var loopFind = (path) => {
		if (path == '')
			return -1;
		return proxyConfig.cache_times[path] ? {
			key: path,
			value: proxyConfig.cache_times[path]
		} : loopFind(path.substr('0', path.lastIndexOf('/')))
	}
	var result = loopFind(pathname);
	if (result != -1) {
		return result.value;
	} else {
		return proxyConfig.default_cache_time;
	}
}

// Return the favicon image
function faviconHandler(req, res) {
	res.setHeader('Content-Type', 'image/x-icon');
	var content = fs.readFileSync('favicon.ico', 'binary');
	res.writeHead(200, 'Ok');
	res.write(content, 'binary');
	res.end();
}

// Handle get requests
function handler(req, res) {
	if (req.url == '/favicon.ico') {
		faviconHandler(req, res);
		return;
	}
	var paramsData = '';
	var pathinfo = url.parse(req.url, true);
	var realUrl = findRealUrl(pathinfo.pathname);
	var cacheTime = findCacheTime(pathinfo.pathname);
	if (!realUrl) {
		console.log('[' + moment(new Date()).format('YYYY-MM-DD HH:mm:ss') + '] $' + req.method 
			+ ' ' + pathinfo.pathname + (['POST', 'PUT'].indexOf(req.method) == -1 ? pathinfo.search : '') + ' [404]');
		res.writeHead(404, {
			'Content-type': 'text/html'
		});
		res.end(proxyConfig.not_found);
		return;
	}

	var sendData = function(headers, data) {
		for (var i in proxyConfig.headers) {
			headers[i] = proxyConfig.headers[i];
		}

		res.writeHead(200, headers);
		res.write(data);
		res.end();
	}

	//Read redis first, if there is cache data, directly from the redis Lane
	var procLogic = function() {
		cache.get(redisClient, realUrl, [pathinfo.search, 'headers'], function(data) {
			if (data[0] != null) {
				console.log('[' + moment(new Date()).format('YYYY-MM-DD HH:mm:ss') + '] $' + req.method 
					+ ' ' + pathinfo.pathname + pathinfo.search + ' => ' + realUrl + pathinfo.search + ' [from cache]');
				try {
					headerObj = JSON.parse(data[1]);
				} catch (err) {
					headerObj = {};
				}
				sendData(headerObj, data[0]);
			} else {
				console.log('[' + moment(new Date()).format('YYYY-MM-DD HH:mm:ss') + '] $' + req.method 
					+ ' ' + pathinfo.pathname + pathinfo.search + ' => ' + realUrl + pathinfo.search + ' [from server]');
				delete req.headers.host;
				delete req.headers['upgrade-insecure-requests'];
				delete req.headers['if-none-match'];

				var requestCallback = (error, response, data) => {
					if (error) {
						res.writeHead(408, 'Request Timeout');
						res.end('408/Request Timeout');
						return;
					}

					// set cache
					if (cacheTime > 0 && req.method == 'GET' && proxyConfig.cacheMimes.indexOf(response.headers['content-type']) != -1) {
						cache.set(redisClient, realUrl, [pathinfo.search, data, 'headers', JSON.stringify(response.headers)], cacheTime);
					}
				}

				var reqOpts = {
					method: req.method,
					headers: req.headers,
					url: realUrl + pathinfo.search
				};
				if (['POST', 'PUT'].indexOf(req.method) != -1) {
					reqOpts.body = paramsData;
				}

				request(reqOpts, requestCallback).pipe(res);
			}
		});
	}

	switch (req.method) {
		case 'GET':
			procLogic();
			break;
		case 'DELETE':
			procLogic();
			break;
		case 'POST':
			req.on('data', (chunk) => {
				paramsData += chunk;
			});
			req.on('end', () => {
				procLogic();
			});
			break;
		case 'PUT':
			req.on('data', (chunk) => {
				paramsData += chunk;
			});
			req.on('end', () => {
				procLogic();
			});
			break;
		default:
			console.log('[' + moment(new Date()).format('YYYY-MM-DD HH:mm:ss') + '] $' + req.method 
				+ ' ' + pathinfo.pathname + pathinfo.search + ' [404]');
			res.writeHead(404, {
				'Content-type': 'text/html'
			});
			res.end(proxyConfig.not_found);
	}
}

// Open the server, listening port
http.createServer((req, res) => {
	handler(req, res);
}).listen(config.port);
console.log('Server runing at port ' + config.port);
