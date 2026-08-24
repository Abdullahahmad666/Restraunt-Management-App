"""Routes for the restaurants app.

Exports one router per role. config/urls.py mounts them under
/api/v1/staff/ and /api/v1/admin/ respectively - nothing here knows about
that prefix, so the namespaces can be rearranged in one place.
"""

from rest_framework.routers import DefaultRouter

from .admin import AdminRestaurantViewSet, AdminTableViewSet
from .staff import StaffRestaurantViewSet, StaffTableViewSet

app_name = "restaurants"

staff_router = DefaultRouter()
staff_router.register("restaurants", StaffRestaurantViewSet, basename="restaurant")
staff_router.register("tables", StaffTableViewSet, basename="table")

admin_router = DefaultRouter()
admin_router.register("restaurants", AdminRestaurantViewSet, basename="restaurant")
admin_router.register("tables", AdminTableViewSet, basename="table")

staff_urlpatterns = staff_router.urls
admin_urlpatterns = admin_router.urls
