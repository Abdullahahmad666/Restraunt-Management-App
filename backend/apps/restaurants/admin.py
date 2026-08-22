from django.contrib import admin

from .models import Restaurant, Table


@admin.register(Restaurant)
class RestaurantAdmin(admin.ModelAdmin):
    list_display = ("name", "phone", "currency", "is_active", "created_at")
    list_filter = ("is_active", "currency")
    search_fields = ("name", "email", "phone")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Table)
class TableAdmin(admin.ModelAdmin):
    list_display = ("restaurant", "number", "seats", "is_active")
    list_filter = ("restaurant", "is_active")
    search_fields = ("number",)
