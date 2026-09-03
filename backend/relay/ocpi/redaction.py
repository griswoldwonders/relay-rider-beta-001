"""Redaction utility for any logging in OCPI/adapter code.

Any code under relay/ocpi/ that logs a payload, header, or error
detail must pass it through redact_for_log() (or
redact_pem_like_string() for free text) first. This is defense-in-
depth against accidentally logging provider credentials, mTLS private
key/certificate material, OCPI tokens, or participant identifiers
(e.g. VIN) in plaintext -- see SECURITY.md and
docs/OCPI_PRODUCTION_SECURITY_AND_SESSION_LINKING.md ("the application
... never logs the plaintext").
"""

from __future__ import annotations

import re
from typing import Any

_SECRET_KEY_PATTERN = re.compile(
    r'(authorization|token|secret|password|cert|private[_-]?key|pem|vin|api[_-]?key|ciphertext)',
    re.IGNORECASE,
)
_REDACTED = '***REDACTED***'


def _redact_value(key: str, value: Any) -> Any:
    if isinstance(value, dict):
        return redact_for_log(value)
    if isinstance(value, (list, tuple)):
        return [_redact_value(key, item) for item in value]
    if isinstance(key, str) and _SECRET_KEY_PATTERN.search(key):
        return _REDACTED
    return value


def redact_for_log(payload: Any) -> Any:
    """Returns a redacted copy of a dict-like payload: any key that
    looks like a credential, token, certificate, private key, VIN, or
    API key (case-insensitive, nested) has its value replaced with a
    fixed redaction marker. Non-dict input is returned unchanged --
    callers are expected to pass a mapping (e.g. serializer.errors,
    a parsed JSON body, or a headers dict).
    """
    if not isinstance(payload, dict):
        return payload
    return {key: _redact_value(key, value) for key, value in payload.items()}


def redact_pem_like_string(text: str) -> str:
    """Belt-and-suspenders: strip anything shaped like a PEM block out
    of a free-text log line, even if it did not arrive under a
    recognizably named key.
    """
    return re.sub(r'-----BEGIN [^-]+-----.*?-----END [^-]+-----', _REDACTED, text, flags=re.DOTALL)
