"""Routes for the inventory app. One router per role.

config/urls.py mounts these under /api/v1/staff/ and /api/v1/admin/.
"""

from django.urls import path
from rest_framework.routers import DefaultRouter

from .admin import AdminInventoryItemViewSet, AdminSupplierViewSet, AdminWarehouseViewSet
from .purchases import PurchasesByItemView, PurchaseSummaryView, PurchaseTimelineView
from .staff import (
    StaffInventoryItemViewSet,
    StaffInvoiceLineItemViewSet,
    StaffInvoiceScanViewSet,
    StaffStockMovementViewSet,
    StaffSupplierViewSet,
    StaffWarehouseViewSet,
)

app_name = "inventory"

staff_router = DefaultRouter()
staff_router.register("inventory-items", StaffInventoryItemViewSet, basename="inventory-item")
staff_router.register("stock-movements", StaffStockMovementViewSet, basename="stock-movement")
staff_router.register("invoice-scans", StaffInvoiceScanViewSet, basename="invoice-scan")
staff_router.register(
    "invoice-line-items", StaffInvoiceLineItemViewSet, basename="invoice-line-item"
)
staff_router.register("suppliers", StaffSupplierViewSet, basename="supplier")
staff_router.register("warehouses", StaffWarehouseViewSet, basename="warehouse")

admin_router = DefaultRouter()
admin_router.register("inventory-items", AdminInventoryItemViewSet, basename="inventory-item")
admin_router.register("suppliers", AdminSupplierViewSet, basename="supplier")
admin_router.register("warehouses", AdminWarehouseViewSet, basename="warehouse")

staff_urlpatterns = staff_router.urls

# Plain views rather than a router: these are three reads over the same
# filtered set, not a resource with a detail route to hang off.
admin_urlpatterns = [
    *admin_router.urls,
    path("purchases/", PurchasesByItemView.as_view(), name="purchases-by-item"),
    path("purchases/timeline/", PurchaseTimelineView.as_view(), name="purchases-timeline"),
    path("purchases/summary/", PurchaseSummaryView.as_view(), name="purchases-summary"),
]
