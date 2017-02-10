'use strict';

//set cache
exports.set = function(redisClient, key, dataArr, time) {
	redisClient.hmset(key, dataArr);
	redisClient.expire(key, time);
}

//get cache
exports.get = function(redisClient, key, keyArr, callback) {
	redisClient.send_command('hmget', [key, ...keyArr], function(err, replies) {
		callback(replies || null);
	});
}

//del cache
exports.del = function(redisClient, key) {
	redisClient.del(key);
}