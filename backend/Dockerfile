FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=config.settings.production

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements/ requirements/
RUN pip install --no-cache-dir -r requirements/prod.txt

COPY . .

# Build-only placeholders so Django can boot to run collectstatic - it never
# opens the database, just needs DATABASES to parse, and never needs a real
# secret key, just *a* key. Scoped to this one RUN line only (not an ENV
# directive), so the real values the host supplies at container runtime are
# never shadowed by these - if the host forgets to set one, the container
# fails loudly on boot instead of silently running on a placeholder.
RUN DJANGO_SECRET_KEY=build-only-placeholder-not-used-at-runtime \
    DATABASE_URL=postgres://build:build@localhost:5432/build \
    python manage.py collectstatic --noinput

COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 8000
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3"]
