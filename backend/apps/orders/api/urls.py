"""Routes for the orders app, mounted at /api/v1/orders/."""

from rest_framework.routers import DefaultRouter

app_name = "orders"

router = DefaultRouter()
# router.register("", SomeViewSet, basename="some")

urlpatterns = router.urls
