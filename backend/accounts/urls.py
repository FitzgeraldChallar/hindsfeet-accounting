from django.urls import path

from .views import (
    ChangePasswordView,
    CurrentUserView,
    LoginView,
    ProfileUpdateView,
)


urlpatterns = [
    path(
        "login/",
        LoginView.as_view(),
        name="login",
    ),

    path(
        "me/",
        CurrentUserView.as_view(),
        name="current-user",
    ),

    path(
        "profile/",
        ProfileUpdateView.as_view(),
        name="profile-update",
    ),

    path(
        "change-password/",
        ChangePasswordView.as_view(),
        name="change-password",
    ),
]