#!/usr/bin/env bash
# First-time publish to github.com/touchbridge2026/touchbridge2026.github.io
# Prerequisite: the organization "touchbridge2026" and an EMPTY public repo "touchbridge2026.github.io" exist.
# Optional: SSH_KEY=~/.ssh/id_ed25519_touchbridge bash publish.sh   (to use a specific key)
set -e
cd "$(dirname "$0")"
if [ ! -d .git ]; then
  git init -b main
  git remote add origin git@github.com:touchbridge2026/touchbridge2026.github.io.git
fi
if [ -n "$SSH_KEY" ]; then git config core.sshCommand "ssh -i $SSH_KEY -o IdentitiesOnly=yes"; fi
git add -A
git commit -m "Publish TouchBridge project page" || true
git push -u origin main
echo
echo "Pushed. Site: https://touchbridge2026.github.io/ (live in 1-2 minutes)"
echo "If it 404s, check https://github.com/touchbridge2026/touchbridge2026.github.io/settings/pages"
