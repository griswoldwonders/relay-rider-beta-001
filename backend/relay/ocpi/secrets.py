"""Interface for where OCPI/production credentials WOULD come from.

This module defines the interface only. It intentionally contains no
real Vault/KMS integration and no real-looking production secrets --
see docs/OCPI_PRODUCTION_SECURITY_AND_SESSION_LINKING.md for the
production credential-storage design this interface stands in for
(envelope encryption, token records with partnerId/tokenVersion/
ciphertextRef/fingerprint, HSM/KMS-backed mTLS key storage, etc).

Nothing in this repository implements that production backend. Wiring
a real SecretProvider to Vault/KMS/a certificate manager is listed as
a remaining production blocker in this task's final report.
"""

from __future__ import annotations

import abc
import os
from typing import Tuple


class SecretProvider(abc.ABC):
    """Abstract interface for where OCPI credentials tokens and mTLS
    certificate material are retrieved from in production (e.g.
    HashiCorp Vault, a cloud KMS-backed secrets manager, or a
    certificate-manager-mounted file with filesystem mode 0600).

    No implementation of this interface should ever log, return in an
    API response, or persist plaintext secret material outside of
    process memory. See relay/ocpi/redaction.py for the logging
    safeguard used everywhere a payload touching this boundary is
    logged.
    """

    @abc.abstractmethod
    def get_provider_credentials_token(self, partner_id: str) -> str:
        """The OCPI credentials token *received from* the provider,
        used to authenticate their inbound calls to Relay Rider."""

    @abc.abstractmethod
    def get_outbound_credentials_token(self, partner_id: str) -> str:
        """The OCPI credentials token Relay Rider *sends to* the
        provider when calling their endpoints."""

    @abc.abstractmethod
    def get_mtls_cert_chain(self, partner_id: str) -> Tuple[bytes, bytes, bytes]:
        """Returns (cert_pem, key_pem, ca_pem) for optional mTLS."""


class LocalDevSecretProvider(SecretProvider):
    """DEV-ONLY stand-in. Reads from local environment variables that
    are expected to be UNSET in normal development -- in which case
    every method raises rather than silently returning a fabricated
    value. This class must never be pointed at a real production
    secrets store and must never be used to source real production
    credentials; it exists only so local/sandbox integration testing
    has *somewhere* to read a token from without hardcoding one.
    """

    def _env_or_raise(self, name: str) -> str:
        value = os.environ.get(name)
        if not value:
            raise RuntimeError(
                f'{name} is not set. LocalDevSecretProvider is a dev-only stub; '
                'production deployments must supply a real SecretProvider backed '
                'by Vault/KMS (see docs/OCPI_PRODUCTION_SECURITY_AND_SESSION_LINKING.md), '
                'never this class.'
            )
        return value

    def get_provider_credentials_token(self, partner_id: str) -> str:
        return self._env_or_raise(f'OCPI_DEV_INBOUND_TOKEN__{partner_id}')

    def get_outbound_credentials_token(self, partner_id: str) -> str:
        return self._env_or_raise(f'OCPI_DEV_OUTBOUND_TOKEN__{partner_id}')

    def get_mtls_cert_chain(self, partner_id: str) -> Tuple[bytes, bytes, bytes]:
        raise NotImplementedError(
            'LocalDevSecretProvider does not provide mTLS material. Production '
            'must supply a certificate-manager/KMS-backed SecretProvider.'
        )


class TestSecretProvider(SecretProvider):
    """In-memory stand-in for automated tests only. Values are supplied
    by the caller (e.g. certificates generated at test time -- see
    relay/ocpi/tests/test_certs.py) and are never committed to source
    control or reused outside the test process.
    """

    def __init__(self, tokens: dict | None = None, cert_chain: Tuple[bytes, bytes, bytes] | None = None):
        self._tokens = tokens or {}
        self._cert_chain = cert_chain

    def get_provider_credentials_token(self, partner_id: str) -> str:
        return self._tokens.get(('inbound', partner_id), 'test-inbound-token')

    def get_outbound_credentials_token(self, partner_id: str) -> str:
        return self._tokens.get(('outbound', partner_id), 'test-outbound-token')

    def get_mtls_cert_chain(self, partner_id: str) -> Tuple[bytes, bytes, bytes]:
        if self._cert_chain is None:
            raise NotImplementedError('No test certificate chain configured for TestSecretProvider')
        return self._cert_chain
