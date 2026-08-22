"""What an owner or manager may see and do in the inventory app.

Mounted at /api/v1/admin/inventory/.
"""

from apps.common.api.viewsets import AdminViewSet  # noqa: F401

# class Admin<Model>ViewSet(AdminViewSet):
#     serializer_class = Admin<Model>Serializer
#     queryset = <Model>.objects.all()
