"""Genuine multi-threaded concurrency test for adapter.ingest_cdr.

Uses TransactionTestCase (not TestCase) because each thread needs its
own real database connection/transaction -- TestCase wraps the whole
test in a single outer transaction on the main thread's connection,
which other threads' connections would never see. See
https://docs.djangoproject.com/en/stable/topics/testing/tools/#testcase
("TransactionTestCase ... resets the database ... using truncation").
"""

import threading

from django.db import connection
from django.test import TransactionTestCase

from .. import adapter
from ..models import OcpiCdr, WalletLedgerEntry
from .factories import cdr_payload, make_provider, make_redemption


class ConcurrentCdrIngestTests(TransactionTestCase):
    def test_two_simultaneous_deliveries_of_the_same_cdr_settle_exactly_once(self):
        provider = make_provider()
        make_redemption(provider=provider, token_uid='TOKEN-UID-001', authorization_reference='AUTHREF-001')

        barrier = threading.Barrier(2)
        results = [None, None]
        errors = []

        def worker(index):
            try:
                barrier.wait(timeout=5)
                results[index] = adapter.ingest_cdr(cdr_payload())
            except Exception as exc:  # noqa: BLE001 - surfaced via `errors` and failed by the assertions below
                errors.append(exc)
            finally:
                connection.close()

        threads = [threading.Thread(target=worker, args=(i,)) for i in range(2)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=10)

        self.assertEqual(errors, [])
        self.assertIsNotNone(results[0])
        self.assertIsNotNone(results[1])

        statuses = sorted(result.status for result in results)
        self.assertEqual(statuses, ['duplicate', 'settled'])

        self.assertEqual(OcpiCdr.objects.filter(cdr_id='CDR-001').count(), 1)
        self.assertEqual(WalletLedgerEntry.objects.filter(entry_type='DEBIT').count(), 1)

        cdr = OcpiCdr.objects.get(cdr_id='CDR-001')
        for result in results:
            self.assertEqual(result.cdr.pk, cdr.pk)
