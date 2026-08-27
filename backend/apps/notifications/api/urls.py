"""Routes for the notifications app. One router per role.

config/urls.py mounts these under /api/v1/staff/ and /api/v1/admin/.
"""

from rest_framework.routers import DefaultRouter

from .admin import AdminNotificationViewSet
from .staff import DeviceTokenViewSet, NotificationViewSet

app_name = "notifications"

staff_router = DefaultRouter()
staff_router.register("devices", DeviceTokenViewSet, basename="device-token")
staff_router.register("notifications", NotificationViewSet, basename="notification")

admin_router = DefaultRouter()
admin_router.register("notifications", AdminNotificationViewSet, basename="notification")

staff_urlpatterns = staff_router.urls
admin_urlpatterns = admin_router.urls
