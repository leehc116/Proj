var express = require('express');
var session = require('cookie-session');
var bodyParser = require('body-parser');
var app = express();

var http = require('http');
var url  = require('url');
var MongoClient = require('mongodb').MongoClient; 
var assert = require('assert');
var ObjectId = require('mongodb').ObjectID;
var mongourl = 'mongodb://home:123321@ds131878.mlab.com:31878/project';

app = express();
app.set('view engine','ejs');

var SECRETKEY1 = 'I want to pass COMPS381F';
var SECRETKEY2 = 'Keep this to yourself';

app.set('view engine','ejs');

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
				console.log(req.body);
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
			findRestaurants(db,{},function(restaurants) {
				db.close();
				console.log('Disconnected MongoDB\n');
				if (restaurants.length == 0) {
					res.status(200);
					res.render('read',{userid:req.session.username, restaurant_name:restaurants});
				} else {
					//console.log(restaurants);
					res.status(200);
					res.render('read',{userid:req.session.username, restaurant_name:restaurants});
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
		var formidable = require('formidable');
		var fs = require('fs');
		var form = new formidable.IncomingForm();
		form.parse(req, function (err,fields,files) {
			new_r = {};
			if(fields.restaurant_id) new_r['restaurant_id'] = fields.restaurant_id;
			if(fields.name) new_r['name'] = fields.name;
			if(fields.borough) new_r['borough'] = fields.borough;
			if(fields.cuisine) new_r['cuisine'] = fields.cuisine;
			if(fields.street || fields.building || fields.zipcode){
				var address = {};
				if(fields.street) address['street'] = fields.street;
				if(fields.building) address['building'] = fields.building;
				if(fields.zipcode) address['zipcode'] = fields.zipcode;
				if(fields.lon || fields.lat){
					var coord = [];
					if(fields.lon) coord.push(fields.lon);
					if(fields.lat) coord.push(fields.lat);
					address['coord'] = coord;
				}
				new_r['address'] = address;
			}
			if(fields.score){
				var grades = [];
				if(req.session.authenticated) grades.push({"user":req.session.username,"score":fields.score});
				new_r['grades'] = grades;
			}
			if(req.session.authenticated) new_r['owner'] = req.session.username;
			//if(fields.photo){
				var filename = files.photo.path;
				var mimetype = files.photo.type;
				fs.readFile(filename, function(err,data) {
					var buffer = new Buffer(data).toString('base64');
					if(buffer){
						new_r['mimetype'] = mimetype;
						new_r['photo'] = buffer;
						MongoClient.connect(mongourl, function(err, db) {
							assert.equal(null, err);
							insertDocument(db,new_r,function() {
								console.log('insert done!');
								db.close();
							});
						});
					}else{
						MongoClient.connect(mongourl, function(err, db) {
							assert.equal(null, err);
							insertDocument(db,new_r,function() {
								console.log('insert done!');
								db.close();
							});
						});
					}
				});
		});
		res.redirect('/');
	}
});

app.get('/display',function(req,res,next){
	if (!req.session.authenticated) {
		res.redirect('/');
	}else{
		var parsedURL = url.parse(req.url,true); //true to get query as object
		var queryAsObject = parsedURL.query;
		//console.log(queryAsObject._id);
		displayRestaurant(res,queryAsObject._id);
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

function insertDocument(db,r,callback) {
	db.collection('restaurants').insertOne(r,function(err,result) {
		assert.equal(err,null);
		console.log("Insert was successful!");
		console.log(JSON.stringify(result));
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
					res.writeHead(500, {"Content-Type": "text/html"});
					res.write('<head><title>Error</title></head>');
					res.end('Internal Server Error');
				} else {
					//console.log(doc);
					res.status(200);
					res.render('display',{restaurant:doc});
				}
		});
	});
}

app.listen(process.env.PORT || 8099);
