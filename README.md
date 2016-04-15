# mongodb-example

English/[Japanese](./README-ja.md)

## Goal of this example

The goal of this example is to deploy MongoDB server and read document from Node
app on another computer with password-based user access control and self-signed
certificate TLS/SSL encryption.

## Environment

### Server

- Raspberry Pi 2 (In this example, hostname is `mongo.local`)
- MongoDB v2.6.10
- Ubuntu 15.10 (GNU/Linux 4.1.15-v7+ armv7l)

> Note: The default distribution of MongoDB does not contain support for SSL. To
> use SSL, you must either build MongoDB locally passing the “--ssl” option to
> scons or use MongoDB Enterprise.
> https://docs.mongodb.org/v2.4/tutorial/configure-ssl/

Check openssl support after install

```
$ mongod --version
db version v2.6.10
2016-04-15T02:31:34.047+0900 git version: nogitversion
2016-04-15T02:31:34.048+0900 OpenSSL version: OpenSSL 1.0.2d 9 Jul 2015
```

### Client

- Windows 10
- MSYS2 (node)
- Mintty

## Installation & Configuration

Install mongodb.

```bash
sudo apt-get install mongodb
```

Check mongodb status.

```
service mongodb status
● mongodb.service - An object/document-oriented database
   Loaded: loaded (/lib/systemd/system/mongodb.service; enabled; vendor preset: enabled)
   Active: active (running) since Thu 2016-04-14 21:04:14 JST; 3h 59min ago
     Docs: man:mongod(1)
 Main PID: 12318 (mongod)
   CGroup: /system.slice/mongodb.service
           └─12318 /usr/bin/mongod --config /etc/mongodb.conf
```

Create admin user for the mongodb.

```bash
$ mongo
> use admin
> db.createUser( { user: 'mongo', pwd: 'password', roles: ['userAdminAnyDatabase'] })
Successfully added user: { "user" : "mongo", "roles" : [ "userAdminAnyDatabase" ] }
```

Modify `/etc/mongodb.conf` as follows:

- Comment out `bind_ip` to open UNIX socket `#bind_ip = 127.0.0.1`
- Uncomment `auth = true` 
- Uncomment `sslOnNormalPorts = true` and `sslPEMKeyFile = /etc/ssl/mongodb.pem`
- Append `sslAllowInvalidHostnames = true` and `sslAllowInvalidCertificates = true`

To learn details of the above configurations, run `mongod --help` command. 

Next, generate SSL key (mongodb.pem, and mongodb-cert.crt).

```bash
$ cd /etc/ssl/ && \
> sudo openssl req -newkey rsa:2048 -new -x509 -days $(( 365 * 3)) \
> -nodes -out mongodb-cert.crt -keyout mongodb-cert.key && \
> cat mongodb-cert.key mongodb-cert.crt | sudo tee mongodb.pem

Generating a 2048 bit RSA private key

writing new private key to 'mongodb-cert.key'
-----
You are about to be asked to enter information that will be incorporated
into your certificate request.
What you are about to enter is what is called a Distinguished Name or a DN.
There are quite a few fields but you can leave some blank
For some fields there will be a default value,
If you enter '.', the field will be left blank.
-----
Country Name (2 letter code) [AU]:JP
State or Province Name (full name) [Some-State]:Fukuoka
Locality Name (eg, city) []:Fukuoka
Organization Name (eg, company) [Internet Widgits Pty Ltd]:
Organizational Unit Name (eg, section) []:
Common Name (e.g. server FQDN or YOUR name) []:mongo.local.
Email Address []:
-----BEGIN PRIVATE KEY-----
...
-----END PRIVATE KEY-----
-----BEGIN CERTIFICATE-----
...
-----END CERTIFICATE-----
```

Restart mongodb service and check whether status is active.

```bash
$ sudo service mongodb restart
```

Check SSL and authentication are actually enabled.

**If you are using MongoDB v3 or later,** you must specify `--sslAllowInvalidCerticates`
or `--sslCAFile=/etc/ssl/mongodb-cert.crt` option after `mongo -ssl`: 
[Changed in version 3.0: When running mongo with the --ssl option, you must include either --sslCAFile or --sslAllowInvalidCertificates](https://docs.mongodb.org/master/tutorial/configure-ssl-clients/#mongo-shell-ssl-configuration)

```bash
$ mongo --ssl
connecting to: test
> db.createCollection('mustBeError')
{
        "ok" : 0,
        "errmsg" : "not authorized on test to execute command { create: \"mustBeError\" }",
        "code" : 13
}
```

Add users on `test` db and insert test collection and data.

```
$ mongo --ssl
> use admin
> db.auth('mongo', 'password')
> use test
> db.addUser({ user: 'dbOwner', password: 'password', roles: [ 'dbOwner' ] });
> db.addUser({ user: 'testUser', password: 'password', roles: [ 'read' ] });
> use test
> db.auth('dbOwner', 'password');
> db.createCollection('test');
> db.test.insert({ 'mongo_is': 'db', 'db_type_is': 'document_oriented' });
```

Finally, open port `27017` (this is default port of `mongod`)

```
sudo ufw allow 27017
```

## Connect from another compute (Node.js)

Before run this sample code, must retrieve self-signed cert file from server.
The following scp command is one of example to accomplish it.

```
cd ~
scp user@mongo.local:/etc/ssl/mongodb-cert.crt ./
```

After that, download sample code, deploy `mongodb-cert.crt`, and run `node test`.

**NOTE: Correct hostname, username and password of `index.js` before run**

```
$ git clone https://github.com/retorillo/mongodb-example
$ cd mongodb-example
$ mv ~/mongodb-cert.crt ./
$ npm update
$ npm test
```

Unless incorrectly configured, `find` method can be invoked on the rights of
'testUser' in contrast with failing of `drop` method.

```
[2016-04-14T15:44:52.263Z] [INFO]  mongodb: Connecting...
[2016-04-14T15:44:52.312Z] [INFO]  mongodb: Successfully connected.
[2016-04-14T15:44:52.312Z] [INFO]  mongodb: Authenticating...
[2016-04-14T15:44:52.333Z] [INFO]  mongodb: Successfully authenticated.
[2016-04-14T15:44:52.333Z] [INFO]  mongodb: Finding document...
[2016-04-14T15:44:52.342Z] [INFO]  mongodb: Successfully found: {"_id":"570fb69088832d96cd690535","m
ongo_is":"db","db_type_is":"document oriented"}
[2016-04-14T15:44:52.343Z] [INFO]  mongodb: Dropping collection...
[2016-04-14T15:44:52.348Z] [INFO]  mongodb: Cannot drop collection. This is correct behavior.
[2016-04-14T15:44:52.349Z] [INFO]  mongodb: Connection is closed
[2016-04-14T15:44:52.350Z] [INFO]  mongodb: Test is passed.
```

Done!

## Reference

- [Shell Methods](https://docs.mongodb.org/manual/reference/method/)
- [Driver API](https://mongodb.github.io/node-mongodb-native/api-generated/)
- [Transport Encryption](https://docs.mongodb.org/master/core/security-transport-encryption/)
  - [for Server](https://docs.mongodb.org/master/tutorial/configure-ssl/)
  - [for Clients](https://docs.mongodb.org/master/tutorial/configure-ssl-clients/)

