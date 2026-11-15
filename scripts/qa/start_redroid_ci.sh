#!/usr/bin/env bash
set -euo pipefail

name="painel-prime-redroid-ci"
serial="127.0.0.1:5555"

if docker inspect painel-prime-redroid >/dev/null 2>&1; then
  for attempt in $(seq 1 90); do
    adb connect "$serial" >/dev/null 2>&1 || true
    if [[ "$(adb -s "$serial" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == "1" ]]; then
      echo "Reutilizando ReDroid permanente da KIRO."
      adb -s "$serial" devices -l
      exit 0
    fi
    sleep 2
  done
  echo "ReDroid permanente indisponível para o CI." >&2
  exit 1
fi

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

docker rm -f "$name" >/dev/null 2>&1 || true
docker run --detach --rm --name "$name" --privileged --memory 4g \
  --publish "$serial:5555" \
  redroid/redroid:12.0.0-latest \
  androidboot.hardware=mt6833 ro.secure=0 ro.boot.hwc=DRM_HWC \
  ro.opengles.version=196610 redroid.width=1080 redroid.height=2400 \
  redroid.fps=60 redroid.dpi=400 >/dev/null

for attempt in $(seq 1 90); do
  adb connect "$serial" >/dev/null 2>&1 || true
  if [[ "$(adb -s "$serial" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == "1" ]]; then
    adb -s "$serial" devices -l
    exit 0
  fi
  sleep 2
done

docker logs --tail 80 "$name" >&2 || true
echo "ReDroid de CI não concluiu a inicialização." >&2
exit 1
