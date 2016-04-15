const fs = require('fs');
const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');
const Logplease = require('logplease');
const logger = Logplease.create('mongodb', { color: Logplease.Colors.Yellow }); 
const stringify = require('object-stringify');

const mongoUser = "testUser";
const mongoPassword = "password";
const mongoUrl = "mongodb://mongo.local:27017/test?ssl=true";
const certFile = fs.readFileSync("./mongodb-cert.crt");

var db;
var collection;

logger.info("Connecting...");
MongoClient.connect(mongoUrl, { server: { sslCA: certFile } }, mongoConnected);

function mongoConnected(error, connectedDatabase) {
  assert.equal(null, error);
  logger.info("Successfully connected.");
  logger.info("Authenticating...");
  db = connectedDatabase;
  db.authenticate(mongoUser, mongoPassword, mongoAuthenticated);
}

function mongoAuthenticated(error, result) {
  assert.equal(null, error);
  assert.equal(true, result);
  logger.info("Successfully authenticated.");
  logger.info("Finding document...");
  collection = db.collection('test');
  collection.findOne({ mongo_is: 'db' }, mongoDocumentFound);
}

function mongoDocumentFound(error, doc) {
  assert.equal(null, error);
  logger.info(`Successfully found: ${stringify(doc)}`);
  logger.info("Dropping collection...");
  collection.drop(mongoCollectionDropped);
}

function mongoCollectionDropped(error, result) {
  assert.notEqual(null, error);
  logger.info("Cannot drop collection. This is correct behavior.");
  db.close();
  logger.info("Connection is closed");
  logger.info("Test is passed.");
}
