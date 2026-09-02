#!/usr/bin/env bash
#
# Adds a swap file to a VPS that has none.
#
# 2 GB of RAM has to hold Postgres, a Node server, a Next server and nginx. It
# fits — but with no swap there is no margin at all: the moment a request spikes
# past what is free, the kernel's OOM killer picks a process and the shop goes
# down rather than getting slower. Swap turns that cliff into a slope.
#
# Not a substitute for more RAM, and not where a database wants to live, hence
# swappiness=10: use it under real pressure, not as a matter of routine.
#
# Idempotent. Run as root:  sudo bash scripts/setup-swap.sh

set -euo pipefail

SWAPFILE=/swapfile
SIZE=2G
SWAPPINESS=10

if [[ $EUID -ne 0 ]]; then
  echo "Run as root: sudo bash $0" >&2
  exit 1
fi

if swapon --show --noheadings | grep -q .; then
  echo "Swap is already active — leaving it alone:"
  swapon --show
  exit 0
fi

if [[ -e $SWAPFILE ]]; then
  echo "$SWAPFILE already exists but is not in use. Inspect it yourself rather" >&2
  echo "than letting this script overwrite a file it did not create." >&2
  exit 1
fi

available=$(df --output=avail -BG / | tail -1 | tr -dc '0-9')
if (( available < 5 )); then
  echo "Only ${available}G free on / — refusing to claim 2G of it." >&2
  exit 1
fi

echo "Creating ${SIZE} swap at ${SWAPFILE}…"
fallocate -l "$SIZE" "$SWAPFILE" || dd if=/dev/zero of="$SWAPFILE" bs=1M count=2048 status=progress
chmod 600 "$SWAPFILE"
mkswap "$SWAPFILE"
swapon "$SWAPFILE"

# Survive a reboot.
if ! grep -q "^${SWAPFILE} " /etc/fstab; then
  printf '%s none swap sw 0 0\n' "$SWAPFILE" >> /etc/fstab
  echo "Added ${SWAPFILE} to /etc/fstab."
fi

sysctl -w "vm.swappiness=${SWAPPINESS}"
if ! grep -q '^vm.swappiness' /etc/sysctl.d/99-imix.conf 2>/dev/null; then
  echo "vm.swappiness=${SWAPPINESS}" >> /etc/sysctl.d/99-imix.conf
fi

echo
free -h
