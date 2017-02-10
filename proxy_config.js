'use strict';

var config = require('./config');

module.exports = {
	default_server : 'http://www.abc.com',
	default_cache_time : 0,
	forward_rule : 'all', // maps, all
	headers : {
		'server' : 'node-proxy/' + config.version,
		'access-control-allow-origin' : '*',
		'access-control-allow-headers' : 'Origin, X-Requested-With, Content-Type, Accept, If-Modified-Since',
		'access-control-allow-credentials' : 'true',
	},
	not_found : '404/Page Not Found',
	list_maps : {
		'/addr1' : '/realpath/path1',
		'/addr2' : 'http://www.def.com/realpath/path2',
	},
	cache_times : {
		'/addr1' : 60,
		'/addr2' : 600,
	}
}