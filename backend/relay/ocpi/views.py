"""Authenticated, service-to-service internal OCPI ingestion endpoints.

These are NOT participant-facing. They are the internal boundary an
OCPI connector worker/service would call after it has already
performed provider authentication (token/mTLS) at the transport layer
-- see docs/OCPI_PRODUCTION_SECURITY_AND_SESSION_LINKING.md. Django
authenticates and authorizes the caller of *this* endpoint the normal
way (session/basic auth + IsAdminUser); it does not itself terminate
an inbound OCPI mTLS connection.

Every new endpoint here explicitly overrides the project's global
DEFAULT_PERMISSION_CLASSES (currently AllowAny; see
backend/config/settings.py and SECURITY.md) with IsAdminUser, matching
objective: "Authenticated-only internal ingestion endpoint ... scoped
for service-to-service/admin use, not participant-facing." This is the
one explicit AllowAny-override pattern requested for any new endpoint
in this codebase -- never weaken it.
"""

import logging

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from . import adapter
from .redaction import redact_for_log
from .serializers import OcpiCdrIngestSerializer, OcpiSessionIngestSerializer

logger = logging.getLogger('relay.ocpi.ingestion')

OCPI_STATUS_SUCCESS = 1000
OCPI_STATUS_CLIENT_ERROR = 2000


def ocpi_envelope(data, status_code=OCPI_STATUS_SUCCESS, status_message='Success'):
    """Matches the existing Envelope shape in docs/openapi-ocpi.yaml."""
    return {'status_code': status_code, 'status_message': status_message, 'data': data}


class OcpiSessionIngestView(APIView):
    """POST /api/internal/ocpi/sessions/

    Receives a normalized OCPI Session (plus an internal `partner_id`)
    and stores/updates its projection via relay/ocpi/adapter.py. Never
    touches the wallet ledger directly -- only CDR ingestion can result
    in a WalletLedgerEntry.
    """

    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        serializer = OcpiSessionIngestSerializer(data=request.data)
        if not serializer.is_valid():
            logger.info('Rejected OCPI session payload: %s', redact_for_log(dict(serializer.errors)))
            return Response(
                ocpi_envelope(None, OCPI_STATUS_CLIENT_ERROR, 'Invalid OCPI Session payload'),
                status=status.HTTP_400_BAD_REQUEST,
            )

        result = adapter.ingest_session(serializer.validated_data)

        if result.status == 'rejected':
            http_status = status.HTTP_409_CONFLICT if result.record is not None else status.HTTP_400_BAD_REQUEST
            return Response(
                ocpi_envelope({'reason': result.reason}, OCPI_STATUS_CLIENT_ERROR, result.reason),
                status=http_status,
            )

        body = {
            'id': result.record.external_session_id,
            'status': result.record.status,
            'ingestion_status': result.status,
        }
        return Response(ocpi_envelope(body), status=status.HTTP_200_OK)


class OcpiCdrIngestView(APIView):
    """POST /api/internal/ocpi/cdrs/

    Receives an OCPI CDR (plus an internal `partner_id`), runs it
    through the settlement adapter, and returns SETTLED /
    REVIEW_REQUIRED / DUPLICATE -- mirroring the envelope shape
    documented for /api/integrations/{partnerId}/ocpi/cdrs in
    docs/openapi-ocpi.yaml. Repeat delivery of the same
    (provider, cdr_id) returns the original result, never a new
    mutation.
    """

    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        serializer = OcpiCdrIngestSerializer(data=request.data)
        if not serializer.is_valid():
            logger.info('Rejected OCPI CDR payload: %s', redact_for_log(dict(serializer.errors)))
            return Response(
                ocpi_envelope(None, OCPI_STATUS_CLIENT_ERROR, 'Invalid OCPI CDR payload'),
                status=status.HTTP_400_BAD_REQUEST,
            )

        result = adapter.ingest_cdr(serializer.validated_data)

        if result.cdr is None:
            return Response(
                ocpi_envelope(
                    {'matched': False, 'status': 'REVIEW_REQUIRED', 'reason': result.reason},
                    OCPI_STATUS_CLIENT_ERROR,
                    result.reason,
                ),
                status=status.HTTP_400_BAD_REQUEST,
            )

        status_map = {'settled': 'SETTLED', 'needs_review': 'REVIEW_REQUIRED', 'duplicate': 'DUPLICATE'}
        http_status = status.HTTP_200_OK if result.status in ('settled', 'duplicate') else status.HTTP_202_ACCEPTED
        body = {
            'cdr_id': result.cdr.cdr_id,
            'matched': result.status == 'settled',
            'status': status_map[result.status],
        }
        return Response(ocpi_envelope(body), status=http_status)
