from django.apps import AppConfig


class CommonConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.common"

    def ready(self):
        self._watch_env_file()

    def _watch_env_file(self):
        """Restart runserver when .env changes, the way it does for code.

        django-environ reads .env once, at import. The autoreloader watches
        .py files and nothing else, so editing .env never reaches a running
        server - it keeps every value it started with, silently.

        That failure is unusually good at wasting an afternoon, because
        nothing looks wrong. Mail quietly keeps using the console backend, an
        API key stays empty and every scan "is not configured", a bucket name
        stays unset and uploads keep landing on local disk. The settings are
        correct; the process just never read them.

        The autoreloader only runs under runserver, so this does nothing in
        production.
        """
        from django.conf import settings
        from django.dispatch import receiver
        from django.utils.autoreload import autoreload_started

        env_file = settings.BASE_DIR / ".env"

        # weak=False matters. This receiver is a local function, so once this
        # method returns nothing holds a reference to it - and Django's
        # default weak connection lets it be collected and silently
        # disconnected. It then works or does not depending on when garbage
        # collection happens to run, which is the worst of both.
        @receiver(autoreload_started, dispatch_uid="common.watch_env_file", weak=False)
        def _watch(sender, **kwargs):
            # `extra_files`, not a watch_file() call: BaseReloader exposes the
            # set directly and has no such method in this version of Django.
            sender.extra_files.add(env_file)
