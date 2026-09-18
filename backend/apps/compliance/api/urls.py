"""Routes for the compliance app. One router per role.

config/urls.py mounts these under /api/v1/staff/ and /api/v1/admin/.
"""

from rest_framework.routers import DefaultRouter

from .admin import (
    AdminChecklistItemViewSet,
    AdminChecklistTaskViewSet,
    AdminChecklistTemplateViewSet,
    AdminFridgeUnitViewSet,
)
from .staff import (
    StaffChecklistCompletionViewSet,
    StaffChecklistItemViewSet,
    StaffChecklistTaskCompletionViewSet,
    StaffChecklistTaskViewSet,
    StaffChecklistTemplateViewSet,
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
staff_router.register(
    "checklist-templates", StaffChecklistTemplateViewSet, basename="checklist-template"
)
staff_router.register("checklist-tasks", StaffChecklistTaskViewSet, basename="checklist-task")
staff_router.register(
    "checklist-task-completions",
    StaffChecklistTaskCompletionViewSet,
    basename="checklist-task-completion",
)

admin_router = DefaultRouter()
admin_router.register("fridge-units", AdminFridgeUnitViewSet, basename="fridge-unit")
admin_router.register("checklist-items", AdminChecklistItemViewSet, basename="checklist-item")
admin_router.register(
    "checklist-templates", AdminChecklistTemplateViewSet, basename="checklist-template"
)
admin_router.register("checklist-tasks", AdminChecklistTaskViewSet, basename="checklist-task")

staff_urlpatterns = staff_router.urls
admin_urlpatterns = admin_router.urls
