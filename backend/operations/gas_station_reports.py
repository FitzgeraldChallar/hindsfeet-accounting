from decimal import Decimal

from .models import PumpSale


class GasStationDailyReportService:
    """
    Generates daily operational reports for gas stations.

    This service only works with companies whose business_type
    is GAS_STATION.
    """

    GAS_STATION_BUSINESS_TYPE = "GAS_STATION"

    @staticmethod
    def _validate_company(company):
        if company.business_type != (
            GasStationDailyReportService.GAS_STATION_BUSINESS_TYPE
        ):
            raise ValueError(
                "Gas station reports are only available "
                "for gas station companies."
            )

    @staticmethod
    def daily_report(
        *,
        company,
        report_date,
    ):
        """
        Generate a complete daily fuel-sales report.

        Includes:

        - Total fuel sales
        - Total litres sold
        - Sales by fuel
        - Sales by attendant
        - Sales by pump
        - Sales by payment method
        - Individual sale records
        """

        GasStationDailyReportService._validate_company(
            company
        )

        sales = (
            PumpSale.objects
            .filter(
                company=company,
                sale_date=report_date,
                status=PumpSale.Status.COMPLETED,
            )
            .select_related(
                "attendant",
                "pump",
                "fuel_product",
            )
            .order_by(
                "attendant__full_name",
                "pump__pump_number",
                "id",
            )
        )

        total_amount = Decimal("0.00")
        total_litres = Decimal("0.000")

        by_fuel = {}
        by_attendant = {}
        by_pump = {}
        by_payment_method = {}

        transactions = []

        for sale in sales:
            amount = sale.total_amount
            litres = sale.litres_sold

            total_amount += amount
            total_litres += litres

            # -----------------------------
            # BY FUEL
            # -----------------------------

            fuel_key = sale.fuel_product_id

            if fuel_key not in by_fuel:
                by_fuel[fuel_key] = {
                    "product_id": sale.fuel_product_id,
                    "product_code": sale.fuel_product.code,
                    "product_name": sale.fuel_product.name,
                    "litres_sold": Decimal("0.000"),
                    "total_sales": Decimal("0.00"),
                }

            by_fuel[fuel_key]["litres_sold"] += litres
            by_fuel[fuel_key]["total_sales"] += amount

            # -----------------------------
            # BY ATTENDANT
            # -----------------------------

            attendant_key = sale.attendant_id

            if attendant_key not in by_attendant:
                by_attendant[attendant_key] = {
                    "attendant_id": sale.attendant_id,
                    "employee_code": (
                        sale.attendant.employee_code
                    ),
                    "attendant_name": (
                        sale.attendant.full_name
                    ),
                    "litres_sold": Decimal("0.000"),
                    "total_sales": Decimal("0.00"),
                    "transactions": 0,
                }

            by_attendant[attendant_key]["litres_sold"] += litres
            by_attendant[attendant_key]["total_sales"] += amount
            by_attendant[attendant_key]["transactions"] += 1

            # -----------------------------
            # BY PUMP
            # -----------------------------

            pump_key = sale.pump_id

            if pump_key not in by_pump:
                by_pump[pump_key] = {
                    "pump_id": sale.pump_id,
                    "pump_number": (
                        sale.pump.pump_number
                    ),
                    "litres_sold": Decimal("0.000"),
                    "total_sales": Decimal("0.00"),
                    "transactions": 0,
                }

            by_pump[pump_key]["litres_sold"] += litres
            by_pump[pump_key]["total_sales"] += amount
            by_pump[pump_key]["transactions"] += 1

            # -----------------------------
            # BY PAYMENT METHOD
            # -----------------------------

            payment_key = sale.payment_method

            if payment_key not in by_payment_method:
                by_payment_method[payment_key] = {
                    "payment_method": (
                        sale.payment_method
                    ),
                    "payment_method_display": (
                        sale.get_payment_method_display()
                    ),
                    "total_sales": Decimal("0.00"),
                    "transactions": 0,
                }

            by_payment_method[payment_key]["total_sales"] += amount
            by_payment_method[payment_key]["transactions"] += 1

            # -----------------------------
            # INDIVIDUAL TRANSACTION
            # -----------------------------

            transactions.append({
                "id": sale.id,
                "reference": sale.reference,
                "attendant_id": sale.attendant_id,
                "attendant_name": (
                    sale.attendant.full_name
                ),
                "employee_code": (
                    sale.attendant.employee_code
                ),
                "pump_id": sale.pump_id,
                "pump_number": (
                    sale.pump.pump_number
                ),
                "fuel_product_id": (
                    sale.fuel_product_id
                ),
                "fuel_product": (
                    sale.fuel_product.name
                ),
                "opening_meter": sale.opening_meter,
                "closing_meter": sale.closing_meter,
                "litres_sold": sale.litres_sold,
                "price_per_litre": (
                    sale.price_per_litre
                ),
                "total_amount": sale.total_amount,
                "payment_method": sale.payment_method,
                "payment_method_display": (
                    sale.get_payment_method_display()
                ),
                "sale_date": sale.sale_date,
                "notes": sale.notes,
            })

        return {
            "company": company.id,
            "company_name": company.name,
            "report_date": report_date,

            "fuel_sales": {
                "total_litres": total_litres,
                "total_amount": total_amount,
            },

            "by_fuel": list(
                by_fuel.values()
            ),

            "by_attendant": list(
                by_attendant.values()
            ),

            "by_pump": list(
                by_pump.values()
            ),

            "by_payment_method": list(
                by_payment_method.values()
            ),

            "transactions": transactions,

            "transaction_count": len(
                transactions
            ),
        }
    