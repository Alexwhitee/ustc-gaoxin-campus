#!/usr/bin/env bash
# 可选：本地构建 Linux 产物，经 SSH 发布到已配置 systemd 的服务器。
# 首次安装见 README；默认构建 linux/amd64，ARM 服务器需指定 PLATFORM。
set -euo pipefail
cd "$(dirname "$0")"
SERVER="${1:-${SERVER:-}}"
if [[ ! "$SERVER" =~ ^[a-zA-Z0-9_][a-zA-Z0-9_@.-]*$ ]]; then
  echo "用法：PLATFORM=linux/amd64 ./deploy.sh user@server（或 SSH 配置别名）" >&2
  exit 1
fi
PLATFORM="${PLATFORM:-linux/amd64}"
RELEASE="$(date -u +%Y%m%dT%H%M%SZ)-$$"
ARTIFACT="$(mktemp -d)"
CONTAINER=""
cleanup() {
  if [[ -n "$CONTAINER" ]]; then docker rm "$CONTAINER" >/dev/null; fi
  rm -rf "$ARTIFACT"
}
trap cleanup EXIT

# Docker 构建不会覆盖宿主机的 node_modules、.next 或数据库。
docker build --platform "$PLATFORM" \
  --build-arg "NEXT_PUBLIC_CAMPUS=${NEXT_PUBLIC_CAMPUS:-jlu}" \
  --build-arg "NEXT_PUBLIC_QQ_GROUP_URL=${NEXT_PUBLIC_QQ_GROUP_URL:-}" \
  -t "jluai:release-$RELEASE" .
CONTAINER="$(docker create --platform "$PLATFORM" "jluai:release-$RELEASE")"
docker cp "$CONTAINER:/app/." "$ARTIFACT/"

# 只写入全新 release，不对运行中的代码执行 rsync --delete。
ssh "$SERVER" "mkdir -p /opt/jluai/releases/$RELEASE"
rsync -az -e ssh "$ARTIFACT/" "$SERVER:/opt/jluai/releases/$RELEASE/"
ssh "$SERVER" bash -s -- "$RELEASE" <<'REMOTE'
set -euo pipefail
release="/opt/jluai/releases/$1"
current=/opt/jluai/src
if [[ -e "$current" && ! -L "$current" ]]; then
  echo '/opt/jluai/src 仍是目录；请先按 README 将旧版本迁入 releases。' >&2
  exit 1
fi
previous="$(readlink "$current" || true)"
staged="/opt/jluai/src.$1"
mkdir -p "$release/.next/cache"
chown -R jluai:jluai "$release"
ln -s "$release" "$staged"
mv -Tf "$staged" "$current"
if systemctl restart jluai; then
  for attempt in {1..30}; do
    if systemctl is-active --quiet jluai && curl -fsS --max-time 2 http://127.0.0.1:3000/api/health; then
      echo "发布成功：$release"
      exit 0
    fi
    sleep 1
  done
fi
echo '新版本未通过健康检查，恢复原代码。' >&2
if [[ -n "$previous" ]]; then
  ln -s "$previous" "$staged"
  mv -Tf "$staged" "$current"
  systemctl restart jluai
else
  systemctl stop jluai
fi
exit 1
REMOTE
