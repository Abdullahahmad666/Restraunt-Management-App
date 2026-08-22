"""What a floor user may see and do in the inventory app.

Mounted at /api/v1/staff/inventory/.
"""

from apps.common.api.viewsets import StaffViewSet  # noqa: F401

# class Staff<Model>ViewSet(StaffViewSet):
#     serializer_class = Staff<Model>Serializer
#     queryset = <Model>.objects.all()
