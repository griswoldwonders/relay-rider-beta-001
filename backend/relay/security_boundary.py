"""Startup guard for the dev-only auth boundary described in
docs/SECURITY_ARCHITECTURE.md and SECURITY.md.

This backend currently ships with DEBUG=True and DRF's global AllowAny
permission (see settings.py) because there is no real participant
authentication system yet. That is only safe while the server is bound to
localhost. If ALLOWED_HOSTS is ever widened to a public host while the
insecure dev configuration (DEBUG=True or AllowAny) is still active, the
process must refuse to start rather than silently serve an unauthenticated
API to the public internet.
"""

from django.core.exceptions import ImproperlyConfigured

LOCAL_ONLY_HOSTS = {'localhost', '127.0.0.1', '[::1]'}


def assert_dev_boundary_safe(debug, default_permission_classes, allowed_hosts):
    """Raise ImproperlyConfigured if an insecure dev config is exposed publicly.

    `debug` -- settings.DEBUG
    `default_permission_classes` -- settings.REST_FRAMEWORK['DEFAULT_PERMISSION_CLASSES']
    `allowed_hosts` -- settings.ALLOWED_HOSTS
    """
    allow_any_active = 'rest_framework.permissions.AllowAny' in (default_permission_classes or [])
    insecure_dev_config = bool(debug) or allow_any_active

    if not insecure_dev_config:
        return

    hosts = set(allowed_hosts or [])
    public_hosts = hosts - LOCAL_ONLY_HOSTS
    if not public_hosts:
        return

    raise ImproperlyConfigured(
        "Refusing to start: DEBUG=True and/or DRF's default permission is "
        "AllowAny (this backend has no real participant authentication yet -- "
        "see docs/SECURITY_ARCHITECTURE.md), but ALLOWED_HOSTS includes "
        f"non-local host(s): {sorted(public_hosts)}. Restrict ALLOWED_HOSTS to "
        "localhost/127.0.0.1 for local development, or set DEBUG=False and a "
        "real DRF permission class before serving a public host."
    )
