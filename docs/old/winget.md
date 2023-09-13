# Winget利用のセットアップ

## Ubuntuの設定

* コマンドプロンプトを管理者権限付きで起動させる。
* 以下のコマンドを実行する。（ubuntuのUNIX usernameおよびpasswordを設定する。）

```shell
winget install Canonical.Ubuntu.2204
ubuntu run exit
```

## Windows Terminalのインストール

```
winget install Microsoft.WindowsTerminal
```

* ターミナルをインストール後にUbuntuを開く
* Ubuntuを開いた後には、更新処理を行う

```
sudo apt-get update
sudo apt-get upgrade
```

## Podmanのインストール

* 以下のコマンドを実行する。

```
. /etc/os-release
sudo sh -c "echo 'deb http://download.opensuse.org/repositories/devel:/kubic:/libcontainers:/stable/x${NAME}_${VERSION_ID}/ /' > /etc/apt/sources.list.d/devel:kubic:libcontainers:stable.list"
wget -nv https://download.opensuse.org/repositories/devel:kubic:libcontainers:stable/x${NAME}_${VERSION_ID}/Release.key -O Release.key
sudo apt-key add - < Release.key
sudo apt-get update -qq
sudo apt-get -qq -y install podman
sudo mkdir -p /etc/containers
echo -e "[registries.search]\nregistries = ['docker.io', 'quay.io']" | sudo tee /etc/containers/registries.conf
```
