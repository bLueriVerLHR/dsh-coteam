#!/usr/bin/env bash
# 把 coteam 的预设安装进 dsh 的用户预设根（${DSH_HOME:-~/.dsh}/.agent-presets）。
#
# 为什么是复制而不是 bundle patch / 符号链接：
# - rc.7 的 dsh 启动器（apps/cli composeProfile）会在所有 patch 层之后追加一个
#   overlay，把 agent-presets 行的 roots 无条件覆写成 [部署自带根]。任何 bundle
#   patch 写入的 roots 都会在启动时被抹掉——bundle 层无法注册预设根。
# - 运行时真正生效的可写根只有 includeUserRoot 追加的用户根。
# - scanRoot 用 readdir(withFileTypes) 只认 isDirectory()，符号链接会被跳过，
#   所以必须放真实目录。
#
# 发现逻辑每次 list() 都重读磁盘：改完仓库里的预设后重跑本脚本即可生效，
# 无需重启 dsh web（设置页面刷新一次即可看到最新名单）。
#
# 用法：
#   bash install.sh            # 安装（默认动作，幂等：先删后拷，结果一致）
#   bash install.sh uninstall  # 卸载（只删除本包安装的目录，不影响其他预设）
#   bash install.sh -h         # 显示本帮助
set -euo pipefail

src="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
dest="${DSH_HOME:-$HOME/.dsh}/.agent-presets"

usage() {
  sed -n '2,18p' "$0"  # 打印脚本头部的说明（含用法）
}

do_install() {
  mkdir -p "$dest"
  for preset in team-leader team-member; do
    if [ ! -f "$src/$preset/agent.cordis.yml" ]; then
      echo "missing $src/$preset/agent.cordis.yml" >&2
      exit 1
    fi
    # 幂等：先删后拷，重复安装得到相同结果。
    rm -rf "$dest/$preset"
    cp -R "$src/$preset" "$dest/$preset"
    echo "installed: $dest/$preset"
  done
}

do_uninstall() {
  for preset in team-leader team-member; do
    if [ -d "$dest/$preset" ]; then
      rm -rf "$dest/$preset"
      echo "uninstalled: $dest/$preset"
    else
      echo "not installed: $dest/$preset"
    fi
  done
}

case "${1:-install}" in
  install) do_install ;;
  uninstall) do_uninstall ;;
  -h|--help|help) usage ;;
  *)
    echo "unknown command: ${1:-}" >&2
    usage >&2
    exit 1
    ;;
esac
