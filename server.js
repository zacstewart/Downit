// Modules
var express = require('express');
var mongoose = require('mongoose');
var _ = require('underscore');
var relativeDate = require('relative-date');

// Environment
var port = process.env.PORT || 4000;
var mongouri = process.env.MONGOHQ_URL || 'mongodb://localhost/downit';
var sess_secret = process.env.SESSION_SECRET || 'am I a cat yet?';

var app = express.createServer();
var db = mongoose.connect(mongouri);
var Schema = mongoose.Schema, ObjectId = Schema.ObjectId;

// The setup

app.configure(function () {
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.static(__dirname + '/public'));
  app.use(express.cookieParser());
  app.use(express.session({ secret: sess_secret }));
});

// Models

var User = new Schema({
  name      : { type: String, default: 'Anonymous' },
  email     : { type: String, default: null },
  pass_hash : { type: String, default: null },
  created   : { type: Date, default: Date.now }
});
mongoose.model('User', User);
User = mongoose.model('User');

var DownVote = new Schema({
  user      : { type: ObjectId },
  post_id   : { type: ObjectId },
  created   : { type: Date, default: Date.now },
  modified  : { type: Date, default: Date.now }
});
mongoose.model('DownVote', DownVote);
DownVote = mongoose.model('DownVote');

var Post = new Schema({
  ancestors   : [ObjectId],
  user        : { type: ObjectId },
  parent      : { type: ObjectId },
  title       : { type: String },
  url         : { type: String },
  comment     : { type: String },
  downVotes   : { type: Number, default: 0 },
  created     : { type: Date, default: Date.now }
});
mongoose.model('Post', Post);
Post = mongoose.model('Post');

// Helpers

var newUser = function () {
  var user;
  user = new User();
  user.save();
  console.log('newUser');
  console.log(user);
  return user;
};

// Helpers

app.helpers({
  relativeDate: function (date) {
    return relativeDate(date);
  },
  // Don't want this to be asynch :(
  userName: function (user) {
    var name;
    User.findById(user, function (err, user) {
      if (!err) {
        console.log(user);
        return user.name;
      } else {
        throw err;
      }
    });
  }
});

// Routing

app.get('/', function (req, res){
  var user;

  if (req.session.user_id) {
    user = User.findById(req.session.user_id);
  } else {
    user = req.session.user_id = newUser();
  }

  Post.find({parent: null}).limit(10).sort('downVotes', 1).sort('created', -1).execFind(function (err, posts) {
    if (err) {
      throw err;
    } else {
      res.render('index', {title: 'Home', user: user, posts: posts});
    }
  });
});

app.get('/submit', function (req, res) {
  var user;

  if (req.session.user_id) {
    user = User.findById(req.session.user_id);
  } else {
    user = req.session.user_id = newUser();
  }

  res.render('submit', {title: 'Submit', user: user});
});

app.post('/post', function (req, res) {
  var post = new Post(),
   user = {};

  if (req.session.user_id) {
    user = req.session.user_id;
  } else {
    user = req.session.user_id = newUser().id;
  }

  console.log(user);

  if (req.body.post.parent) {
    Post.findById(req.body.post.parent, function (err, parent) {
      post.user = user.id,
      post.ancestors = parent.ancestors.concat([parent.id]);
      post.parent = req.body.post.parent
      post.comment = req.body.post.comment
      post.save();
      res.redirect('/' + parent.id + '/comments');
    });
  } else if (req.body.post.url) {
    post.user = user.id,
    post.title = req.body.post.title;
    post.url = req.body.post.url;
    post.downVotes = 0;
    post.save();
    res.redirect('/');
  }
});

app.get('/:id/downvote', function (req, res) {
  var user = {};

  if (req.session.user_id) {
    user = req.session.user_id;
  } else {
    user = req.session.user_id = newUser().id;
  }

  console.log(user);

  DownVote.findOne({post_id: req.params.id, user: user.id}, function (err, d) {
    if(d) {
      d.remove(function (err) {
        Post.findById(req.params.id, function (err, p) {
          p.downVotes -= 1;
          p.save();
          res.redirect('back');
        });
      });
    } else {
      var downvote = new DownVote();
      downvote.user = user.id;
      downvote.post_id = req.params.id;
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
                res.redirect('back');
              }
            });
          }
        });
      });
    }
  });
});

app.get('/:id/comment', function (req, res) {
  var user;

  if (req.session.user_id) {
    user = User.findById(req.session.user_id);
  } else {
    user = req.session.user_id = newUser();
  }

  Post.findById(req.params.id, function (err, parent) {
    res.render('new_comment', {user: user, parent: parent});
  });
});

app.get('/:id/comments', function (req, res) {
  var user;

  if (req.session.user_id) {
    user = req.session.user_id;
  } else {
    user = req.session.user_id = newUser().id;
  }

  Post.findById(req.params.id, function (err, parent) {
    if (!err) {
      Post.find({ancestors: parent.id}).sort('downVotes', 1).sort('created', -1).execFind(function (err, comments) {
        comments = _.groupBy(comments, function (comment) {
          return comment.parent;
        });
        res.render('comments', {parent: parent, comments: comments});
      });
    } else {
      throw err;
    }
  });
});

app.get('/my/posts', function (req, res) {
  var user;

  if (req.session.user_id) {
    user = req.session.user_id;
  } else {
    user = req.session.user_id = newUser().id;
  }

  Post.find({user: user.id}, function (err, posts) {
    res.render('index', {title: 'My Posts', user: user, posts: posts});
  });
});


// Error handling
app.listen(port);
console.log('http://localhost:' + port);
