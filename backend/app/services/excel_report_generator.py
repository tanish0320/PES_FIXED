"""
SENTINEL Excel Report Generator - Data-Centric Format with Debugging
===================================================================
"""

import logging
import io
import os
from datetime import datetime
from typing import Dict, Any, List, Optional
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

logger = logging.getLogger(__name__)


class ExcelReportGenerator:
    """Generates data-centric Excel workbooks for investigation analysis."""

    HEADER_FILL = PatternFill(start_color="1F4E78", end_color="1F4E78", fill_type="solid")
    HEADER_FONT = Font(bold=True, color="FFFFFF", size=11)
    HEADER_ALIGNMENT = Alignment(horizontal="center", vertical="center", wrap_text=True)
    HEADER_BORDER = Border(
        left=Side(style="thin"),
        right=Side(style="thin"),
        top=Side(style="thin"),
        bottom=Side(style="thin")
    )

    ALT_FILL = PatternFill(start_color="F5F5F5", end_color="F5F5F5", fill_type="solid")

    @classmethod
    def generate(cls, case: Dict[str, Any], report: Dict[str, Any], transactions: List[Dict[str, Any]]) -> bytes:
        """
        Generate Excel workbook with complete debugging.

        Args:
            case: Case metadata
            report: Investigation report
            transactions: List of transactions

        Returns:
            Bytes of Excel workbook
        """
        case_id = case.get("account_id", "UNKNOWN")
        logger.info("[EXCEL] ===== START EXCEL GENERATION =====")
        logger.info("[EXCEL] Case ID: {}".format(case_id))
        logger.info("[EXCEL] Transactions count: {}".format(len(transactions)))

        try:
            # Step 1: Create workbook
            logger.info("[EXCEL] Step 1: Creating new Workbook object...")
            wb = Workbook()
            logger.info("[EXCEL] ✓ Workbook created successfully")
            logger.info("[EXCEL]   Type: {}".format(type(wb)))
            logger.info("[EXCEL]   Default sheet: {}".format(wb.active.title))

            # Step 2: Build sheets
            logger.info("[EXCEL] Step 2: Building worksheets...")

            ws = wb.active
            ws.title = "Case Summary"
            cls._build_case_summary(ws, case, report)
            logger.info("[EXCEL] ✓ Case Summary built")

            cls._build_transactions(wb, transactions)
            logger.info("[EXCEL] ✓ Transactions built")

            cls._build_money_flow(wb, case, report, transactions)
            logger.info("[EXCEL] ✓ Money Flow built")

            cls._build_entities(wb, report)
            logger.info("[EXCEL] ✓ Entities built")

            cls._build_timeline(wb, report)
            logger.info("[EXCEL] ✓ Timeline built")

            cls._build_risk_analysis(wb, case, report)
            logger.info("[EXCEL] ✓ Risk Analysis built")

            logger.info("[EXCEL] Sheets created: {}".format(", ".join(wb.sheetnames)))
            logger.info("[EXCEL] Total sheets: {}".format(len(wb.sheetnames)))

            # Step 3: Save to BytesIO
            logger.info("[EXCEL] Step 3: Saving workbook to BytesIO...")
            output = io.BytesIO()
            logger.info("[EXCEL]   BytesIO created: {}".format(type(output)))

            wb.save(output)
            logger.info("[EXCEL] ✓ wb.save(output) completed")

            output.seek(0)
            excel_bytes = output.getvalue()
            logger.info("[EXCEL] ✓ Bytes extracted from BytesIO")
            logger.info("[EXCEL]   Total bytes: {}".format(len(excel_bytes)))
            logger.info("[EXCEL]   First 20 bytes (hex): {}".format(excel_bytes[:20].hex()))

            # Check magic bytes (should be PK for ZIP)
            if excel_bytes[:2] == b'PK':
                logger.info("[EXCEL] ✓ Magic bytes correct (PK = ZIP format)")
            else:
                logger.error("[EXCEL] ✗ Magic bytes WRONG: {} instead of PK".format(excel_bytes[:2]))
                raise ValueError("Workbook bytes do not have ZIP magic number")

            # Step 4: Validate by reopening
            logger.info("[EXCEL] Step 4: Validating workbook by reopening...")
            try:
                test_io = io.BytesIO(excel_bytes)
                logger.info("[EXCEL]   Created test BytesIO with {} bytes".format(len(excel_bytes)))

                test_wb = load_workbook(test_io)
                logger.info("[EXCEL] ✓ load_workbook() succeeded")
                logger.info("[EXCEL]   Sheets in reopened workbook: {}".format(", ".join(test_wb.sheetnames)))
                logger.info("[EXCEL]   Sheet count: {}".format(len(test_wb.sheetnames)))

                if not test_wb.sheetnames:
                    raise ValueError("Reopened workbook has no sheets")

                # Verify first sheet
                first_ws = test_wb.active
                logger.info("[EXCEL] ✓ Accessed first sheet: {}".format(first_ws.title))
                logger.info("[EXCEL]   Max row: {}".format(first_ws.max_row))
                logger.info("[EXCEL]   Max column: {}".format(first_ws.max_column))

            except Exception as e:
                logger.error("[EXCEL] ✗ Validation FAILED: {}".format(str(e)))
                logger.error("[EXCEL]   Error type: {}".format(type(e).__name__))
                raise ValueError("Workbook validation failed: {}".format(str(e)))

            # Step 5: Final checks
            logger.info("[EXCEL] Step 5: Final checks...")
            logger.info("[EXCEL] ✓ Bytes length: {}".format(len(excel_bytes)))
            logger.info("[EXCEL] ✓ Bytes type: {}".format(type(excel_bytes)))
            logger.info("[EXCEL] ✓ Bytes are valid: {}".format(isinstance(excel_bytes, bytes)))

            logger.info("[EXCEL] ===== GENERATION COMPLETE =====")
            logger.info("[EXCEL] File ready for download: {} bytes".format(len(excel_bytes)))

            return excel_bytes

        except Exception as e:
            logger.error("[EXCEL] ===== GENERATION FAILED =====")
            logger.error("[EXCEL] Error: {}".format(str(e)))
            logger.error("[EXCEL] Type: {}".format(type(e).__name__))
            import traceback
            logger.error("[EXCEL] Traceback:\n{}".format(traceback.format_exc()))
            raise

    @classmethod
    def _build_case_summary(cls, ws, case: Dict[str, Any], report: Dict[str, Any]):
        """Build case summary sheet."""
        row = 1
        ws.merge_cells("A1:D1")
        title = ws["A1"]
        title.value = "Investigation Case Summary"
        title.font = Font(bold=True, size=14, color="FFFFFF")
        title.fill = PatternFill(start_color="1F4E78", end_color="1F4E78", fill_type="solid")
        title.alignment = Alignment(horizontal="center", vertical="center")
        ws.row_dimensions[1].height = 25
        row = 3

        data = [
            ["Case ID", case.get("account_id", "N/A")],
            ["Account Holder", case.get("holder_name", "N/A")],
            ["Risk Score", "{:.1f}%".format(case.get("risk_score", 0))],
            ["Risk Level", case.get("risk_level", "N/A").upper()],
            ["Generated", datetime.now().strftime("%Y-%m-%d %H:%M:%S")],
            ["Total Transactions", len(case.get("transactions", []))],
        ]

        for item in data:
            ws.cell(row, 1).value = item[0]
            ws.cell(row, 1).font = Font(bold=True)
            ws.cell(row, 2).value = item[1]
            row += 1

        row += 1
        ws.cell(row, 1).value = "Executive Summary"
        ws.cell(row, 1).font = Font(bold=True, size=11)
        row += 1

        summary = report.get("executive_summary", "")
        ws.merge_cells("A{}:D{}".format(row, row + 2))
        ws.cell(row, 1).value = summary
        ws.cell(row, 1).alignment = Alignment(wrap_text=True, vertical="top")

        ws.column_dimensions["A"].width = 25
        ws.column_dimensions["B"].width = 50
        ws.column_dimensions["C"].width = 20
        ws.column_dimensions["D"].width = 20

    @classmethod
    def _build_transactions(cls, wb: Workbook, transactions: List[Dict[str, Any]]):
        """Build transactions table."""
        ws = wb.create_sheet("Transactions")

        headers = ["Date", "Time", "Description", "Amount (₹)", "Type", "Channel", "Counterparty", "Risk Score (%)"]

        for col, header in enumerate(headers, 1):
            cell = ws.cell(1, col)
            cell.value = header
            cell.fill = cls.HEADER_FILL
            cell.font = cls.HEADER_FONT
            cell.alignment = cls.HEADER_ALIGNMENT
            cell.border = cls.HEADER_BORDER

        ws.freeze_panes = "A2"

        for row_idx, tx in enumerate(transactions, 2):
            ws.cell(row_idx, 1).value = tx.get("date", "")
            ws.cell(row_idx, 2).value = tx.get("time", "")
            ws.cell(row_idx, 3).value = tx.get("description", "")
            ws.cell(row_idx, 4).value = float(tx.get("amount", 0))
            ws.cell(row_idx, 4).number_format = '#,##0.00'
            ws.cell(row_idx, 5).value = "Debit" if tx.get("is_debit", True) else "Credit"
            ws.cell(row_idx, 6).value = tx.get("channel", "")
            ws.cell(row_idx, 7).value = tx.get("sender_account" if tx.get("is_debit") else "receiver_account", "")
            ws.cell(row_idx, 8).value = float(tx.get("risk_score", 0))
            ws.cell(row_idx, 8).number_format = '0.0'

            if row_idx % 2 == 0:
                for col in range(1, 9):
                    ws.cell(row_idx, col).fill = cls.ALT_FILL

        ws.column_dimensions["A"].width = 12
        ws.column_dimensions["B"].width = 12
        ws.column_dimensions["C"].width = 30
        ws.column_dimensions["D"].width = 15
        ws.column_dimensions["E"].width = 10
        ws.column_dimensions["F"].width = 12
        ws.column_dimensions["G"].width = 20
        ws.column_dimensions["H"].width = 12

    @classmethod
    def _build_money_flow(cls, wb: Workbook, case: Dict[str, Any], report: Dict[str, Any], transactions: List[Dict[str, Any]]):
        """Build money flow analysis sheet."""
        ws = wb.create_sheet("Money Flow Analysis")

        row = 1
        headers = ["Metric", "Value (₹)"]
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row, col)
            cell.value = header
            cell.fill = cls.HEADER_FILL
            cell.font = cls.HEADER_FONT
            cell.alignment = cls.HEADER_ALIGNMENT
            cell.border = cls.HEADER_BORDER

        row = 2
        flow = report.get("money_flow_summary", {})

        metrics = [
            ["Total Inflow", float(flow.get("total_inflow", 0))],
            ["Total Outflow", float(flow.get("total_outflow", 0))],
            ["Net Flow", float(flow.get("net_flow", 0))],
        ]

        for metric, value in metrics:
            ws.cell(row, 1).value = metric
            ws.cell(row, 1).font = Font(bold=True)
            ws.cell(row, 2).value = value
            ws.cell(row, 2).number_format = '#,##0.00'
            row += 1

        row += 2
        ws.cell(row, 1).value = "Top Beneficiaries"
        ws.cell(row, 1).font = Font(bold=True, size=11)
        row += 1

        benef_headers = ["Beneficiary", "Total Received (₹)", "Transaction Count"]
        for col, header in enumerate(benef_headers, 1):
            cell = ws.cell(row, col)
            cell.value = header
            cell.fill = cls.HEADER_FILL
            cell.font = cls.HEADER_FONT
            cell.alignment = cls.HEADER_ALIGNMENT
            cell.border = cls.HEADER_BORDER

        row += 1
        for benef in report.get("top_beneficiaries", []):
            ws.cell(row, 1).value = benef.get("name", "")
            ws.cell(row, 2).value = float(benef.get("total_received", 0))
            ws.cell(row, 2).number_format = '#,##0.00'
            ws.cell(row, 3).value = int(benef.get("tx_count", 0))
            row += 1

        ws.column_dimensions["A"].width = 25
        ws.column_dimensions["B"].width = 20
        ws.column_dimensions["C"].width = 20

    @classmethod
    def _build_entities(cls, wb: Workbook, report: Dict[str, Any]):
        """Build entities table."""
        ws = wb.create_sheet("Entities")

        row = 1
        entities = report.get("extracted_entities", {})

        entity_types = [
            ("Names", entities.get("names", [])),
            ("Accounts", entities.get("accounts", [])),
            ("UPI IDs", entities.get("upi_ids", [])),
            ("IFSC Codes", entities.get("ifsc", [])),
            ("Beneficiaries", entities.get("beneficiaries", [])),
            ("Merchants", entities.get("merchants", [])),
            ("Banks", entities.get("banks", [])),
        ]

        for entity_type, entity_list in entity_types:
            if not entity_list:
                continue

            ws.cell(row, 1).value = entity_type
            ws.cell(row, 1).font = Font(bold=True, size=11, color="FFFFFF")
            ws.cell(row, 1).fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
            row += 1

            for entity in entity_list:
                ws.cell(row, 1).value = entity.get("value", "")
                ws.cell(row, 2).value = int(entity.get("occurrences", 1))
                row += 1

            row += 1

        ws.column_dimensions["A"].width = 35
        ws.column_dimensions["B"].width = 15

    @classmethod
    def _build_timeline(cls, wb: Workbook, report: Dict[str, Any]):
        """Build timeline table."""
        ws = wb.create_sheet("Timeline")

        headers = ["Date", "Time", "Event", "Amount (₹)", "Risk Flag", "Pattern"]
        for col, header in enumerate(headers, 1):
            cell = ws.cell(1, col)
            cell.value = header
            cell.fill = cls.HEADER_FILL
            cell.font = cls.HEADER_FONT
            cell.alignment = cls.HEADER_ALIGNMENT
            cell.border = cls.HEADER_BORDER

        ws.freeze_panes = "A2"

        row = 2
        for event in report.get("timeline", []):
            ws.cell(row, 1).value = event.get("date", "")
            ws.cell(row, 2).value = event.get("time", "")
            ws.cell(row, 3).value = event.get("event", "")
            ws.cell(row, 4).value = float(event.get("amount", 0)) if event.get("amount") else 0
            ws.cell(row, 4).number_format = '#,##0.00'
            ws.cell(row, 5).value = "Yes" if event.get("risk_flag") else "No"
            ws.cell(row, 6).value = event.get("pattern", "")

            if row % 2 == 0:
                for col in range(1, 7):
                    ws.cell(row, col).fill = cls.ALT_FILL

            row += 1

        ws.column_dimensions["A"].width = 15
        ws.column_dimensions["B"].width = 12
        ws.column_dimensions["C"].width = 25
        ws.column_dimensions["D"].width = 15
        ws.column_dimensions["E"].width = 12
        ws.column_dimensions["F"].width = 20

    @classmethod
    def _build_risk_analysis(cls, wb: Workbook, case: Dict[str, Any], report: Dict[str, Any]):
        """Build risk analysis sheet."""
        ws = wb.create_sheet("Risk Analysis")

        row = 1
        headers = ["Metric", "Value"]
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row, col)
            cell.value = header
            cell.fill = cls.HEADER_FILL
            cell.font = cls.HEADER_FONT
            cell.alignment = cls.HEADER_ALIGNMENT
            cell.border = cls.HEADER_BORDER

        row = 2
        metrics = [
            ["Risk Score", "{:.1f}%".format(case.get("risk_score", 0))],
            ["Risk Level", case.get("risk_level", "N/A").upper()],
            ["Detected Patterns", len(report.get("detected_patterns", []))],
            ["High Risk Transactions", len(report.get("high_risk_transactions", []))],
            ["Unique Counterparties", report.get("money_flow_summary", {}).get("unique_counterparties", 0)],
        ]

        for metric, value in metrics:
            ws.cell(row, 1).value = metric
            ws.cell(row, 1).font = Font(bold=True)
            ws.cell(row, 2).value = str(value)
            row += 1

        row += 2
        ws.cell(row, 1).value = "Detected Patterns"
        ws.cell(row, 1).font = Font(bold=True, size=11)
        row += 1

        pattern_headers = ["Pattern Name", "Severity", "Confidence (%)", "Description"]
        for col, header in enumerate(pattern_headers, 1):
            cell = ws.cell(row, col)
            cell.value = header
            cell.fill = cls.HEADER_FILL
            cell.font = cls.HEADER_FONT
            cell.alignment = cls.HEADER_ALIGNMENT
            cell.border = cls.HEADER_BORDER

        row += 1
        for pattern in report.get("detected_patterns", []):
            ws.cell(row, 1).value = pattern.get("name", "")
            ws.cell(row, 2).value = pattern.get("severity", "").upper()
            ws.cell(row, 3).value = float(pattern.get("confidence", 0))
            ws.cell(row, 3).number_format = '0.0'
            ws.cell(row, 4).value = pattern.get("description", "")
            row += 1

        ws.column_dimensions["A"].width = 25
        ws.column_dimensions["B"].width = 15
        ws.column_dimensions["C"].width = 15
        ws.column_dimensions["D"].width = 40
