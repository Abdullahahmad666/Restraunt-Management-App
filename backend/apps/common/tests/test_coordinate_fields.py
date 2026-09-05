"""GPS coordinates are rounded to fit the column, not rejected for not fitting.

A phone posts the precision its GPS gives - `getCurrentPositionAsync` returns a
float with twelve or more decimals - while the columns hold six. DRF's default
DecimalField calls that a validation error, so a scan failed with "Ensure that
there are no more than 6 decimal places" and a staff member could not clock in.

Six decimal places is roughly 11 cm, well below GPS's own accuracy, so the extra
digits are noise. These tests exist so nobody reinstates the strict behaviour on
the grounds that rounding input looks sloppy.
"""

from decimal import Decimal

import pytest
from rest_framework import serializers

from apps.common.api.fields import CoordinateField, LatitudeField, LongitudeField


class CoordsSerializer(serializers.Serializer):
    latitude = LatitudeField()
    longitude = LongitudeField()


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        (51.50741234567891, Decimal("51.507412")),
        (-0.12775987654321, Decimal("-0.127760")),
        # Already short enough - must pass through untouched.
        (51.5074, Decimal("51.507400")),
        # Rounds rather than truncates.
        (1.0000006, Decimal("1.000001")),
        # Exact ties go to even, because Decimal.quantize defaults to
        # ROUND_HALF_EVEN. Worth pinning so the behaviour is deliberate: at
        # this scale the difference is half a micrometre, and biasing every
        # tie upwards would be the stranger choice.
        (1.0000005, Decimal("1.000000")),
        (1.0000015, Decimal("1.000002")),
    ],
)
def test_excess_precision_is_rounded(raw, expected):
    s = CoordsSerializer(data={"latitude": raw, "longitude": 0})
    assert s.is_valid(), s.errors
    assert s.validated_data["latitude"] == expected


def test_a_phone_grade_coordinate_is_accepted():
    """The exact shape that used to fail."""
    s = CoordsSerializer(data={"latitude": 24.8607343, "longitude": 67.0011364})
    assert s.is_valid(), s.errors
    assert s.validated_data["latitude"] == Decimal("24.860734")
    assert s.validated_data["longitude"] == Decimal("67.001136")


@pytest.mark.parametrize("latitude", [91, -91, 180])
def test_latitude_range_is_still_enforced(latitude):
    """Rounding precision must not have loosened the range check."""
    s = CoordsSerializer(data={"latitude": latitude, "longitude": 0})
    assert not s.is_valid()
    assert "latitude" in s.errors


@pytest.mark.parametrize("longitude", [181, -181])
def test_longitude_range_is_still_enforced(longitude):
    s = CoordsSerializer(data={"latitude": 0, "longitude": longitude})
    assert not s.is_valid()
    assert "longitude" in s.errors


def test_non_numeric_input_is_still_rejected():
    s = CoordsSerializer(data={"latitude": "not-a-number", "longitude": 0})
    assert not s.is_valid()


def test_the_base_field_defaults_match_the_columns():
    """max_digits=9, decimal_places=6 mirrors the model - keep them in step."""
    field = CoordinateField()
    assert field.max_digits == 9
    assert field.decimal_places == 6
