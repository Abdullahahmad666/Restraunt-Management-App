"""Routes for the payments app.

One router per role. config/urls.py mounts them under /api/v1/staff/ and
/api/v1/admin/, so nothing here needs to know the prefix.
"""

from rest_framework.routers import DefaultRouter

app_name = "payments"

staff_router = DefaultRouter()
# staff_router.register("<resource>", Staff<Model>ViewSet, basename="<resource>")

admin_router = DefaultRouter()
# admin_router.register("<resource>", Admin<Model>ViewSet, basename="<resource>")

staff_urlpatterns = staff_router.urls
admin_urlpatterns = admin_router.urls
