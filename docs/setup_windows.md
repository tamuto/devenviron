# Windows環境のセットアップ

## WSL2のセットアップ

```
wsl --install Ubuntu-22.04
```

- インストール後にデフォルトユーザをrootに変更する。
  - エクスプローラーでファイルを参照した際にrootユーザでアクセスが可能となる。
  - dockerコンテナ内で開発をするためファイルオーナーがrootになるので。

```PowerShell
ubuntu2204 config --default-user root
```

## Dockerのセットアップ

- ubuntu内で以下のコマンドを実行する。（rootユーザでの実行を想定）

```sh
apt update
apt upgrade
apt install ca-certificates curl gnupg lsb-release
mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

apt update
apt install docker-ce docker-ce-cli containerd.io
```

## 開発用フォルダの作成

`/root/workspaces`に開発用フォルダを作成する。(フォルダ名やパスは任意)

```sh
mkdir ~/workspaces
```

## セットアップスクリプトの実行

作成した開発フォルダへ移動を行いセットアップコマンドを実行する。

```sh
cd ~/workspaces
curl -H 'Accept: application/vnd.github.raw' https://api.github.com/repos/tamuto/devenviron/contents/setup.sh | sh
```

## VSCodeの起動

セットアップを実行したフォルダでVSCodeを起動する。
VSCodeにWSLとDevContainerの拡張機能がインストールされていれば、`Reopen in Container`が表示されるのでクリックする。
※表示されなければ、拡張機能のインストールを行う。また、コマンドパレットから同名のコマンドを実行する。
時間はかかるが、VSCode内でWORKSPACES [DEV CONTAINER:DENV]と表示されれば成功。

```sh
code .
```
