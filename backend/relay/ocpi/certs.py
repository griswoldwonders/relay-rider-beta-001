"""Pure, testable certificate validation functions for the mTLS
identity check described in
docs/OCPI_PRODUCTION_SECURITY_AND_SESSION_LINKING.md ("Use a
certificate whose subject or SAN is registered with the roaming
provider").

These functions validate an already-loaded `cryptography`
x509.Certificate object; they do not perform a network TLS handshake
and do not manage private key material or accept `rejectUnauthorized:
false`-style bypasses. Test certificates are generated AT TEST TIME in
relay/ocpi/tests/test_certs.py using the `cryptography` library --
nothing here or in the test suite commits a cert or key file to
source control.
"""

from __future__ import annotations

import dataclasses
import datetime
from typing import Optional

from cryptography import x509
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.x509.oid import ExtendedKeyUsageOID, NameOID


@dataclasses.dataclass
class CertValidationResult:
    valid: bool
    reasons: list


def validate_not_expired(cert: x509.Certificate, now: Optional[datetime.datetime] = None) -> CertValidationResult:
    now = now or datetime.datetime.now(datetime.timezone.utc)
    not_before = cert.not_valid_before_utc
    not_after = cert.not_valid_after_utc
    if now < not_before:
        return CertValidationResult(False, ['certificate is not yet valid (before its notBefore date)'])
    if now > not_after:
        return CertValidationResult(False, ['certificate has expired (past its notAfter date)'])
    return CertValidationResult(True, [])


def validate_san(cert: x509.Certificate, expected_hostname: str) -> CertValidationResult:
    try:
        san = cert.extensions.get_extension_for_class(x509.SubjectAlternativeName)
    except x509.ExtensionNotFound:
        return CertValidationResult(False, ['certificate has no Subject Alternative Name extension'])
    dns_names = san.value.get_values_for_type(x509.DNSName)
    if expected_hostname not in dns_names:
        return CertValidationResult(
            False, [f'expected hostname {expected_hostname!r} not present in certificate SAN: {dns_names}']
        )
    return CertValidationResult(True, [])


def validate_key_usage(cert: x509.Certificate, require_client_auth: bool = True) -> CertValidationResult:
    reasons = []
    try:
        key_usage = cert.extensions.get_extension_for_class(x509.KeyUsage).value
        if not key_usage.digital_signature:
            reasons.append('certificate KeyUsage extension does not permit digitalSignature')
    except x509.ExtensionNotFound:
        reasons.append('certificate has no KeyUsage extension')

    if require_client_auth:
        try:
            eku = cert.extensions.get_extension_for_class(x509.ExtendedKeyUsage).value
            if ExtendedKeyUsageOID.CLIENT_AUTH not in eku:
                reasons.append('certificate ExtendedKeyUsage does not include clientAuth')
        except x509.ExtensionNotFound:
            reasons.append('certificate has no ExtendedKeyUsage extension')

    return CertValidationResult(len(reasons) == 0, reasons)


def validate_chain(leaf: x509.Certificate, issuer: x509.Certificate) -> CertValidationResult:
    """Verifies that `leaf` was signed by `issuer`'s key and that the
    issuer subject matches the leaf's issuer field. This is a
    single-link check suitable for a directly CA-issued client
    certificate; a multi-intermediate chain would repeat this per
    link, which is out of scope for this pilot-stage validator.
    """
    reasons = []
    if leaf.issuer != issuer.subject:
        return CertValidationResult(False, ['leaf certificate issuer does not match candidate issuer subject'])

    try:
        issuer_public_key = issuer.public_key()
        issuer_public_key.verify(
            leaf.signature,
            leaf.tbs_certificate_bytes,
            padding.PKCS1v15(),
            leaf.signature_hash_algorithm,
        )
    except Exception as exc:  # noqa: BLE001 - any verification failure means an invalid chain
        reasons.append(f'signature verification failed: {exc}')

    return CertValidationResult(len(reasons) == 0, reasons)


def validate_provider_identity(cert: x509.Certificate, expected_partner_id: str) -> CertValidationResult:
    common_names = cert.subject.get_attributes_for_oid(NameOID.COMMON_NAME)
    values = [attr.value for attr in common_names]
    if expected_partner_id not in values:
        return CertValidationResult(
            False, [f'certificate CN does not match expected provider identity {expected_partner_id!r}: {values}']
        )
    return CertValidationResult(True, [])


def validate_certificate(
    leaf: x509.Certificate,
    issuer: x509.Certificate,
    expected_hostname: str,
    expected_partner_id: str,
    now: Optional[datetime.datetime] = None,
) -> CertValidationResult:
    """Runs all checks (chain, SAN, key usage, expiration, provider
    identity) and aggregates every failure reason. Used by a future
    production mTLS handshake hook -- this function is never reachable
    from the browser and performs no network I/O.
    """
    results = [
        validate_chain(leaf, issuer),
        validate_san(leaf, expected_hostname),
        validate_key_usage(leaf),
        validate_not_expired(leaf, now),
        validate_provider_identity(leaf, expected_partner_id),
    ]
    reasons = [reason for result in results for reason in result.reasons]
    return CertValidationResult(len(reasons) == 0, reasons)
