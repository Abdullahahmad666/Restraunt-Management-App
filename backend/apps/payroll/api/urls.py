"""Routes for the payroll app. One router per role.

config/urls.py mounts these under /api/v1/staff/ and /api/v1/admin/.
"""

from django.urls import path
from rest_framework.routers import DefaultRouter

from .admin import (
    AdminPayPeriodViewSet,
    AdminPayrollEntryViewSet,
    AdminStaffPayRateViewSet,
    StaffCostReportView,
)
from .staff import StaffPayrollEntryViewSet

app_name = "payroll"

staff_router = DefaultRouter()
staff_router.register("entries", StaffPayrollEntryViewSet, basename="payroll-entry")

admin_router = DefaultRouter()
admin_router.register("rates", AdminStaffPayRateViewSet, basename="pay-rate")
admin_router.register("periods", AdminPayPeriodViewSet, basename="pay-period")
admin_router.register("entries", AdminPayrollEntryViewSet, basename="payroll-entry")

staff_urlpatterns = staff_router.urls
admin_urlpatterns = [
    *admin_router.urls,
    path("cost-report/", StaffCostReportView.as_view(), name="cost-report"),
]
