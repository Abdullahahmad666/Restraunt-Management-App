from django.db import connection
from drf_spectacular.utils import OpenApiExample, extend_schema
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


class HealthSerializer(serializers.Serializer):
    """Exists so drf-spectacular can document the health endpoint."""

    status = serializers.ChoiceField(choices=["ok", "degraded"])
    database = serializers.BooleanField()


@extend_schema(
    responses={200: HealthSerializer, 503: HealthSerializer},
    description="Liveness and database-readiness probe. Unauthenticated.",
    examples=[OpenApiExample("Healthy", value={"status": "ok", "database": True})],
)
@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(request):
    """Liveness + database readiness probe for the load balancer and CI."""
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        database_ok = True
    except Exception:  # noqa: BLE001 - the probe must never raise
        database_ok = False

    return Response(
        {"status": "ok" if database_ok else "degraded", "database": database_ok},
        status=200 if database_ok else 503,
    )
