"""
Google Apps Script & Google API Network Mock for SheetPunch Playwright Tests.
Intercepts all outgoing HTTP calls to script.google.com, sheets.googleapis.com,
and googleapis.com to ensure 100% offline, deterministic, and safe testing.
"""

import json
from urllib.parse import urlparse, parse_qs
from datetime import datetime, timezone


class AppsScriptMock:
    """Mock handler for Google Apps Script Web App and Google Sheets REST API."""

    def __init__(self):
        self.team_roster = [
            {"name": "Jane Admin", "email": "admin@example.com", "role": "admin"},
            {"name": "Bob Staff", "email": "bob@example.com", "role": "employee"}
        ]
        self.logged_shifts = []
        self.payments = []

    def handle_route(self, route):
        request = route.request
        url = request.url
        parsed = urlparse(url)
        params = parse_qs(parsed.query)

        # 1. Google OAuth UserInfo Endpoint
        if "oauth2/v3/userinfo" in url:
            auth_header = request.headers.get("authorization", "")
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps({
                    "email": "admin@example.com",
                    "name": "Jane Admin",
                    "picture": ""
                })
            )
            return

        # 2. Google Sheets REST API v4
        if "sheets.googleapis.com" in url:
            if request.method == "GET":
                # Metadata or values check
                route.fulfill(
                    status=200,
                    content_type="application/json",
                    body=json.dumps({
                        "sheets": [{"properties": {"title": "Attendance"}}],
                        "values": [["Date", "Name", "Email", "ClockIn"]]
                    })
                )
                return
            elif request.method == "POST" and ":append" in url:
                route.fulfill(
                    status=200,
                    content_type="application/json",
                    body=json.dumps({
                        "updates": {"updatedRange": "Attendance!A12:K12"}
                    })
                )
                return
            elif request.method in ["PUT", "POST"]:
                route.fulfill(
                    status=200,
                    content_type="application/json",
                    body=json.dumps({"updatedCells": 5})
                )
                return

        # 3. Google Apps Script Web App (script.google.com)
        if "script.google.com" in url or "macros/s/" in url:
            action = params.get("action", [None])[0]

            # Server time sync (when no action specified or action == ping)
            if not action or action == "ping":
                now_iso = datetime.now(timezone.utc).isoformat()
                route.fulfill(
                    status=200,
                    content_type="application/json",
                    body=json.dumps({
                        "serverTimeIso": now_iso,
                        "timeZone": "America/Los_Angeles",
                        "serviceEmail": "service-mock@crewclock.test"
                    })
                )
                return

            if action == "check_user":
                email = params.get("email", [""])[0].lower()
                if "admin" in email:
                    resp = {
                        "exists": True,
                        "user": {"role": "admin", "tenantId": "tenant_test_123"},
                        "tenant": {
                            "businessName": "Acme Coffee",
                            "businessType": "Coffee Shop & Bakery",
                            "logoUrl": "",
                            "attendanceSheetId": "mock_sheet_123",
                            "timeZone": "America/Los_Angeles"
                        },
                        "subscription": {
                            "status": "trial",
                            "plan": "14-Day Free Trial",
                            "billingCycle": "trial",
                            "isTrial": True,
                            "isPaid": False,
                            "isValid": True,
                            "daysRemaining": 14,
                            "trialEndsAt": "2026-09-22T00:00:00.000Z",
                            "subscriptionEndsAt": "2026-09-22T00:00:00.000Z"
                        }
                    }
                elif "bob" in email or "staff" in email:
                    resp = {
                        "exists": True,
                        "user": {"role": "employee", "tenantId": "tenant_test_123"},
                        "tenant": {
                            "businessName": "Acme Coffee",
                            "businessType": "Coffee Shop & Bakery",
                            "timeZone": "America/Los_Angeles"
                        }
                    }
                else:
                    resp = {"exists": False}

                route.fulfill(
                    status=200,
                    content_type="application/json",
                    body=json.dumps(resp)
                )
                return

            if action == "signup":
                biz_name = params.get("businessName", ["New Workspace"])[0]
                route.fulfill(
                    status=200,
                    content_type="application/json",
                    body=json.dumps({
                        "success": True,
                        "tenant": {
                            "tenantId": "tenant_new_456",
                            "businessName": biz_name,
                            "timeZone": "America/Los_Angeles"
                        },
                        "subscription": {
                            "status": "trial",
                            "plan": "14-Day Free Trial",
                            "billingCycle": "trial",
                            "isTrial": True,
                            "isPaid": False,
                            "isValid": True,
                            "daysRemaining": 14
                        }
                    })
                )
                return

            if action == "log_shift":
                sub_action = params.get("subAction", ["clockin"])[0]
                self.logged_shifts.append({
                    "subAction": sub_action,
                    "email": params.get("email", [""])[0],
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })
                route.fulfill(
                    status=200,
                    content_type="application/json",
                    body=json.dumps({
                        "success": True,
                        "rowNumber": 12,
                        "tabName": "Attendance"
                    })
                )
                return

            if action == "get_team":
                route.fulfill(
                    status=200,
                    content_type="application/json",
                    body=json.dumps({
                        "success": True,
                        "team": self.team_roster
                    })
                )
                return

            if action == "invite_employee":
                invite_email = params.get("inviteEmail", [""])[0]
                invite_name = params.get("inviteName", ["Staff"])[0]
                self.team_roster.append({
                    "name": invite_name,
                    "email": invite_email,
                    "role": "employee"
                })
                route.fulfill(
                    status=200,
                    content_type="application/json",
                    body=json.dumps({"success": True})
                )
                return

            if action == "remove_employee":
                target_email = params.get("targetEmail", [""])[0]
                self.team_roster = [m for m in self.team_roster if m["email"] != target_email]
                route.fulfill(
                    status=200,
                    content_type="application/json",
                    body=json.dumps({"success": True})
                )
                return

            if action == "record_payment":
                plan_name = params.get("plan", ["Starter Crew (Monthly)"])[0]
                cycle = params.get("billingCycle", ["monthly"])[0]
                amount = params.get("paidAmount", ["$9.99"])[0]
                ref = params.get("paymentRef", ["PAY_MOCK_123"])[0]
                self.payments.append({"plan": plan_name, "cycle": cycle, "amount": amount, "ref": ref})

                route.fulfill(
                    status=200,
                    content_type="application/json",
                    body=json.dumps({
                        "success": True,
                        "payment": {
                            "subscriptionEndsAt": "2026-10-08T00:00:00.000Z"
                        },
                        "subscription": {
                            "status": "active",
                            "plan": plan_name,
                            "billingCycle": cycle,
                            "isTrial": False,
                            "isPaid": True,
                            "isValid": True,
                            "daysRemaining": 30,
                            "subscriptionEndsAt": "2026-10-08T00:00:00.000Z",
                            "paidAmount": amount,
                            "paymentRef": ref
                        }
                    })
                )
                return

            if action == "update_config":
                route.fulfill(
                    status=200,
                    content_type="application/json",
                    body=json.dumps({"success": True})
                )
                return

            # Default fallback for Apps Script
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps({"success": True, "mocked": True})
            )
            return

        # Pass through any local assets / server calls
        route.continue_()
