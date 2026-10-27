#!/usr/bin/env bash
# Instala en el CI los navegadores de Playwright o sus paquetes del sistema, a prueba de un espejo de
# apt colgado (PLAN fase 4, tarea 1). El de Ubuntu en Azure se quedó parado, o a cuentagotas, en
# cuatro CI de `main` el 27-10, hasta el límite de 10 min. Cada intento tiene su tiempo límite, y
# hay hasta 3:
# - `timeout` corta npx, pero no el apt-get que Playwright lanza con sudo, que va en su propia
#   sesión y se queda con el bloqueo de dpkg: se cierra aparte, y dpkg termina lo que hubiera
#   quedado a medias;
# - del segundo intento en adelante, apt usa archive.ubuntu.com en lugar del espejo de Azure.
#
# Uso: bash scripts/ci-playwright.sh <segundos por intento> <argumentos de `npx playwright`>
#      bash scripts/ci-playwright.sh 180 install-deps chromium webkit
set -uo pipefail

limit=$1
shift
for attempt in 1 2 3; do
  timeout -k 15 "$limit" npx playwright "$@" && exit 0
  echo "::warning title=Instalación cortada::Intento $attempt de 3 sin terminar en $limit s."
  sudo pkill -TERM -x apt-get || true
  sleep 3
  sudo pkill -KILL -x apt-get || true
  sudo dpkg --configure -a || true
  sudo sed -i 's#http://azure.archive.ubuntu.com/ubuntu#http://archive.ubuntu.com/ubuntu#g' \
    /etc/apt/sources.list.d/*.sources || true
done
exit 1
