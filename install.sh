#!/usr/bin/env bash
# 把 dsh-coteam 的预设安装进 dsh 的用户预设根（${DSH_HOME:-~/.dsh}/.agent-presets）。
#
# 推荐安装方式是 Cordis bundle 插件（src/index.js 在 host 启动时自动同步，
# 支持升级自动刷新），本脚本是**零 npm 依赖的降级路径**：
#   dsh plugin --profile web add @blueriverlhr/dsh-coteam    # 首选
#   bash install.sh                                          # 无 npm / 不想装插件时
#
# 与插件同步逻辑一致的约定：
# - 目标根是 includeUserRoot 追加的用户根，运行时始终被扫描。
# - scanRoot 用 readdir(withFileTypes) 只认 isDirectory()，符号链接会被跳过，
#   所以必须放真实目录。
# - 发现逻辑每次 list() 都重读磁盘：改完仓库里的预设后重跑本脚本即可生效，
#   无需重启 dsh web（设置页面刷新一次即可看到最新名单）。
#
# 用法：
#   bash install.sh            # 安装（默认动作，幂等：先删后拷，结果一致）
#   bash install.sh uninstall  # 卸载（只删除本包安装的目录，不影响其他预设）
#   bash install.sh -h         # 显示本帮助
set -euo pipefail

src="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
dest="${DSH_HOME:-$HOME/.dsh}/.agent-presets"
presets_dir="$src/presets"

usage() {
  sed -n '2,21p' "$0"  # 打印脚本头部的说明（含用法）
}

do_install() {
  if [ ! -d "$presets_dir" ]; then
    echo "missing preset dir: $presets_dir" >&2
    exit 1
  fi
  mkdir -p "$dest"
  for preset in team-leader team-member; do
    if [ ! -f "$presets_dir/$preset/agent.cordis.yml" ]; then
      echo "missing $presets_dir/$preset/agent.cordis.yml" >&2
      exit 1
    fi
    # 幂等：先删后拷，重复安装得到相同结果。
    rm -rf "$dest/$preset"
    cp -R "$presets_dir/$preset" "$dest/$preset"
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
