#!/bin/sh
# Applies pending migrations before the app starts - safe to run on every
# container boot, Django only applies what's new each time.
#
# Exactly one service may do this. Two containers starting together race to
# apply the same migrations, and the loser fails on a table that now exists or
# deadlocks against the winner's DDL. The web service owns migrations; the
# worker sets RUN_MIGRATIONS=0 and waits for the schema the web service
# applies. Scaling the web service past one instance reintroduces the race and
# wants a one-off release/pre-deploy step instead.
set -e

if [ "${RUN_MIGRATIONS:-1}" = "1" ]; then
    python manage.py migrate --noinput
else
    echo "RUN_MIGRATIONS=0 - skipping migrations, another service owns them."
fi

exec "$@"
