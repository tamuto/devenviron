# WSL2 Setup

* Chocolatetyをベースにしたドキュメント
* WSL2

```
choco install wsl2
choco install wsl-ubuntu-2004
choco install microsoft-windows-terminal
```

初回はメニューより、ubutuの起動を行う。

terminalの設定で、開始ディレクトリを以下のように設定する。

```
¥¥wsl$¥Ubuntu-20.04¥home¥<userid>
```

* /etc/wsl.conf

```
[network]
generateResolvConf = false
```

* /etc/resolv.conf

```
nameserver 8.8.8.8
```

** 保存できない場合には、先に消す。

```
rm /etc/resolv.conf
```


sudo visudo
が良い。