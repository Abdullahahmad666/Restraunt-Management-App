"""Routes for the notifications app. One router per role.

config/urls.py mounts these under /api/v1/staff/ and /api/v1/admin/.
"""

from rest_framework.routers import DefaultRouter

app_name = "notifications"

staff_router = DefaultRouter()
# staff_router.register("<resource>", Staff<Model>ViewSet, basename="<resource>")

admin_router = DefaultRouter()
# admin_router.register("<resource>", Admin<Model>ViewSet, basename="<resource>")

staff_urlpatterns = staff_router.urls
admin_urlpatterns = admin_router.urls
