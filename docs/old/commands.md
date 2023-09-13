# コマンド一覧

| コマンド          | 説明                                                                                      |
| ----------------- | ----------------------------------------------------------------------------------------- |
| denv              | 開発環境を常駐させる。VSCodeのDev Containerで接続して開発する場合に常駐させる。           |
| denvsh            | 常駐している開発環境のbashを起動させる。                                                  |
| denvcli           | 旧denvコマンド。開発環境を起動する。DevContainerを使用しない場合はこちらを実行する。      |
| denvp             | denvcliコマンドのポート開放版。サーバを起動させる場合に使用する。                         |
| denvdb            | MySQLを起動する。denvdb5、denvdb8のいずれかのシンボリックリンク。                         |
| denvdb5           | MySQL:5のイメージで起動する。                                                             |
| denvdb8           | MySQL:8のイメージで起動する。                                                             |
| denv_clear_podman | Podmanのエラーでerror joining network namespace for containerが出力する際の復旧コマンド。 |
| denvnote          | jypyter notebookを起動する。                                                              |

## denvcliコマンド

```
denvcli <コマンド>
```

* 通常は引数を指定しない状態で起動させる。
* ワンライナーとして起動したい場合には`denv`の後にコマンドを指定する。

## denvpコマンド

```
denvp <ポート番号> <コマンド>
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
denvdb5
denvdb8
```

* MySQLを起動させる。
* `~/.devenvnrion/mysql_data5`または`~/.devenvnrion/mysql_data8`のフォルダを永続先として起動する。
* denv内からは`denv.host`と指定することでアクセス可能。
* ID、Passwordのデフォルトはroot、password。
* sqlalchemyの接続文字列は以下の通り。

```
mysql+pymysql://root:password@denv.host/db?charset=utf8
```

* cliツールは以下の通り

```
mysql -h denv.host -u root -p password 
```

## denvnoteコマンド

### 環境構築

* 以下のコマンドをdenv環境内でjupyter notebookの環境を構築します。
  * `infodb-cli nbenv`の詳細はこちら

```
cd <ワークフォルダ>
infodb-cli nbenv
```

### 必要なライブラリの追加

```
poetry add <ライブラリ>
```

### Jupyter Notebookの起動

* denv環境の外から以下のコマンドを実行する。

```
denvnote port notebook-options
```

* jupyter notebookを起動させる。
* 起動した時のフォルダをルートとして扱う。
* 1つ目の引数は待ち受けポート
* 2つ目以降のオプションはjupyter notebookのオプション。（必要に応じて指定する。）
* 停止させる時には`podman stop jupyter`のコマンドを入力する。

## コマンド関連図

<img src='img/commands.svg'>
