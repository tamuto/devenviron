# 開発環境用Dockerイメージ

ECMAScript + Pythonの開発に必要なツール群を入れたDockerイメージのプロジェクト

## 使い方

* まず、Dockerイメージをpullします。

```shell
docker pull tamuto/devenviron:latest
```

* 次に以下のようなスクリプトを作成し、パスを通しておきます。(サンプルとしてはnpm run xxxで実行するケース)
* そうすることで環境を汚染することなく、共通した開発環境として利用できます。

```bash
docker run --rm -it -v $PWD:$PWD -v /var/run/docker.sock:/var/run/docker.sock -w $PWD tamuto/devenviron -c "npm run ${@:2}
```

## インストールされるソフトウェア

* python 3.9
* poetry
* ansible
* awscli
* twine
* python-dotenv
* sudachi-py
* build-essential
* git
* docker
* sqlite3
* nodejs
* npm
* Terraform

## 内部資料

```
docker build -t tamuto/devenviron:vX.X.X .
docker tag tamuto/devenviron:latest tamuto/devenviron:vX.X.X
docker push tamuto/devenviron:vX.X.X
docker push tamuto/devenviron:latest
```
