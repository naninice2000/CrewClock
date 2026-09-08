"""
Shared step definitions for Behave BDD tests.
"""

from behave import given
from playwright.sync_api import expect


@given("a business administrator is signed in to SheetPunch")
@given("a business administrator is signed in to CrewClock")
def step_admin_signed_in(context):
    context.clock_page.login_as_admin(name="Jane Admin", email="admin@example.com")
    expect(context.clock_page.screen_ready).to_be_visible()
    expect(context.clock_page.ready_role_badge).to_contain_text("Business Admin")


@given("an employee is signed in to SheetPunch")
@given("an employee is signed in to CrewClock")
def step_employee_signed_in(context):
    context.clock_page.login_as_employee(name="Bob Staff", email="bob@example.com")
    expect(context.clock_page.screen_ready).to_be_visible()
    expect(context.clock_page.ready_user_name).to_contain_text("Bob Staff")
