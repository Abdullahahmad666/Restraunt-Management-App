import pytest

from apps.restaurants.models import Restaurant

pytestmark = pytest.mark.django_db


def test_slug_is_derived_from_name():
    restaurant = Restaurant.objects.create(name="Golden Spice")
    assert restaurant.slug == "golden-spice"


def test_duplicate_names_get_distinct_numbered_slugs():
    """slug is unique but name is not - two restaurants can share a name
    (common, once anyone can create one by self-registering), so the second
    one must be numbered rather than fail to save."""
    first = Restaurant.objects.create(name="Golden Spice")
    second = Restaurant.objects.create(name="Golden Spice")
    third = Restaurant.objects.create(name="Golden Spice")

    assert first.slug == "golden-spice"
    assert second.slug == "golden-spice-2"
    assert third.slug == "golden-spice-3"
    assert len({first.slug, second.slug, third.slug}) == 3


def test_an_explicit_slug_is_left_alone():
    restaurant = Restaurant.objects.create(name="Golden Spice", slug="custom-slug")
    assert restaurant.slug == "custom-slug"


def test_editing_a_restaurant_does_not_regenerate_its_slug():
    restaurant = Restaurant.objects.create(name="Golden Spice")
    original_slug = restaurant.slug

    restaurant.address = "1 High Street"
    restaurant.save()

    assert restaurant.slug == original_slug
