"""Routes for the inventory app, mounted at /api/v1/inventory/."""

from rest_framework.routers import DefaultRouter

app_name = "inventory"

router = DefaultRouter()
# router.register("", SomeViewSet, basename="some")

urlpatterns = router.urls
