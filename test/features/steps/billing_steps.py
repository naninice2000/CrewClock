"""
Step definitions for billing.feature using Behave.
"""

from behave import when, then
from playwright.sync_api import expect


@when("the administrator opens Billing Settings")
def step_open_billing(context):
    context.clock_page.open_billing()


@then("the billing modal displays available pricing plans")
def step_verify_pricing_plans(context):
    expect(context.clock_page.billing_modal).to_be_visible()
    expect(context.clock_page.plan_card_starter).to_be_visible()
    expect(context.clock_page.plan_card_growth).to_be_visible()
    expect(context.clock_page.plan_card_scale).to_be_visible()


@when('the administrator switches to "{cycle}" billing')
def step_switch_cycle(context, cycle):
    context.clock_page.select_billing_cycle(cycle)


@then("the pricing cards display discounted annual rates")
def step_verify_discounted_rates(context):
    expect(context.clock_page.plan_price_starter).to_contain_text("$99.00")
    expect(context.clock_page.billing_charge_summary).to_contain_text("$99.00")


@when("completes a test sandbox card payment")
def step_complete_sandbox_payment(context):
    context.clock_page.complete_sandbox_payment()


@then("a payment receipt is displayed with active subscription status")
def step_verify_receipt(context):
    expect(context.clock_page.billing_receipt).to_be_visible()
    expect(context.clock_page.billing_receipt).to_contain_text("Payment Successful")
