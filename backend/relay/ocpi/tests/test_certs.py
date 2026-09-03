"""Unit tests for relay/ocpi/certs.py.

All certificates are generated in-process with the `cryptography`
library inside setUp()/helper functions below -- nothing is read from
or written to disk, and nothing is committed to source control. Keys
are small/ephemeral RSA keys used only for the duration of a single
test process.
"""

import datetime

from cryptography import x509
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import ExtendedKeyUsageOID, NameOID
from django.test import SimpleTestCase

from .. import certs

EXPECTED_HOSTNAME = 'provider.example.com'
EXPECTED_PARTNER_ID = 'PARTNER-A'


def _generate_key():
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


def _build_ca():
    key = _generate_key()
    subject = issuer = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, 'Test OCPI Root CA')])
    now = datetime.datetime.now(datetime.timezone.utc)
    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - datetime.timedelta(days=1))
        .not_valid_after(now + datetime.timedelta(days=3650))
        .add_extension(x509.BasicConstraints(ca=True, path_length=None), critical=True)
        .sign(key, hashes.SHA256())
    )
    return key, cert


def _build_leaf(
    ca_key,
    ca_cert,
    *,
    common_name=EXPECTED_PARTNER_ID,
    san_hostname=EXPECTED_HOSTNAME,
    not_before_delta=datetime.timedelta(days=-1),
    not_after_delta=datetime.timedelta(days=365),
    include_key_usage=True,
    digital_signature=True,
    include_extended_key_usage=True,
    client_auth=True,
):
    key = _generate_key()
    subject = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, common_name)])
    now = datetime.datetime.now(datetime.timezone.utc)
    builder = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(ca_cert.subject)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now + not_before_delta)
        .not_valid_after(now + not_after_delta)
    )
    if san_hostname is not None:
        builder = builder.add_extension(
            x509.SubjectAlternativeName([x509.DNSName(san_hostname)]), critical=False
        )
    if include_key_usage:
        builder = builder.add_extension(
            x509.KeyUsage(
                digital_signature=digital_signature,
                content_commitment=False,
                key_encipherment=True,
                data_encipherment=False,
                key_agreement=False,
                key_cert_sign=False,
                crl_sign=False,
                encipher_only=False,
                decipher_only=False,
            ),
            critical=True,
        )
    if include_extended_key_usage:
        eku = [ExtendedKeyUsageOID.CLIENT_AUTH] if client_auth else [ExtendedKeyUsageOID.SERVER_AUTH]
        builder = builder.add_extension(x509.ExtendedKeyUsage(eku), critical=False)
    cert = builder.sign(ca_key, hashes.SHA256())
    return key, cert


class CertValidationTests(SimpleTestCase):
    def setUp(self):
        self.ca_key, self.ca_cert = _build_ca()

    def _valid_leaf(self, **overrides):
        _, leaf = _build_leaf(self.ca_key, self.ca_cert, **overrides)
        return leaf

    def test_valid_certificate_passes_all_checks(self):
        leaf = self._valid_leaf()
        result = certs.validate_certificate(leaf, self.ca_cert, EXPECTED_HOSTNAME, EXPECTED_PARTNER_ID)
        self.assertTrue(result.valid)
        self.assertEqual(result.reasons, [])

    def test_expired_certificate_is_rejected_with_reason(self):
        leaf = self._valid_leaf(
            not_before_delta=datetime.timedelta(days=-30), not_after_delta=datetime.timedelta(days=-1)
        )
        result = certs.validate_not_expired(leaf)
        self.assertFalse(result.valid)
        self.assertEqual(len(result.reasons), 1)
        self.assertIn('expired', result.reasons[0])

    def test_not_yet_valid_certificate_is_rejected_with_reason(self):
        leaf = self._valid_leaf(
            not_before_delta=datetime.timedelta(days=10), not_after_delta=datetime.timedelta(days=365)
        )
        result = certs.validate_not_expired(leaf)
        self.assertFalse(result.valid)
        self.assertIn('not yet valid', result.reasons[0])

    def test_wrong_san_is_rejected_with_reason(self):
        leaf = self._valid_leaf(san_hostname='wrong-host.example.com')
        result = certs.validate_san(leaf, EXPECTED_HOSTNAME)
        self.assertFalse(result.valid)
        self.assertIn(EXPECTED_HOSTNAME, result.reasons[0])
        self.assertIn('wrong-host.example.com', result.reasons[0])

    def test_missing_san_extension_is_rejected_with_reason(self):
        leaf = self._valid_leaf(san_hostname=None)
        result = certs.validate_san(leaf, EXPECTED_HOSTNAME)
        self.assertFalse(result.valid)
        self.assertIn('no Subject Alternative Name', result.reasons[0])

    def test_missing_key_usage_extension_is_rejected_with_reason(self):
        leaf = self._valid_leaf(include_key_usage=False)
        result = certs.validate_key_usage(leaf)
        self.assertFalse(result.valid)
        self.assertTrue(any('no KeyUsage extension' in reason for reason in result.reasons))

    def test_key_usage_without_digital_signature_is_rejected_with_reason(self):
        leaf = self._valid_leaf(digital_signature=False)
        result = certs.validate_key_usage(leaf)
        self.assertFalse(result.valid)
        self.assertTrue(any('digitalSignature' in reason for reason in result.reasons))

    def test_key_usage_without_client_auth_eku_is_rejected_with_reason(self):
        leaf = self._valid_leaf(client_auth=False)
        result = certs.validate_key_usage(leaf, require_client_auth=True)
        self.assertFalse(result.valid)
        self.assertTrue(any('clientAuth' in reason for reason in result.reasons))

    def test_missing_extended_key_usage_is_rejected_with_reason(self):
        leaf = self._valid_leaf(include_extended_key_usage=False)
        result = certs.validate_key_usage(leaf, require_client_auth=True)
        self.assertFalse(result.valid)
        self.assertTrue(any('no ExtendedKeyUsage extension' in reason for reason in result.reasons))

    def test_valid_chain_verifies(self):
        leaf = self._valid_leaf()
        result = certs.validate_chain(leaf, self.ca_cert)
        self.assertTrue(result.valid)

    def test_chain_with_wrong_issuer_is_rejected(self):
        other_key, other_ca_cert = _build_ca()
        leaf = self._valid_leaf()
        result = certs.validate_chain(leaf, other_ca_cert)
        self.assertFalse(result.valid)

    def test_wrong_provider_identity_is_rejected_with_reason(self):
        leaf = self._valid_leaf(common_name='SOME-OTHER-PARTNER')
        result = certs.validate_provider_identity(leaf, EXPECTED_PARTNER_ID)
        self.assertFalse(result.valid)
        self.assertIn(EXPECTED_PARTNER_ID, result.reasons[0])

    def test_validate_certificate_aggregates_multiple_failures(self):
        leaf = self._valid_leaf(
            san_hostname='wrong-host.example.com',
            not_before_delta=datetime.timedelta(days=-30),
            not_after_delta=datetime.timedelta(days=-1),
            common_name='SOME-OTHER-PARTNER',
        )
        result = certs.validate_certificate(leaf, self.ca_cert, EXPECTED_HOSTNAME, EXPECTED_PARTNER_ID)
        self.assertFalse(result.valid)
        self.assertGreaterEqual(len(result.reasons), 3)
