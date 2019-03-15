'use strict';

const express = require('express');
const http = require('http');
var jade = require('jade');
var promise = require('promise');
var redis = require('ioredis');
var redisconfig = {
	port:process.env.REDIS_PORT,
	host:process.env.REDIS_HOST
}
var isfargate = process.env.ISFARGATE;

// Constants
const APIVERSION = 11;
const SVCPATH = "10001";
const PORT = 8080;
const DOCKERIP = "192.168.99.100";
var METASVCMOCK = {
  host: 'localhost', //'169.254.169.254',
  port: 8080
}
var METASVC = {
  host: '169.254.169.254', //'169.254.169.254',
  port: 80
}
var htmlbody = "aws elasticbeanstalk demo @ ";

var optionsinstance = {
  name: 'instance-id',
  host: METASVC.host,
  port: METASVC.port,
  path: '/latest/meta-data/instance-id',
  method: 'GET'
};

var optionszone = {
  name: 'availability-zone',
  host: METASVC.host,
  port: METASVC.port,
  path: '/latest/meta-data//placement/availability-zone',
  method: 'GET'
};
// App

function getMetaData(options){
    return new Promise(function(resolve, reject){
      http.request(options, function(r) {
        console.log('STATUS: ' + r.statusCode);
        console.log('HEADERS: ' + JSON.stringify(r.headers));
        r.setEncoding('utf8');
        r.on('data', function (data) {
          console.log('BODY: ' + data);
          var result = {};
          result[options.name] = data;
          resolve(result);
        });
      }).on('error', function(e) {
          console.log("error: " + e.message);
          reject(e);
      }).end();
    })
}

function getNextId(){
  console.log("getNextId");
  return new Promise(function(resolve, reject){
		console.log("PORT:" + redisconfig.port)
		console.log("PORT:" + redisconfig.host)
    var rc = new redis(redisconfig.port, redisconfig.host); //redis.createClient(redisconfig.port, redisconfig.host);
		rc.on("error", function(err) {
		  console.error("Error connecting to redis", err);
			rc.quit();
			resolve({nextid:-1});

		});
    rc.on('connect', function() {
        console.log('connected');
    		rc.incr( SVCPATH + ':nextid'  , function( err, id ) {
    				console.log(id);
            resolve({nextid:id});
            rc.quit();
        } );
    });
  })
}

const app = express();
app.use('/' + SVCPATH + '/', express.static(__dirname + '/public'));
app.get('/', function (req, res) {
	var html = SVCPATH;
	res.write(html);
	res.send();
});
app.get('/' + SVCPATH + '/api/fn/', function (req, res) {
	var object = {
		id:1,
		type: SVCPATH,
		version: APIVERSION,
		eventtimestamp:Date.now()
	}
	res.type('json');
	res.json(object);
});
app.get('/' + SVCPATH + '/api/shops/', function (req, res) {
	res.type('json');
	res.json({
	    "Shops":[
	        {
	            "ShopName":"HSBC ATM",
	            "Location":"Terminal 1",
	            "Category":"BankingServices"
	        },
	        {
	            "ShopName":"Starbucks",
	            "Location":"Terminal 2",
	            "Category":"FoodAndBeverages"
	        },
	        {
	            "ShopName":"7-11 Convenience Store",
	            "Location":"Terminal 1",
	            "Category":"ConvenienceStore"
	        }
	    ]
	 });
});
app.get('/' + SVCPATH + '/', function (req, res) {
  console.log(req.headers.host);
  var islocal = req.headers.host.indexOf("localhost") >= 0 || req.headers.host.indexOf("127.0.0.1") >= 0 ;
  if(islocal){
    optionsinstance.host = METASVCMOCK.host;
    optionsinstance.port = METASVCMOCK.port;
    optionszone.host = METASVCMOCK.host;
    optionszone.port = METASVCMOCK.port;
  }

  var metaDataPromises = isfargate ? [getNextId()] : [getMetaData(optionsinstance), getMetaData(optionszone),getNextId()];
  Promise.all(metaDataPromises).then(function(data){
    console.log(data) // logs ['dog1.png', 'dog2.png']
    var fn = jade.compileFile('template.jade');
    var result = {
      maintainer : {
        "instanceid":"",
        "availabilityzone":"",
        "nextid":""
      }
    };
    data.forEach(function(item,index){
        console.log(item);
        if(item["instance-id"])
          result.maintainer.instanceid = item["instance-id"];
        if(item["availability-zone"]){
          result.maintainer.availabilityzone = item["availability-zone"];
					result.showaza = item["availability-zone"].indexOf("localhost")>-1 || item["availability-zone"].indexOf("-2a")>-1 ? true : false;
					result.showazb = item["availability-zone"].indexOf("-2b")>-1 ? true : false;
				}
        if(item["nextid"])
          result.maintainer.nextid = item["nextid"];

      }
    )
		if(isfargate)
		{
			result.showaza = true;
			result.showazb = false;
			result.maintainer.computemode = "ecs-fargate";
		}
		else if(islocal)
			result.maintainer.computemode = "localhost";
		else if(result.maintainer.instanceid)
				result.maintainer.computemode = "ecs-ec2";

    var html = fn(result);
    res.write(html);
    res.send();
  }).catch(function(err){ // if any image fails to load, then() is skipped and catch is called
    console.log(err) // returns array of images that failed to load
    res.write(err);
    res.send();
  });
});

app.get('/latest/meta-data/instance-id', function (req, res) {
  res.write( "localhost");
  res.send();
});
app.get('/latest/meta-data//placement/availability-zone', function (req, res) {
  res.write( "localhost");
  res.send();
});

app.listen(process.env.PORT || PORT);
console.log('Running on http://localhost:' + PORT);
