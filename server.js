// Modules
var express = require('express');
var mongoose = require('mongoose');
var _ = require('underscore');

// Environment
var port = process.env.PORT || 4000;
var mongouri = process.env.MONGOHQ_URL || 'mongodb://localhost/downit';

var app = express.createServer();
var db = mongoose.connect(mongouri);
var Schema = mongoose.Schema, ObjectId = Schema.ObjectId;

// The setup

app.configure(function () {
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.static(__dirname + '/public'));
});

// Models

var DownVote = new Schema({
  ip        : { type: String },
  post_id   : { type: ObjectId },
  created   : { type: Date, default: Date.now },
  modified  : { type: Date, default: Date.now }
});
mongoose.model('DownVote', DownVote);
DownVote = mongoose.model('DownVote');

var Post = new Schema({
  ancestors   : [ObjectId],
  parent      : { type: ObjectId },
  title       : { type: String },
  url         : { type: String },
  comment     : { type: String },
  downVotes   : { type: Number },
  created     : { type: Date, default: Date.now }
});
mongoose.model('Post', Post);
Post = mongoose.model('Post');

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
  Post.find({parent: null}).limit(10).sort('downVotes', 1).sort('created', -1).execFind(function (err, doc) {
    if (err) {
      throw err;
    } else {
      res.render('index', {title: 'Home', posts: doc});
    }
  });
});

app.get('/submit', function (req, res) {
  res.render('submit', {title: 'Submit'});
});

app.post('/submit', function (req, res) {
  var post = new Post();
  post.title = req.body.post.title;
  post.url = req.body.post.url;
  post.downVotes = 0;
  post.save();
  res.redirect('/');
});

app.get('/:id/downvote', function (req, res) {
  DownVote.findOne({post_id: req.params.id, ip: req.connection.remoteAddress}, function (err, d) {
    if(d) {
      console.log(d);
      d.remove(function (err, whut) {
        Post.findById(req.params.id, function (err, p) {
          p.downVotes -= 1;
          p.save();
          res.redirect('/');
        });
      });
    } else {
      var downvote = new DownVote();
      downvote.post_id = req.params.id;
      downvote.ip = req.connection.remoteAddress;
      downvote.save(function () {
        Post.findById(req.params.id, function (err, p) {
          if(!p) {
            return next(new Error('Could not find post'));
          } else {
            p.downVotes += 1;
            p.save(function (err) {
              if (err) {
                throw err;
              } else {
                res.redirect('/');
              }
            });
          }
        });
      });
    }
  });
});

app.get('/:id/comment', function (req, res) {
  Post.findById(req.params.id, function (err, parent) {
    res.render('new_comment', {parent: parent});
  });
});

app.post('/:id/comment', function (req, res) {
  Post.findById(req.body.post.parent, function (err, parent) {
    comment = new Post();
    comment.ancestors = parent.ancestors.concat([parent.id]);
    comment.parent = req.body.post.parent
    comment.comment = req.body.post.comment
    // parent.posts.push(comment);
    comment.save();
    res.redirect('/' + comment.parent_id + '/comments');
  });
});

app.get('/:id/comments', function (req, res) {
  Post.findById(req.params.id, function (err, parent) {
    if (!err) {
      Post.find({ancestors: parent.id}, function (err, comments) {
        comments = _.groupBy(comments, function (comment) {
          return comment.parent;
        });
        console.log(comments);
        res.render('comments', {parent: parent, comments: comments});
      });
    } else {
      throw err;
    }
  });
});


// Error handling
app.listen(port);
console.log('http://localhost:' + port);
