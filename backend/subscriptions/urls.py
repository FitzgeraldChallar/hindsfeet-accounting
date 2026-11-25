from django.urls import path
from .views import (
    CurrentSubscriptionView,
    SupportTicketListCreateView,
    SupportTicketDetailView,
    SupportTicketReplyView,
    SupportTicketAttachmentView,
    SupportMessageAttachmentView,
)

urlpatterns = [
    path("current/", CurrentSubscriptionView.as_view(), name="current-subscription"),
    path("support/tickets/", SupportTicketListCreateView.as_view(), name="support-ticket-list-create"),
    path("support/tickets/<int:pk>/", SupportTicketDetailView.as_view(), name="support-ticket-detail"),
    path("support/tickets/<int:pk>/replies/", SupportTicketReplyView.as_view(), name="support-ticket-reply"),
    path("support/tickets/<int:pk>/attachment/", SupportTicketAttachmentView.as_view(), name="support-ticket-attachment"),
    path("support/messages/<int:pk>/attachment/", SupportMessageAttachmentView.as_view(), name="support-message-attachment"),
]
