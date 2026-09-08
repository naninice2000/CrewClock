"""
Page Object Model (POM) for CrewClock Web Application.
Provides high-level interactions and element locators for test automation.
"""

import json
from playwright.sync_api import Page, expect


class ClockPage:
    """Page Object wrapping CrewClock UI interactions and DOM elements."""

    def __init__(self, page: Page, base_url: str):
        self.page = page
        self.base_url = base_url

        # Screens
        self.screen_login = page.locator("#screen-login")
        self.screen_ready = page.locator("#screen-clockin")
        self.screen_active_shift = page.locator("#screen-active-shift")

        # Login elements
        self.btn_login_trigger = page.locator("#btn-login-trigger")
        self.btn_signup_trigger = page.locator("#btn-signup-trigger")

        # Ready screen elements
        self.ready_user_name = page.locator("#ready-user-name")
        self.ready_user_email = page.locator("#ready-user-email")
        self.ready_role_badge = page.locator("#ready-role-badge")
        self.btn_clock_in = page.locator("#btn-clockin-trigger")

        # Active shift screen elements
        self.active_user_name = page.locator("#active-user-name")
        self.shift_clock_in_time = page.locator("#shift-clockin-time")
        self.shift_duration_timer = page.locator("#shift-duration-timer")
        self.shift_coords = page.locator("#shift-coords")
        self.btn_clock_out = page.locator("#btn-clockout-trigger")

        # Modals
        self.confirm_modal = page.locator("#confirm-modal")
        self.btn_confirm_ok = page.locator("#btn-confirm-ok")
        self.btn_confirm_cancel = page.locator("#btn-confirm-cancel")

        self.farewell_modal = page.locator("#farewell-modal")
        self.farewell_message = page.locator("#farewell-message")
        self.btn_close_farewell = page.locator("#btn-close-farewell")

        self.team_modal = page.locator("#team-modal")
        self.btn_open_team = page.locator("#btn-open-team")
        self.input_invite_email = page.locator("#input-team-email")
        self.input_invite_name = page.locator("#input-team-name")
        self.btn_send_invite = page.locator("#btn-submit-add-team")
        self.invite_status_msg = page.locator("#invite-status-msg")
        self.team_list = page.locator("#team-list-container")
        self.btn_close_team = page.locator("#btn-close-team")

        self.billing_modal = page.locator("#billing-modal")
        self.btn_open_billing = page.locator("#btn-open-billing")
        self.btn_cycle_monthly = page.locator("#btn-cycle-monthly")
        self.btn_cycle_yearly = page.locator("#btn-cycle-yearly")
        self.plan_card_starter = page.locator("#plan-card-starter")
        self.plan_card_growth = page.locator("#plan-card-growth")
        self.plan_card_scale = page.locator("#plan-card-scale")
        self.plan_price_starter = page.locator("#plan-price-starter")
        self.plan_price_growth = page.locator("#plan-price-growth")
        self.plan_price_scale = page.locator("#plan-price-scale")
        self.billing_charge_summary = page.locator("#billing-charge-summary")
        self.form_billing_payment = page.locator("#form-billing-payment")
        self.btn_submit_payment = page.locator("#btn-submit-payment")
        self.billing_receipt = page.locator("#billing-receipt-container")
        self.btn_finish_billing = page.locator("#btn-finish-billing")
        self.btn_sim_success = page.locator("#btn-sim-success")
        self.btn_close_billing = page.locator("#btn-close-billing")

        # History modal
        self.history_modal = page.locator("#history-modal")
        self.btn_open_history = page.locator("#btn-open-history")
        self.history_list = page.locator("#history-list-container")
        self.btn_close_history = page.locator("#btn-close-history")

    def goto_home(self):
        """Navigate to the CrewClock homepage."""
        self.page.goto(self.base_url)
        self.page.wait_for_load_state("domcontentloaded")

    def inject_session(self, user_session: dict, active_shift: dict = None):
        """Pre-inject user session into localStorage and navigate."""
        self.goto_home()
        session_json = json.dumps(user_session)
        script = f"localStorage.setItem('sheetpunch_user_session', '{session_json}');"
        if active_shift:
            shift_json = json.dumps(active_shift)
            script += f"localStorage.setItem('clockin_active_shift', '{shift_json}');"
        else:
            script += "localStorage.removeItem('clockin_active_shift');"
        self.page.evaluate(script)
        self.page.reload()
        self.page.wait_for_load_state("domcontentloaded")

    def login_as_employee(self, name="Bob Staff", email="bob@example.com"):
        session = {
            "name": name,
            "email": email,
            "role": "employee",
            "businessName": "Acme Coffee",
            "tenantId": "tenant_test_123",
            "attendanceScriptUrl": "mock_sheet_123",
            "timeZone": "America/Los_Angeles",
            "subscription": {
                "status": "trial",
                "plan": "14-Day Free Trial",
                "isValid": True,
                "daysRemaining": 14
            },
            "expiresAt": 9999999999999
        }
        self.inject_session(session)

    def login_as_admin(self, name="Jane Admin", email="admin@example.com"):
        session = {
            "name": name,
            "email": email,
            "role": "admin",
            "businessName": "Acme Coffee",
            "tenantId": "tenant_test_123",
            "attendanceScriptUrl": "mock_sheet_123",
            "timeZone": "America/Los_Angeles",
            "subscription": {
                "status": "trial",
                "plan": "14-Day Free Trial",
                "isValid": True,
                "isTrial": True,
                "daysRemaining": 14
            },
            "expiresAt": 9999999999999
        }
        self.inject_session(session)

    def clock_in(self):
        """Click Clock In button."""
        expect(self.btn_clock_in).to_be_visible()
        self.btn_clock_in.click()

    def clock_out(self):
        """Click Clock Out button and confirm."""
        expect(self.btn_clock_out).to_be_visible()
        self.btn_clock_out.click()
        expect(self.confirm_modal).to_be_visible()
        self.btn_confirm_ok.click()

    def open_team(self):
        """Open Team Management modal."""
        expect(self.btn_open_team).to_be_visible()
        self.btn_open_team.click()
        expect(self.team_modal).to_be_visible()

    def invite_member(self, email: str, name: str):
        """Send an invite to a new team member."""
        self.input_invite_email.fill(email)
        self.input_invite_name.fill(name)
        self.btn_send_invite.click()

    def open_billing(self):
        """Open Billing & Subscription modal."""
        expect(self.btn_open_billing).to_be_visible()
        self.btn_open_billing.click()
        expect(self.billing_modal).to_be_visible()

    def select_billing_cycle(self, cycle: str):
        """Toggle between monthly and yearly billing."""
        if cycle.lower() == "yearly":
            self.btn_cycle_yearly.click()
        else:
            self.btn_cycle_monthly.click()

    def complete_sandbox_payment(self):
        """Use sandbox simulator to quick-fill and submit payment."""
        self.btn_sim_success.click()
        self.btn_submit_payment.click()
