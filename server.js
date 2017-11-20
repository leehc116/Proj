var express = require('express');
var session = require('cookie-session');
var bodyParser = require('body-parser');
var app = express();

var http = require('http');
var url  = require('url');
var MongoClient = require('mongodb').MongoClient; 
var assert = require('assert');
var ObjectId = require('mongodb').ObjectID;
var mongourl = 'mongodb://home:123321@ds141454.mlab.com:41454/t03';

app = express();
app.set('view engine','ejs');

var SECRETKEY1 = 'I want to pass COMPS381F';
var SECRETKEY2 = 'Keep this to yourself';

/*var users = new Array(
	{id: 'developer', password: 'developer'},
	{id: 'guest', password: 'guest'}
);*/

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
	//res.status(200);
	//res.render('login');
	//res.sendFile(__dirname + '/public/login.html');
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
				//console.log(users);
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
		return next();
	}
	res.status(200);
	res.render('read',{userid:req.session.username});
});

app.get('/new',function(req,res,next){
	if (!req.session.authenticated) {
		res.redirect('/');
		return next();
	}
	res.status(200);
	res.render('new');
});

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

app.listen(process.env.PORT || 8099);
