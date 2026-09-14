from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError

from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated

from .serializers import LoginSerializer, UserSerializer


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data["user"]

        refresh = RefreshToken.for_user(user)

        return Response({
            "refresh": str(refresh),
            "access": str(refresh.access_token),
            "user": UserSerializer(user).data,
        })


class CurrentUserView(generics.RetrieveAPIView):
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user

User = get_user_model()


class ProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "first_name",
            "last_name",
            "email",
            "phone",
        ]


class ProfileUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        serializer = ProfileUpdateSerializer(
            request.user,
            data=request.data,
            partial=True,
        )

        serializer.is_valid(raise_exception=True)
        serializer.save()

        user = request.user

        return Response({
            "id": user.id,
            "username": user.username,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "email": user.email,
            "phone": getattr(user, "phone", ""),
            "role": getattr(user, "role", ""),
            "is_active_employee": getattr(
                user,
                "is_active_employee",
                False,
            ),
        })


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        current_password = request.data.get(
            "current_password"
        )

        new_password = request.data.get(
            "new_password"
        )

        confirm_password = request.data.get(
            "confirm_password"
        )

        if not current_password:
            return Response(
                {
                    "detail":
                        "Current password is required."
                },
                status=400,
            )

        if not request.user.check_password(
            current_password
        ):
            return Response(
                {
                    "detail":
                        "Current password is incorrect."
                },
                status=400,
            )

        if not new_password:
            return Response(
                {
                    "detail":
                        "New password is required."
                },
                status=400,
            )

        if new_password != confirm_password:
            return Response(
                {
                    "detail":
                        "New passwords do not match."
                },
                status=400,
            )

        if current_password == new_password:
            return Response(
                {
                    "detail":
                        "New password must be different from your current password."
                },
                status=400,
            )

        try:
            validate_password(
                new_password,
                request.user,
            )
        except ValidationError as error:
            return Response(
                {
                    "detail": error.messages
                },
                status=400,
            )

        request.user.set_password(
            new_password
        )

        request.user.save(
            update_fields=["password"]
        )

        return Response({
            "detail":
                "Password changed successfully."
        })