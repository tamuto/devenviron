# Mac環境におけるDocker

## lima + docker

rootless dockerだとmySQLのdataの永続化ができない。
dockerを落としたら消える。

dockerで実行の場合でもsudo suした後にdockerでlima上の/root/あたりのフォルダを指定すると起動できる。
→課題化

## Podman

ボリュームマウントがMacOS上のもので設定できなかった。NG。
