"""
Step definitions for clock.feature using Behave.
"""

from behave import given, when, then
from playwright.sync_api import expect


@when("the employee clicks Clock In")
def step_click_clock_in(context):
    context.clock_page.clock_in()


@then("the active shift screen is displayed")
def step_verify_active_shift(context):
    expect(context.clock_page.screen_active_shift).to_be_visible()
    expect(context.clock_page.active_user_name).to_contain_text("Bob Staff")


@then("the live shift timer starts ticking")
def step_verify_timer_ticking(context):
    expect(context.clock_page.shift_duration_timer).to_be_visible()
    expect(context.clock_page.shift_duration_timer).to_contain_text("s")


@then("the employee GPS coordinates are displayed")
def step_verify_coords_displayed(context):
    expect(context.clock_page.shift_coords).to_be_visible()
    expect(context.clock_page.shift_coords).to_contain_text("°")


@given("an employee is currently clocked in with an active shift")
def step_employee_with_active_shift(context):
    session = {
        "name": "Bob Staff",
        "email": "bob@example.com",
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
    active_shift = {
        "id": "shift_test_001",
        "name": "Bob Staff",
        "email": "bob@example.com",
        "clockInTime": "9:00:00 AM",
        "clockInDate": "Sep 8, 2026",
        "clockInIso": "2026-09-08T16:00:00.000Z",
        "latitude": "37.77490",
        "longitude": "-122.41940",
        "accuracy": 15,
        "mapsUrl": "https://www.google.com/maps?q=37.77490,-122.41940",
        "status": "Clocked In",
        "serverSynced": True,
        "sheetRow": 12,
        "sheetTab": "Attendance"
    }
    context.clock_page.inject_session(session, active_shift)
    expect(context.clock_page.screen_active_shift).to_be_visible()


@when("the employee clicks Clock Out")
def step_click_clock_out(context):
    expect(context.clock_page.btn_clock_out).to_be_visible()
    context.clock_page.btn_clock_out.click()


@when("confirms clock out in the confirmation dialog")
def step_confirm_clock_out(context):
    expect(context.clock_page.confirm_modal).to_be_visible()
    expect(context.clock_page.btn_confirm_ok).to_be_visible()
    context.clock_page.btn_confirm_ok.click()


@then("the farewell shift completion summary is displayed")
def step_verify_farewell_summary(context):
    expect(context.clock_page.farewell_modal).to_be_visible()
    expect(context.clock_page.farewell_message).to_be_visible()


@then("the shift duration is shown")
def step_verify_duration_shown(context):
    expect(context.clock_page.farewell_message).to_contain_text("Great work today")
