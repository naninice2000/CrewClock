"""
Step definitions for team.feature using Behave.
"""

from behave import when, then
from playwright.sync_api import expect


@when("the administrator opens Team Management")
def step_open_team(context):
    context.clock_page.open_team()


@then("the team roster is loaded from the directory")
def step_verify_roster_loaded(context):
    expect(context.clock_page.team_list).to_be_visible()


@then("existing staff members are listed in the team modal")
def step_verify_staff_listed(context):
    expect(context.clock_page.team_list).to_contain_text("Jane Admin")
    expect(context.clock_page.team_list).to_contain_text("Bob Staff")


@when('invites a new employee with email "{email}" and name "{name}"')
def step_invite_employee(context, email, name):
    context.clock_page.invite_member(email=email, name=name)


@then("a success message confirms the invitation was sent")
def step_verify_invite_success(context):
    expect(context.clock_page.invite_status_msg).to_be_visible()
    expect(context.clock_page.invite_status_msg).to_contain_text("Invitation sent")
