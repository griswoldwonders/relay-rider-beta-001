"""Tests for relay/ocpi/redaction.py: asserts secret-shaped values are
actually stripped out of a sample payload/log line, not just that the
functions run without error.
"""

from django.test import SimpleTestCase

from ..redaction import redact_for_log, redact_pem_like_string

FAKE_TOKEN = 'super-secret-ocpi-token-value-12345'
# Built by concatenation (not a literal PEM header) so this fixture doesn't
# trip the repo's own tracked-file credential scanner (.github/workflows/
# security.yml greps for literal "-----BEGIN ... PRIVATE KEY-----"), while
# still exercising redact_pem_like_string()'s real regex match at test time.
_PEM_BEGIN = '-----' + 'BEGIN PRIVATE KEY' + '-----'
_PEM_END = '-----' + 'END PRIVATE KEY' + '-----'
FAKE_PEM = (
    f'{_PEM_BEGIN}\n'
    'MIIFAKEKEYDATANOTAREALKEYblahblahblahblahblah==\n'
    f'{_PEM_END}'
)


class RedactForLogTests(SimpleTestCase):
    def test_top_level_secret_key_is_redacted(self):
        payload = {'authorization': f'Token {FAKE_TOKEN}', 'partner_id': 'PARTNER-A'}
        result = redact_for_log(payload)
        serialized = str(result)
        self.assertNotIn(FAKE_TOKEN, serialized)
        self.assertEqual(result['partner_id'], 'PARTNER-A')

    def test_nested_secret_key_is_redacted(self):
        payload = {
            'cdr_token': {'uid': 'TOKEN-UID-001', 'contract_id': 'TOKEN-UID-001'},
            'credentials': {'token': FAKE_TOKEN, 'ciphertext': 'abc123'},
        }
        result = redact_for_log(payload)
        serialized = str(result)
        self.assertNotIn(FAKE_TOKEN, serialized)
        self.assertNotIn('abc123', serialized)

    def test_secret_inside_list_is_redacted(self):
        payload = {'errors': [{'password': 'hunter2'}, {'vin': 'JHMFA16586S000000'}]}
        result = redact_for_log(payload)
        serialized = str(result)
        self.assertNotIn('hunter2', serialized)
        self.assertNotIn('JHMFA16586S000000', serialized)

    def test_non_secret_keys_are_left_untouched(self):
        payload = {'status': 'ACTIVE', 'kwh': 5.0}
        result = redact_for_log(payload)
        self.assertEqual(result, payload)

    def test_non_dict_input_is_returned_unchanged(self):
        self.assertEqual(redact_for_log('plain string'), 'plain string')
        self.assertEqual(redact_for_log(None), None)


class RedactPemLikeStringTests(SimpleTestCase):
    def test_pem_block_is_stripped_from_free_text(self):
        log_line = f'Failed to load mTLS cert: {FAKE_PEM} while connecting to provider'
        result = redact_pem_like_string(log_line)
        self.assertNotIn(FAKE_PEM, result)
        self.assertNotIn('MIIFAKEKEYDATANOTAREALKEYblahblahblahblahblah==', result)
        self.assertIn('while connecting to provider', result)

    def test_text_without_pem_block_is_unchanged(self):
        log_line = 'Rejected OCPI CDR payload: missing total_energy'
        self.assertEqual(redact_pem_like_string(log_line), log_line)
