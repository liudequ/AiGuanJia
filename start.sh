#!/usr/bin/env bash
set -euo pipefail

ELECTRON_DISABLE_SANDBOX=1 \
ELECTRON_OZONE_PLATFORM_HINT=wayland \
npm start -- --ozone-platform=wayland --disable-vulkan --disable-gpu --enable-features=UseOzonePlatform --disable-features=VaapiVideoDecoder
