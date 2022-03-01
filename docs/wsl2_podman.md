# WSL2 + Podman

## WSL2のインストール

https://docs.microsoft.com/ja-jp/windows/wsl/install

## Chocolateyのインストール

https://chocolatey.org/install

## Windows Terminalのインストール

```
choco install microsoft-windows-terminal
```

### 初期設定

初回はメニューより、ubutuの起動を行う。  
terminalの設定で、開始ディレクトリを以下のように設定する。

```
¥¥wsl$¥Ubuntu-20.04¥home¥<userid>
```

### Nameserverの修正

* resolv.confの削除

```
rm /etc/resolv.conf
```

* /etc/wsl.confの作成

```
[network]
generateResolvConf = false
```

* /etc/resolv.confの作成

```
nameserver 8.8.8.8
```

## Podmanのインストール

```
cat /etc/os-release
sudo sh -c "echo 'deb http://download.opensuse.org/repositories/devel:/kubic:/libcontainers:/stable/x${NAME}_${VERSION_ID}/ /' > /etc/apt/sources.list.d/devel:kubic:libcontainers:stable.list"
wget -nv https://download.opensuse.org/repositories/devel:kubic:libcontainers:stable/x${NAME}_${VERSION_ID}/Release.key -O Release.key
sudo apt-key add - < Release.key
sudo apt-get update -qq
sudo apt-get -qq -y install podman
sudo mkdir -p /etc/containers
echo -e "[registries.search]\nregistries = ['docker.io', 'quay.io']" | sudo tee /etc/containers/registries.conf
```
