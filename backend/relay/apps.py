from django.apps import AppConfig


class RelayConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'relay'

    def ready(self):
        from django.conf import settings

        from . import rule2202_models  # noqa: F401
        from .security_boundary import assert_dev_boundary_safe

        assert_dev_boundary_safe(
            settings.DEBUG,
            settings.REST_FRAMEWORK.get('DEFAULT_PERMISSION_CLASSES'),
            settings.ALLOWED_HOSTS,
        )
