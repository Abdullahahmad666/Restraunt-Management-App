"""Routes for the attendance app. One router per role.

config/urls.py mounts these under /api/v1/staff/ and /api/v1/admin/.
"""

from django.urls import path
from rest_framework.routers import DefaultRouter

from .admin import AdminAttendanceLogViewSet, AdminShiftViewSet, AdminVenueQRCodeViewSet
from .staff import ScanView, StaffAttendanceLogViewSet, StaffShiftViewSet

app_name = "attendance"

staff_router = DefaultRouter()
staff_router.register("shifts", StaffShiftViewSet, basename="shift")
staff_router.register("logs", StaffAttendanceLogViewSet, basename="attendance-log")

admin_router = DefaultRouter()
admin_router.register("shifts", AdminShiftViewSet, basename="shift")
admin_router.register("logs", AdminAttendanceLogViewSet, basename="attendance-log")
admin_router.register("qr-codes", AdminVenueQRCodeViewSet, basename="qr-code")

staff_urlpatterns = [*staff_router.urls, path("scan/", ScanView.as_view(), name="scan")]
admin_urlpatterns = admin_router.urls
