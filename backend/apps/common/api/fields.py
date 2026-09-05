"""Serializer fields shared across apps."""

from rest_framework import serializers


class CoordinateField(serializers.DecimalField):
    """A GPS coordinate, rounded to fit rather than rejected.

    DRF's DecimalField treats excess decimal places as a validation error, so a
    phone posting the latitude it actually has - `Location.getCurrentPositionAsync`
    returns full float precision, routinely twelve or more decimals - gets back
    "Ensure that there are no more than 6 decimal places" and the scan fails.

    That is the wrong answer to the wrong question. Six decimal places is about
    11 cm; the extra digits are noise well below GPS's own accuracy, and no
    geofence check cares about them. Rounding loses nothing and means the
    contract does not depend on every client remembering to truncate first.

    Only the precision check is skipped. Range is still enforced, and DRF's own
    quantize step does the rounding, so stored values are exactly what the
    column holds.
    """

    def __init__(self, **kwargs):
        kwargs.setdefault("max_digits", 9)
        kwargs.setdefault("decimal_places", 6)
        super().__init__(**kwargs)

    def validate_precision(self, value):
        # DRF calls this and then quantizes the result. Returning the value
        # untouched turns "too precise" from an error into a rounding.
        return value


class LatitudeField(CoordinateField):
    def __init__(self, **kwargs):
        kwargs.setdefault("min_value", -90)
        kwargs.setdefault("max_value", 90)
        super().__init__(**kwargs)


class LongitudeField(CoordinateField):
    def __init__(self, **kwargs):
        kwargs.setdefault("min_value", -180)
        kwargs.setdefault("max_value", 180)
        super().__init__(**kwargs)
