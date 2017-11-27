var express = require('express');
var session = require('cookie-session');
var bodyParser = require('body-parser');
var fileUpload = require('express-fileupload');
var app = express();


var http = require('http');
var url  = require('url');
var MongoClient = require('mongodb').MongoClient; 
var assert = require('assert');
var ObjectId = require('mongodb').ObjectID;
var mongourl = 'mongodb://home:123321@ds131878.mlab.com:31878/project';

var SECRETKEY1 = 'I want to pass COMPS381F';
var SECRETKEY2 = 'Keep this to yourself';

app.set('view engine','ejs');
app.use(fileUpload());
app.use(session({
  name: 'session',
  keys: [SECRETKEY1,SECRETKEY2]
}));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static('public'));

app.get('/',function(req,res,next) {
	console.log(req.session);
	if (!req.session.authenticated) {
		res.status(200);
		res.render('login');
	} else {
		res.redirect('/read');
	}
});

app.get('/login',function(req,res,next) {
	res.redirect('/');
});

app.post('/login',function(req,res,next) {
	//req.session = null;
	MongoClient.connect(mongourl, function(err, db) {
		assert.equal(err,null);
		console.log('Connected to MongoDB\n');
		findUserPw(db,function(users) {
			db.close();
			console.log('Disconnected MongoDB\n');
			if (users.length == 0) {
				console.log('Not found!');
				res.redirect('/');
			} else {
				//console.log(req.body);
				for (var i=0; i<users.length; i++) {
					if (users[i].userid == req.body.id &&
		    	users[i].password == req.body.password) {
						req.session.authenticated = true;
						req.session.username = users[i].userid;
					}
				}
				res.redirect('/');
			}
		}); 
	});
});

app.get('/logout',function(req,res,next) {
	req.session = null;
	res.redirect('/');
});

app.get('/read',function(req,res,next) {
	if (!req.session.authenticated) {
		res.redirect('/');
	}else{
		MongoClient.connect(mongourl, function(err, db) {
			assert.equal(err,null);
			var criteria = req.query;
			var keys = [];
      var values = [];
      for (key in criteria){
      	keys.push(key);
        values.push(criteria[key]);
      }
			findRestaurants(db,criteria,function(restaurants) {
				db.close();
				console.log('Disconnected MongoDB\n');
				if (restaurants.length == 0) {
					res.status(200);
					res.render('read',{userid:req.session.username, restaurant_name:restaurants, key:keys, values:values});
				} else {
					//console.log(restaurants);
					res.status(200);
					res.render('read',{userid:req.session.username, restaurant_name:restaurants, key:keys, values:values});
				}
			}); 
		});
	}
});

app.get('/new',function(req,res,next){
	if (!req.session.authenticated) {
		res.redirect('/');
	}else{
		res.status(200);
		res.render('new');
	}
});

app.post('/create',function(req,res,next){
	if (!req.session.authenticated) {
		res.redirect('/');
	}else{
		var fs = require('fs');
		new_r = {};
		new_r['restaurant_id'] = (req.body.restaurant_id) ? req.body.restaurant_id : null;
		new_r['name'] = (req.body.name) ? req.body.name : "";
		new_r['borough'] = (req.body.borough) ? req.body.borough : "";
		new_r['cuisine'] = (req.body.cuisine) ? req.body.cuisine : "";
		var address = {};
		address['street'] = (req.body.street) ? req.body.street : "";
		address['building'] = (req.body.building) ? req.body.building : "";
		address['zipcode'] = (req.body.zipcode) ? req.body.zipcode : "";
		var coord = [];
		(req.body.lon) ? coord.push(req.body.lon) : coord.push("");
		(req.body.lat) ? coord.push(req.body.lat) : coord.push("");
		address['coord'] = coord;
		new_r['address'] = address;
		//var grades = [];
		//if(fields.score) grades.push({"user":req.session.username,"score":fields.score});
		new_r['grades'] = [];
		new_r['owner'] = req.session.username;
		//if(fields.photo){
		if(req.files.photo){
			/*var d = new Date();
			let photo = req.files.photo;// Use the mv() method to place the file somewhere on your server
			photo.mv('./images/('+req.session.username+d.getTime()+')'+photo.name, function(err) {
				if (err)
					return res.status(500).send(err);
				console.log('File uploaded!');
			});*/
			new_r['mimetype'] = req.files.photo.mimetype;
			new_r['photo'] = req.files.photo.data.toString('base64');
			MongoClient.connect(mongourl, function(err, db) {
				assert.equal(null, err);
				insertDocument(db,new_r,function() {
					console.log('insert done!');
					db.close();
					res.redirect('/');
				});
			});
		}else{
			new_r['mimetype'] = "";
			new_r['photo'] = "";
			MongoClient.connect(mongourl, function(err, db) {
				assert.equal(null, err);
				insertDocument(db,new_r,function() {
					console.log('insert done!');
					db.close();
					res.redirect('/');
				});
			});
		}
	}
});

app.get('/display',function(req,res,next){
	if (!req.session.authenticated) {
		res.redirect('/');
	}else{
		var queryAsObject = req.query;
		//console.log(queryAsObject._id);
		if(queryAsObject._id){
			if(queryAsObject._id.length == 12 || queryAsObject._id.length == 24){
				displayRestaurant(res,queryAsObject._id);
			}else{
				res.status(500);
				res.render('error');
			}
		}else{
			res.redirect('/');
		}
	}
});

app.get('/gmap',function(req,res,next){
	if (!req.session.authenticated) {
		res.redirect('/');
	}else{
		res.status(200);
		res.render('gmap',{lat:req.query.lat,lon:req.query.lon,title:req.query.title});
	}
});

app.get('/rate',function(req,res,next){
	if (!req.session.authenticated) {
		res.redirect('/');
	}else{
		res.status(200);
		res.render('rate',{id:req.query._id});
	}
});

app.post('/rate',function(req,res,next){
	if (!req.session.authenticated) {
		res.redirect('/');
	}else{
		var update = {};
		var criteria = {};
		var push = {};
		id = req.body._id;
		criteria['_id'] = ObjectId(req.body._id);
		update['user'] = req.session.username;
		update['score'] = req.body.score;
		push['grades'] = update;
		console.log(criteria);
		MongoClient.connect(mongourl, function(err, db) {
			assert.equal(null, err);
			findR(db,criteria,function(restaurants) {
				db.close();
				console.log('Disconnected MongoDB\n');
				//console.log(restaurants[0].grades);
				if (restaurants[0].grades) {
					var check = false;
					var grade = restaurants[0].grades;
					for(i in grade){
							if (grade[i].user == req.session.username){
								check = true;
								break;
							}
					}
					if(!check){
						MongoClient.connect(mongourl, function(err, db) {
							assert.equal(null, err);
							updateRate(db,id,push, function() {
								db.close();
								console.log('update completed!');
								res.redirect('/display?_id='+req.body._id);
							});
						});
					}else{
						res.status(500);
						res.render('rate_error');
					}
				} else {
					MongoClient.connect(mongourl, function(err, db) {
						assert.equal(null, err);
						updateRate(db,id,push, function() {
							db.close();
							console.log('update completed!');
							res.redirect('/display?_id='+req.body._id);
						});
					});
				}
			});		
		});
	}
});

app.get('/remove',function(req,res,next){
	if (!req.session.authenticated) {
		res.redirect('/');
	}else{
		var criteria = {};
		id = req.query._id;
		criteria['_id'] = ObjectId(id);
		MongoClient.connect(mongourl, function(err, db) {
			assert.equal(null, err);
			findR(db,criteria,function(restaurants) {
				db.close();
				console.log('Disconnected MongoDB\n');
				if (restaurants[0].owner == req.session.username) {
					MongoClient.connect(mongourl, function(err, db) {
						assert.equal(null, err);
						removeRes(db,criteria, function() {
							db.close();
							console.log('update completed!');
							res.status(200);
							res.render('remove');
						});
					});
				} else {
					res.status(500);
					res.render('remove_error');
				}
			});		
		});
	}
});

app.get('/change',function(req,res,next){
	if (!req.session.authenticated) {
		res.redirect('/');
	}else{
		var criteria = {};
		id = req.query._id;
		criteria['_id'] = ObjectId(id);
		MongoClient.connect(mongourl, function(err, db) {
			assert.equal(null, err);
			findR(db,criteria,function(restaurants) {
				db.close();
				console.log('Disconnected MongoDB\n');
				if (restaurants[0].owner == req.session.username) {
							res.status(200);
							res.render('change', {restaurants:restaurants[0],user:req.session.username});
				} else {
					res.status(500);
					res.render('change_error');
				}
			});		
		});
	}
});

app.post('/change',function(req,res,next){
	if (!req.session.authenticated) {
		res.redirect('/');
	}else{
		var fs = require('fs');
		new_r = {};
		var criteria = {};
		id = req.body._id;
		criteria['_id'] = ObjectId(id);
		new_r['restaurant_id'] = (req.body.restaurant_id) ? req.body.restaurant_id : null;
		new_r['name'] = (req.body.name) ? req.body.name : "";
		new_r['borough'] = (req.body.borough) ? req.body.borough : "";
		new_r['cuisine'] = (req.body.cuisine) ? req.body.cuisine : "";
		var address = {};
		address['street'] = (req.body.street) ? req.body.street : "";
		address['building'] = (req.body.building) ? req.body.building : "";
		address['zipcode'] = (req.body.zipcode) ? req.body.zipcode : "";
		var coord = [];
		(req.body.lon) ? coord.push(req.body.lon) : coord.push("");
		(req.body.lat) ? coord.push(req.body.lat) : coord.push("");
		address['coord'] = coord;
		new_r['address'] = address;
		//var grades = [];
		//if(fields.score) grades.push({"user":req.session.username,"score":fields.score});
		new_r['grades'] = [];
		new_r['owner'] = req.session.username;
		//if(fields.photo){
		if(req.files.photo){
			/*var d = new Date();
			let photo = req.files.photo;// Use the mv() method to place the file somewhere on your server
			photo.mv('./images/('+req.session.username+d.getTime()+')'+photo.name, function(err) {
				if (err)
					return res.status(500).send(err);
				console.log('File uploaded!');
			});*/
			new_r['mimetype'] = req.files.photo.mimetype;
			new_r['photo'] = req.files.photo.data.toString('base64');
			MongoClient.connect(mongourl, function(err, db) {
				assert.equal(null, err);
				updateDocument(db,criteria,new_r,function() {
					console.log('update done!');
					db.close();
					res.redirect('/display?_id='+id);
				});
			});
		}else{
			//new_r['mimetype'] = "";
			//new_r['photo'] = "";
			MongoClient.connect(mongourl, function(err, db) {
				assert.equal(null, err);
				updateDocument(db,criteria,new_r,function() {
					console.log('update done!');
					db.close();
					res.redirect('/display?_id='+id);
				});
			});
		}
	}
});

app.get('/api/restaurant/read/:c/:v',function(req,res,next){
	if (!req.session.authenticated) {
		res.redirect('/');
	}else{
		var criteria = {};
		if(req.params.c && req.params.v){
			criteria[req.params.c] = req.params.v;
		}
		//console.log(criteria);
		MongoClient.connect(mongourl, function(err, db) {
			assert.equal(null, err);
			findR(db,criteria,function(restaurants) {
				db.close();
				console.log('Disconnected MongoDB\n');
				if (restaurants.length == 0) {
					res.writeHead(200, {"Content-Type": "application/json"});
					var json = JSON.stringify({});
					res.end(json);
				} else {
					res.writeHead(200, {"Content-Type": "application/json"});
					var json = JSON.stringify(restaurants);
					res.end(json);
				}
			});		
		});
	}
});

app.get('/api/restaurant/read',function(req,res,next){
	if (!req.session.authenticated) {
		res.redirect('/');
	}else{
		var criteria = {};
		//console.log(criteria);
		MongoClient.connect(mongourl, function(err, db) {
			assert.equal(null, err);
			findR(db,criteria,function(restaurants) {
				db.close();
				console.log('Disconnected MongoDB\n');
				if (restaurants.length == 0) {
					res.writeHead(200, {"Content-Type": "application/json"});
					var json = JSON.stringify({});
					res.end(json);
				} else {
					res.writeHead(200, {"Content-Type": "application/json"});
					var json = JSON.stringify(restaurants);
					res.end(json);
				}
			});		
		});
	}
});

app.get('/newrest',function(req,res,next){
	if (!req.session.authenticated) {
		res.redirect('/');
	}else{
		res.status(200);
		res.render('newrest');
	}
});

app.post('/api/restaurant/create',function(req,res,next){
	/*if (!req.session.authenticated) {
		res.redirect('/');
	}else{*/
		var fs = require('fs');
		new_r = {};
		new_r['restaurant_id'] = (req.body.restaurant_id) ? req.body.restaurant_id : null;
		new_r['name'] = (req.body.name) ? req.body.name : "";
		new_r['borough'] = (req.body.borough) ? req.body.borough : "";
		new_r['cuisine'] = (req.body.cuisine) ? req.body.cuisine : "";
		var address = {};
		address['street'] = (req.body.street) ? req.body.street : "";
		address['building'] = (req.body.building) ? req.body.building : "";
		address['zipcode'] = (req.body.zipcode) ? req.body.zipcode : "";
		var coord = [];
		(req.body.lon) ? coord.push(req.body.lon) : coord.push("");
		(req.body.lat) ? coord.push(req.body.lat) : coord.push("");
		address['coord'] = coord;
		new_r['address'] = address;
		//var grades = [];
		//if(fields.score) grades.push({"user":req.session.username,"score":fields.score});
		new_r['grades'] = [];
		if(req.session.username){
			new_r['owner'] = req.session.username;
		}else if(req.body.owner){
			new_r['owner'] = req.body.owner;
		}else{
			new_r['owner'] = "";
		}
		new_r['mimetype'] = "";
		new_r['photo'] = "";
		//console.log(new_r['owner']);
		//console.log(new_r['name']);
		if(new_r['name'] == "" || new_r['owner'] == ""){
			res.writeHead(200, {"Content-Type": "application/json"});
			var json = JSON.stringify({status: 'failed'});
			res.end(json);
		}else{
		MongoClient.connect(mongourl, function(err, db) {
			assert.equal(null, err);
			insertDocument2(db,new_r,function(id) {
				console.log('insert done!');
				db.close();
				var json = {status: 'ok' , _id:id};
				res.writeHead(200, {"Content-Type": "application/json"});
				var jsonstr = JSON.stringify(json);
				res.end(jsonstr);
			});
		});
		}
	//}
});

function insertDocument2(db,r,callback) {
	db.collection('restaurants').insertOne(r,function(err,result) {
		assert.equal(err,null);
		if(err){
			res.writeHead(200, {"Content-Type": "application/json"});
			var json = JSON.stringify({status: 'failed'});
			res.end(json);
		}
		console.log("Insert was successful!");
		//console.log(result.ops[0]._id);
		callback(result.ops[0]._id);
	});
}

function insertDocument(db,r,callback) {
	db.collection('restaurants').insertOne(r,function(err,result) {
		assert.equal(err,null);
		console.log("Insert was successful!");
		//console.log(JSON.stringify(result));
		callback(result);
	});
}

function findUserPw(db,callback) {
	var users = [];
	cursor = db.collection('accounts').find();

	cursor.each(function(err, doc) {
		assert.equal(err, null); 
		if (doc != null) {
			users.push(doc);
		} else {
			callback(users); 
		}
	});
}

function findRestaurants(db,criteria,callback) {
	var restaurants = [];
	cursor = db.collection('restaurants').find(criteria,{name:1}); 				
	cursor.each(function(err, doc) {
		assert.equal(err, null); 
		if (doc != null) {
			restaurants.push(doc);
		} else {
			callback(restaurants); 
		}
	});
}

function displayRestaurant(res,id) {
	MongoClient.connect(mongourl, function(err, db) {
		assert.equal(err,null);
		console.log('Connected to MongoDB\n');
		db.collection('restaurants').
			findOne({_id: ObjectId(id)},function(err,doc) {
				assert.equal(err,null);
				db.close();
				console.log('Disconnected from MongoDB\n');
				if (!doc) {
					res.status(500);
					res.render('error');
				} else {
					//console.log(doc);
					res.status(200);
					res.render('display',{restaurant:doc});
				}
		});
	});
}

function findR(db,criteria,callback) {
	var restaurants = [];
	cursor = db.collection('restaurants').find(criteria); 				
	cursor.each(function(err, doc) {
		assert.equal(err, null); 
		if (doc != null) {
			restaurants.push(doc);
		} else {
			callback(restaurants); 
		}
	});
}

var updateRate = function(db,id,update, callback) {
	db.collection('restaurants').updateOne(
		{_id: ObjectId(id)},
		{ $push: update },
	function(err, results) {
		//console.log(results);
		callback();
	});
};

var removeRes = function(db,criteria, callback) {
	db.collection('restaurants').deleteOne(
		criteria,
		function(err, results) {
			//console.log(results);
			callback();
		}
	);
};

function updateDocument(db,criteria,r,callback) {
	db.collection('restaurants').updateOne(criteria,{$set:r},function(err,result) {
		assert.equal(err,null);
		console.log("update  was successful!");
		//console.log(JSON.stringify(result));
		callback(result);
	});
}

app.listen(process.env.PORT || 8099);
