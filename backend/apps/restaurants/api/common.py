"""Serializers and querysets shared by every role.

Anything role-specific belongs in staff.py or admin.py. If both roles need the
same field list, it goes here and both subclass it - duplicating a field list
is how the two drift apart.
"""

from rest_framework import serializers

from apps.restaurants.models import Restaurant, Table


class BaseRestaurantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Restaurant
        fields = ("id", "name", "slug", "address", "phone", "email", "currency")
        read_only_fields = ("id", "slug")


class BaseTableSerializer(serializers.ModelSerializer):
    class Meta:
        model = Table
        fields = ("id", "restaurant", "number", "seats", "is_active")
        read_only_fields = ("id",)
