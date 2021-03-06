# コマンド一覧

|コマンド|説明|
|-|-|
|denv  |開発環境を起動する。通常はこの環境内でコマンドを実行する|
|denvp |denvコマンドのポート開放版。サーバを起動させる場合に使用する|
|denvdb|mySQLを起動する|

## denvコマンド

```
denv [command]
```

* 通常は引数を指定しない状態で起動させる。
* ワンライナーとして起動したい場合には`denv`の後にコマンドを指定する。

## denvpコマンド

```
denvp port command
```

* サーバ起動などで使用する。
* ポート番号を指定してコマンド起動する。
  * ポート番号は`ホスト:コンテナ`の形式で指定する。
* 実行サンプルは以下の通り

```
denvp 8000:8000 npm run serve
```

## denvdbコマンド

```
denvdb
```

* MySQLを起動させる。
* `~/.devenvnrion/mysql_data`のフォルダを永続先として起動する。
* denv内からは`denv.host`と指定することでアクセス可能。
* ID、Passwordのデフォルトはroot、password。
* sqlalchemyの接続文字列は以下の通り。

```
mysql+pymysql://root:password@denv.host/db?charset=utf8
```

* cliツールは以下の通り

```
mycli -h denv.host -u root -p password 
```

## コマンド関連図

<img src='img/commands.svg'>
