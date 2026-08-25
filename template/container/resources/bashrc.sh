# devenviron が用意する共通のシェル設定。
#
# /etc/devenviron/bashrc.sh として配置し、/root/.bashrc の末尾から読み込む。
# 対話シェルでのみ読まれる。非対話実行でも必要な PATH は Dockerfile の ENV が持つ。
#
# 利用者個人の設定はここではなく ~/.bashrc や ~/.bash_aliases へ書くこと。
# このファイルはイメージを作り直すと元に戻る。

# voltaのPATHはDockerfileのENVと、voltaのインストーラが.bashrcへ追記する分でも
# 通っている。ここは、それらを持たない環境向けのフォールバックとして残す。
# 無条件にprependすると対話シェルでPATHへ同じ要素が何度も積まれるため、
# 既に通っている場合は何もしない。
export VOLTA_HOME="${VOLTA_HOME:-$HOME/.volta}"
case ":$PATH:" in
    *":$VOLTA_HOME/bin:"*) ;;
    *) export PATH="$VOLTA_HOME/bin:$PATH" ;;
esac

if [ -e /etc/bash_completion.d/git-prompt ]; then
    source /etc/bash_completion.d/git-prompt
    PS1='\[\e]0;\w\a\]${debian_chroot:+($debian_chroot)}\[\033[01;34m\]\w\[\033[00m\]$(__git_ps1 " (%s)") \n\$ '
fi
# bash-completionは導入していないベースイメージもあるため、存在確認してからsourceする。
# (無条件にsourceするとシェル起動のたびにエラーが出る)
#
# Debianの/etc/bash.bashrcはbash-completionを読み込む箇所がコメントアウトされており、
# パッケージを入れるだけでは有効にならない。そのためここで明示的に読み込む。
# フレームワークを読み込めばcompletions/配下は遅延ロードされるので、
# gitだけを個別にsourceする必要はなくなる。
# フレームワークが無い場合に備えて、git単体のフォールバックは残す。
if [ -e /usr/share/bash-completion/bash_completion ]; then
    source /usr/share/bash-completion/bash_completion
elif [ -e /usr/share/bash-completion/completions/git ]; then
    source /usr/share/bash-completion/completions/git
fi
set -o noclobber

alias ncu='pnpx npm-check-updates'
