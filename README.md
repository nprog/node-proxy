node-proxy - node.js反向代理缓存服务器
===========================

* 实现GET/POST/PUT/DELETE等请求的反响代理
* 实现接口映射功能，可以隐藏后端服务器等真实接口地址
* 用redis HashMap实现GET请求的缓存，可以单独配置每个地址的缓存时间，已适用不同接口对更新频率的需求

安装:

    git clone https://github.com/nprog/node-proxy
    cd node-proxy
    npm install
    node index.js

## 配置详解

### config.js

```js
'use strict';

module.exports = {
    // 服务监听端口
    port : 3000,

    // redis服务地址
    redis : {
        host : '127.0.0.1',
        port : 6379,
        password : ''
    },
    // 软件版本
    version : 0.1
}
```

### proxy_config.js

```js
'use strict';

var config = require('./config');

module.exports = {
    // 默认上层服务器地址
    // 如果在list_maps里找到的对应地址不包含服务器地址，那么就自动使用此服务器
    default_server : 'http://www.abc.com',

    // 默认缓存时间
    // 缓存时间单位为秒(second)
    // 如果在cache_times找不到接口相应的缓存配置，那么就自动使用此时间
    default_cache_time : 0,

    // 转发规则
    // map为只转发list_maps里已经配置的接口
    // all为转发所有接口
    forward_rule : 'all', // maps, all

    // 会自动透传上层服务器返回的header信息，同时会将在此设置的header合并返回给客户端
    // 如果和上层服务器返回的header有冲突，会优先覆盖
    headers : {
        'server' : 'node-proxy/' + config.version,
        'access-control-allow-origin' : '*',
        'access-control-allow-headers' : 'Origin, X-Requested-With, Content-Type, Accept, If-Modified-Since',
        'access-control-allow-credentials' : 'true',
    },

    // 访问不存在的接口返回信息
    not_found : '404/Page Not Found',

    // 接口映射表  左边访问地址 => 右边映射地址
    list_maps : {
        '/addr1' : '/realpath/path1',
        '/addr2' : 'http://www.def.com/realpath/path2',
    },

    // 接口缓存时间 左边访问地址 => 右边为该地址数据缓存时间
    cache_times : {
        '/addr1' : 60,
        '/addr2' : 600,
    }
}
```
