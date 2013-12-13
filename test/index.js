var test = require('tap').test;

var anydbsql = require('../anydb-sql');

var grouper = require('../lib/grouper');

var path = require('path');

var util = require('util');

var db = anydbsql({
  url: 'sqlite3://', 
  connections: 1
});

var post = db.define({
    name: 'posts',
    columns: {
        'id': {primaryKey: true}, 
        'title':{}, 
        'content':{}, 
        'userId': {}
    },
    has: {'user': {from: 'users'}}
});

var user = db.define({
  name: 'users',
  columns: {
      id: { primaryKey: true }, 
      name:{}
  },
  has: {posts: {from: 'posts', many: true}}
});


test('anydb-sql', function(t) {

  db.query('create table users (id integer primary key, name);\n'
          +'create table posts (id integer primary key, title, content, userId);', function(err) {
    
    t.notOk(err, 'creating table failed: ' + err);

    t.test('insert exec', function(t) {
      user.insert({id: 1, name: 'test'}).exec(function(err, res) {
        t.notOk(err, 'user inserted without errors: ' + err);
        t.end();
      });
    });

    t.test('where get', function(t) {
      user.where({id: 1}).get(function(err, user) {
        t.deepEquals(user, {id: 1, name: 'test'})
        t.end();
      });
    });

    t.test('where get .then', function(t) {
        user.where({id: 1}).get().then(function(user) {
            t.deepEquals(user, {id: 1, name: 'test'});
            t.end();
        });
    });

    t.test('insert transaction', function(t) {
      var tx = db.begin(); 
      user.insert({id: 2, name: 'test2'}).execWithin(tx);
      user.insert({id: 3, name: 'test3'}).execWithin(tx);
      user.where({id: 2}).getWithin(tx, function(err, res) {
        t.ok(res, 'getWithin transaction should work');
        tx.commit(function(err) {
          t.notOk(err, 'inserts within transaction should work');
          t.end();
        });

      });
    });
    t.test('resultless get', function(t) {
      user.where({id: 40}).get(function(err, usr) {
        t.notOk(err, 'has no error');
        t.notOk(usr, 'should return null results:' + usr);
        t.end();
      });
    });


    t.test('table.as and join', function(t) {
      var userx = user.as('userx');
      var query = user.from(user.join(userx).on(user.id.equals(userx.id)))
        .where(userx.id.equals(1))
        .select(userx.id);

      query.get(function(err, res) {
        t.equals(res.id,  1, 'user.id is 1');    
        t.end();
      });
    });

    t.test('selectDeep', function(t) {
        var q = user.from(user).selectDeep(user, user);
        var text = 'SELECT "users"."id" AS "users.id##",'
            + ' "users"."name" AS "users.name", "users"."id" AS "users.id##",'
            +' "users"."name" AS "users.name" FROM "users"';
        t.equals(q.toQuery().text, text);
        t.end();
    });

    t.test('selectDeep treats aggregates properly', function(t) {
        var alias = db.allOf(user.posts.id.count().as('postCount'))[0].alias;
        t.equals(alias, 'users.postCount');
        t.end();
    });

    t.test('db.close', function(t) {
      t.plan(1);
      db.close(function(err) {
        t.notOk(err, 'db closed');
        t.end();
      });
    });

  });

});
