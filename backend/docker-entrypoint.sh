#!/bin/sh
# Applies pending migrations before the app starts serving traffic - safe to
# run on every container boot, Django only applies what's new each time.
#
# Single-instance only: two containers starting at once would race to run
# the same migrations. Fine for one web instance (this project's current
# deploy shape); a multi-instance deploy should move this to a one-off
# release/pre-deploy step instead.
set -e

python manage.py migrate --noinput

exec "$@"
