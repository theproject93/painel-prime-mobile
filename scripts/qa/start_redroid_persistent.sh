#!/usr/bin/env bash
set -euo pipefail

name="painel-prime-redroid"
serial="127.0.0.1:5555"

sudo modprobe binder_linux devices="binder,hwbinder,vndbinder" 2>/dev/null || true
if [[ ! -c /dev/binder ]]; then
  sudo mkdir -p /dev/binderfs
  if ! mountpoint -q /dev/binderfs; then
    sudo mount -t binder binder /dev/binderfs 2>/dev/null || true
  fi
  for device in binder hwbinder vndbinder; do
    if [[ -e "/dev/binderfs/$device" ]]; then
      sudo ln -sfn "/dev/binderfs/$device" "/dev/$device"
    fi
  done
fi

if docker container inspect "$name" >/dev/null 2>&1; then
  docker update --restart always "$name" >/dev/null
  docker start "$name" >/dev/null || true
else
  docker run --detach --name "$name" --restart always --privileged --memory 4g \
    --publish "$serial:5555" --volume painel-prime-redroid-data:/data \
    redroid/redroid:12.0.0-latest \
    androidboot.hardware=mt6833 ro.secure=0 ro.boot.hwc=DRM_HWC \
    ro.opengles.version=196610 redroid.width=1080 redroid.height=2400 \
    redroid.fps=60 redroid.dpi=400 >/dev/null
fi

for attempt in $(seq 1 90); do
  adb connect "$serial" >/dev/null 2>&1 || true
  if [[ "$(adb -s "$serial" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == "1" ]]; then
    docker inspect --format 'Contêiner: {{.State.Status}} | Reinício: {{.HostConfig.RestartPolicy.Name}}' "$name"
    adb -s "$serial" devices -l
    exit 0
  fi
  sleep 2
done

docker logs --tail 80 "$name" >&2 || true
echo "ReDroid permanente não concluiu a inicialização." >&2
exit 1
