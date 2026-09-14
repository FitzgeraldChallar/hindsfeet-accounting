"""
Safe, company-scoped destructive deletion for Hindsfeet Accounting.

A company is an ownership boundary.

When a company is intentionally deleted, all records owned by that company
must be removed as well, even where normal model relationships use PROTECT
to prevent accidental deletion of individual products, invoices, payroll
records, accounting records, inventory records, etc.

This service deliberately does NOT traverse into the authenticated User
model. Users are shared application identities and must never be deleted as
a side effect of company cleanup.

The operation is atomic. If any part of the deletion fails, the entire
transaction is rolled back and the company remains intact.
"""

from collections import defaultdict, deque

from django.apps import apps
from django.contrib.auth import get_user_model
from django.db import transaction


UserModel = get_user_model()


def _foreign_key_fields(model):
    """
    Return concrete forward FK/O2O fields for a model.

    We intentionally inspect concrete model fields rather than reverse
    relations because the deletion graph needs to determine which records
    point to records already discovered.
    """
    for field in model._meta.fields:
        if (
            field.is_relation
            and field.remote_field is not None
        ):
            yield field


def _collect_company_graph(company):
    """
    Collect every database row reachable from the company ownership root.

    The graph is traversed through concrete FK/O2O relationships, regardless
    of the relationship's on_delete behavior.

    This is important because normal PROTECT relationships are exactly what
    prevent Django's normal deletion collector from deleting a company that
    has historical accounting, inventory, sales, purchase, payroll, or other
    records.

    We stop at the User model because users are shared application
    identities and must never be deleted as a consequence of company
    deletion.
    """
    CompanyModel = company.__class__

    rows = defaultdict(set)

    # Start with the company itself.
    rows[CompanyModel].add(company.pk)

    # Queue contains models whose newly discovered IDs still need to be
    # inspected for their own children.
    queue = deque([CompanyModel])
    queued = {CompanyModel}

    # Cache all installed models once instead of calling apps.get_models()
    # repeatedly throughout the graph traversal.
    all_models = tuple(apps.get_models())

    while queue:
        parent_model = queue.popleft()
        queued.discard(parent_model)

        parent_ids = rows[parent_model]

        if not parent_ids:
            continue

        for child_model in all_models:
            # Never traverse into the authentication User model.
            #
            # A transaction may have been created by a user, but deleting
            # the company must not delete that user.
            if child_model is UserModel:
                continue

            # Never discover another Company through a Company relationship.
            #
            # Companies are separate ownership boundaries.
            if child_model is CompanyModel:
                continue

            for field in _foreign_key_fields(child_model):
                if field.remote_field.model is not parent_model:
                    continue

                lookup = {
                    f"{field.name}__in": parent_ids,
                }

                child_ids = set(
                    child_model._default_manager
                    .filter(**lookup)
                    .values_list(
                        "pk",
                        flat=True,
                    )
                )

                if not child_ids:
                    continue

                existing_ids = rows[child_model]

                new_ids = child_ids - existing_ids

                if not new_ids:
                    continue

                # Add all newly discovered records to the graph.
                existing_ids.update(new_ids)

                # The child model must be processed because the newly
                # discovered records may themselves own further records.
                #
                # We intentionally allow a model to be placed back on the
                # queue if new IDs are discovered after it was previously
                # processed. This prevents graph branches from being missed
                # when two different parent models point to the same child
                # model.
                if child_model not in queued:
                    queue.append(child_model)
                    queued.add(child_model)

    return rows


def _clear_nullable_self_references(rows):
    """
    Break nullable self-FK cycles before deletion.

    A model may contain a nullable FK pointing to another record of the
    same model. Clearing those references prevents a self-referencing
    dependency from interfering with the deletion order.
    """
    for model, ids in rows.items():
        if not ids:
            continue

        for field in _foreign_key_fields(model):
            if field.remote_field.model is not model:
                continue

            if not field.null:
                continue

            model._default_manager.filter(
                pk__in=ids,
            ).update(
                **{
                    field.name: None,
                }
            )


def _deletion_order(rows):
    """
    Return models in dependency-safe child-to-parent deletion order.

    If:

        Company -> Sale -> SaleItem

    then the deletion order will be:

        SaleItem -> Sale -> Company

    This prevents parent records from being deleted while company-owned
    children still reference them through PROTECT or other restrictive
    relationships.
    """
    models = {
        model
        for model, ids in rows.items()
        if ids
    }

    # Map:
    #
    # parent model -> child models
    #
    # Example:
    #
    # Company -> {Sale, Product, Customer}
    #
    children = defaultdict(set)

    for child_model in models:
        for field in _foreign_key_fields(child_model):
            parent_model = field.remote_field.model

            if parent_model not in models:
                continue

            # Self-references are handled separately.
            if parent_model is child_model:
                continue

            children[parent_model].add(child_model)

    remaining = set(models)
    ordered = []

    while remaining:
        # A leaf is a model that has no remaining child models.
        #
        # These must be deleted first.
        leaves = {
            model
            for model in remaining
            if not (
                children[model] & remaining
            )
        }

        if not leaves:
            cycle = ", ".join(
                sorted(
                    model._meta.label
                    for model in remaining
                )
            )

            raise RuntimeError(
                "Company deletion encountered an unexpected "
                "model dependency cycle: "
                f"{cycle}"
            )

        for model in sorted(
            leaves,
            key=lambda item: item._meta.label,
        ):
            ordered.append(model)
            remaining.remove(model)

    return ordered


@transaction.atomic
def delete_company_data(company):
    """
    Permanently delete a company and all company-owned records.

    The process is:

        1. Build the complete company-owned relationship graph.
        2. Exclude shared User records.
        3. Break nullable self-references.
        4. Calculate a child-to-parent deletion order.
        5. Delete every discovered company-owned record.
        6. Delete the Company itself.

    Because this function runs inside transaction.atomic(), any failure
    causes the entire operation to roll back.

    Returns:
        dict:
            A summary containing the number of deleted database rows for
            each model.
    """
    if company is None:
        raise ValueError(
            "A valid company is required for deletion."
        )

    # Make sure the company instance has a primary key.
    if not company.pk:
        raise ValueError(
            "The company must be saved before it can be deleted."
        )

    rows = _collect_company_graph(company)

    # Break nullable self-referencing relationships before calculating
    # the deletion order.
    _clear_nullable_self_references(rows)

    # Determine child-to-parent model deletion order.
    order = _deletion_order(rows)

    deleted = {}

    for model in order:
        ids = rows.get(model, set())

        if not ids:
            continue

        queryset = model._default_manager.filter(
            pk__in=ids,
        )

        count, _ = queryset.delete()

        deleted[model._meta.label] = count

    return deleted