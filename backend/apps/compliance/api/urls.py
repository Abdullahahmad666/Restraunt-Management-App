"""Routes for the compliance app. One router per role.

config/urls.py mounts these under /api/v1/staff/ and /api/v1/admin/.
"""

from rest_framework.routers import DefaultRouter

from .admin import AdminChecklistItemViewSet, AdminFridgeUnitViewSet
from .staff import (
    StaffChecklistCompletionViewSet,
    StaffChecklistItemViewSet,
    StaffFridgeUnitViewSet,
    StaffTemperatureReadingViewSet,
)

app_name = "compliance"

staff_router = DefaultRouter()
staff_router.register("fridge-units", StaffFridgeUnitViewSet, basename="fridge-unit")
staff_router.register("checklist-items", StaffChecklistItemViewSet, basename="checklist-item")
staff_router.register(
    "temperature-readings", StaffTemperatureReadingViewSet, basename="temperature-reading"
)
staff_router.register(
    "checklist-completions", StaffChecklistCompletionViewSet, basename="checklist-completion"
)

admin_router = DefaultRouter()
admin_router.register("fridge-units", AdminFridgeUnitViewSet, basename="fridge-unit")
admin_router.register("checklist-items", AdminChecklistItemViewSet, basename="checklist-item")

staff_urlpatterns = staff_router.urls
admin_urlpatterns = admin_router.urls
