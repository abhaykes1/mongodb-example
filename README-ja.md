# mongodb-example

[English](README.md)/Japanese

## このサンプルの目標

このサンプルコードでは次のことを目標とします

- MongoDBサーバーを配置します
- 別のコンピューターからMongoDBサーバーに接続しデーターを読み取ります
  - パスワードベースのユーザー認証を行い読み取り権のみでアクセスします
  - 自己署名証明書を用いたTLS/SSLにて接続を保護します

## テスト環境

次の環境で動作の確認を行っています。

### サーバー 

- Raspberry Pi 2 (この例では`mongo.local`というホスト名です)
- MongoDB v2.6.10
- Ubuntu 15.10 (GNU/Linux 4.1.15-v7+ armv7l)

**SSLバージョンの注意点:** 
[無償版のMongoDBにはSSLを含まないバージョンがあります](https://github.com/mongodb/node-mongodb-native.git)
パッケージマネージャーでインストールできるものにはたいていSSLが含まれているよう
ですが、万一、含まれていない場合は、別のリポジトリを参照してインストールするか、
自ら適切にコンパイルする必要があります。

```bash
$ mongod --version
db version v2.6.10
2016-04-15T02:31:34.047+0900 git version: nogitversion
2016-04-15T02:31:34.048+0900 OpenSSL version: OpenSSL 1.0.2d 9 Jul 2015
```

### クライアント

- Windows 10
- Node v5.3.0
- MSYS2 (bash/git/ssh/scp)

このサンプルではMSYS2などでbash/git/scpなどが使える状態のWinodwsが用意されているとい
う前提で記述しています。

以下のサンプルはすべてbashで記述されているため、もちろんMacやLinuxなどでも構いません。


## サーバーへのMongoDBのインストールと設定

パッケージマネージャーからmongodbをインストールします。

```bash
sudo apt-get install mongodb
```

インストール後、mongodbサービスが正常に稼働しているか確認してください。

```bash
service mongodb status
● mongodb.service - An object/document-oriented database
   Loaded: loaded (/lib/systemd/system/mongodb.service; enabled; vendor preset: enabled)
   Active: active (running) since Thu 2016-04-14 21:04:14 JST; 3h 59min ago
     Docs: man:mongod(1)
 Main PID: 12318 (mongod)
   CGroup: /system.slice/mongodb.service
           └─12318 /usr/bin/mongod --config /etc/mongodb.conf
```

**同コンピューター上で**mongoシェルを実行し、mongodbのadminデーターベースに管理者ユーザーを追加します。

```bash
$ mongo
> use admin
> db.createUser( { user: 'mongo', pwd: 'password', roles: ['userAdminAnyDatabase'] })
Successfully added user: { "user" : "mongo", "roles" : [ "userAdminAnyDatabase" ] }
```

その後、`/etc/mongodb.conf`を次の通り編集します。

- 外部からの接続を可能にするため`bind_ip`をコメントアウトします `#bind_ip = 127.0.0.1`
- 認証を有効にするため`auth = true`をアンコメントします。 
- SSLを有効にするため`sslOnNormalPorts = true`と`sslPEMKeyFile = /etc/ssl/mongodb.pem`をアンコメントします。
- `sslAllowInvalidHostnames = true` と `sslAllowInvalidCertificates = true` を追
  記します。

上記設定についてより詳しくは`mongod --help`で確認できます。

次にSSLで使う自己署名証明書を作成します。(mongod.pem と mongod-cert.crt)

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

ここまで出来たらmongodbを再起動します。

```bash
$ sudo service mongodb restart
```

mongodbの再起動後、**同コンピューター上で**mongoシェルを実行し、SSLが有効と認証が有効かど
うか次のように確認します。(次のような認証エラーになればうまく設定できています)

※ mongodbのバージョンが3.0以降の場合は、以下の`mongo --ssl`の末尾に
`--sslAllowInvalidCerticates`もしくは`--sslCAFile=/etc/ssl/mongodb-cert.crt`を
オプションとして追加する必要があると思います：
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

引き続きmongoシェルで、今回のテストで使用するユーザーとデータを追加していきます。

```
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

最後に27017ポートを開けばMongoDBのサーバー公開は完了です。

```
sudo ufw allow 27017
```

## 他のコンピューターからMongoDBサーバーに接続する (Node.js)

サンプルコードの実行前に上記設定で作成した自己署名証明書を
サーバーからダウンロードする必要があります。
どのような方法でも構いませんが以下はscpでダウンロードする一例です。

```
cd ~
scp user@mongo.local:/etc/ssl/mongodb-cert.crt ./
```

次の通りサンプルコードのダウンロードと、`mongodb-cert.crt`の配置を行い、
コードを実行してください。

**index.js内のサーバー名やユーザー名やパスワード名は便宜変更してください**


```bash
$ git clone https://github.com/retorillo/mongodb-example
$ cd mongodb-example
$ mv ~/mongodb-cert.crt ./
$ npm update
$ npm test
```

`npm test`コマンドの結果として次のようなログが得られれば無事に目標の達成です。

```bash
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

index.jsの通り、`read`権しか持っていない`testUser`にてログインしています。
そのためfindメソッドは成功し、dropメソッドには失敗していることがポイントです。

Nodeのmongodbを使うときに気になったのは、認証のメソッド名が
[auth](https://docs.mongodb.org/manual/reference/method/db.auth/)ではなく
[authenticate](http://mongodb.github.io/node-mongodb-native/api-generated/db.html#authenticate)
だったりコレクション列挙の
[getCollectionNames](https://docs.mongodb.org/manual/reference/method/db.getCollectionNames/)ではなく、
[collectionNames](http://mongodb.github.io/node-mongodb-native/api-generated/db.html#collectionnames)
だったりと対応する関数でも、シェルとは名前が若干の相違があることでした。

それ以外はほとんどシェルと似た感覚で使え、javascriptベースで統一されているメリットだなと感じます。

## 参考リンク

- [Shell Methods](https://docs.mongodb.org/manual/reference/method/)
- [Driver API](https://mongodb.github.io/node-mongodb-native/api-generated/)
- [Transport Encryption](https://docs.mongodb.org/master/core/security-transport-encryption/)
  - [for Server](https://docs.mongodb.org/master/tutorial/configure-ssl/)
  - [for Clients](https://docs.mongodb.org/master/tutorial/configure-ssl-clients/)
