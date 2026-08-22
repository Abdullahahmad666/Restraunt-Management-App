"""Routes for the restaurants app, mounted at /api/v1/restaurants/."""

from rest_framework.routers import DefaultRouter

app_name = "restaurants"

router = DefaultRouter()
# router.register("", SomeViewSet, basename="some")

urlpatterns = router.urls
