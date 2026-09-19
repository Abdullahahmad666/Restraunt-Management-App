"""Routes for the inventory app. One router per role.

config/urls.py mounts these under /api/v1/staff/ and /api/v1/admin/.
"""

from rest_framework.routers import DefaultRouter

from .admin import AdminInventoryItemViewSet
from .staff import (
    StaffInventoryItemViewSet,
    StaffInvoiceLineItemViewSet,
    StaffInvoiceScanViewSet,
    StaffStockMovementViewSet,
)

app_name = "inventory"

staff_router = DefaultRouter()
staff_router.register("inventory-items", StaffInventoryItemViewSet, basename="inventory-item")
staff_router.register("stock-movements", StaffStockMovementViewSet, basename="stock-movement")
staff_router.register("invoice-scans", StaffInvoiceScanViewSet, basename="invoice-scan")
staff_router.register(
    "invoice-line-items", StaffInvoiceLineItemViewSet, basename="invoice-line-item"
)

admin_router = DefaultRouter()
admin_router.register("inventory-items", AdminInventoryItemViewSet, basename="inventory-item")

staff_urlpatterns = staff_router.urls
admin_urlpatterns = admin_router.urls
