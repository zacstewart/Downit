var express = require('express');
var mongoose = require('mongoose');

var app = express.createServer();
var db = mongoose.connect('mongodb://localhost/downit');
var Schema = mongoose.Schema, ObjectId = Schema.ObjectId;

// The setup
app.configure(function () {
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.static(__dirname + '/public'));
});

// Models
mongoose.model('Post', new Schema({
  title     : { type: String },
  url       : { type: String },
  downVotes : { type: Number, default: 0 },
  created   : { type: Date, default: Date.now }
}));

mongoose.model('Downvote', new Schema({
  post      : { type: ObjectId },
  ip        : { type: String }
}));

Post = mongoose.model('Post');
Downvote = mongoose.model('Downvote');

// Functions

function comparePosts(a,b) {
  if(a.downVotes < b.downVotes) {
    return -1;
  }
  if(a.downVotes > b.downVotes) {
    return 1;
  }
  return 0;
}

// Routing

app.get('/', function (req, res){
  Post.find({}).sort('downVotes', 1).sort('created', -1).execFind(function (err, doc) {
    if (err) {
      throw err;
    } else {
      res.render('index', {title: "Home", posts: doc});
    }
  });
});

app.get('/submit', function (req, res) {
  res.render('submit', {title: "Submit"});
});

app.post('/submit', function (req, res) {
  var post = new Post();
  post.title = req.body.post.title;
  post.url = req.body.post.url;
  post.downVotes = 0;
  post.save();
  res.redirect('/');
});

app.get('/downvote/:id', function (req, res) {
  Downvote.find({post: req.params.id, ip: req.connection.remoteAddress}, function (err, d) {
    if(d.length > 0) {
      console.log(d);
    } else {
      var downvote = new Downvote();
      downvote.post = req.params.id;
      downvote.ip = req.connection.remoteAddress;
      downvote.save();
      Post.findById(req.params.id, function (err, p) {
        if(!p) {
          return next(new Error('Could not find post'));
        } else {
          // p.modified = new Date();
          p.downVotes += 1;
          p.save(function (err) {
            if (err) {
              console.log("Save error");
            }
          });
        }
      });
    }
  });
  res.redirect('/');
});

// Error handling


app.listen(3000);