Feature: Subscription & Billing Management
  As a business administrator
  I want to view subscription pricing tiers and test payments
  So that I can maintain active attendance tracking for my business

  Scenario: Admin toggles billing cycle and views updated prices
    Given a business administrator is signed in to CrewClock
    When the administrator opens Billing Settings
    Then the billing modal displays available pricing plans
    When the administrator switches to "yearly" billing
    Then the pricing cards display discounted annual rates

  Scenario: Admin tests sandbox payment and receives activation receipt
    Given a business administrator is signed in to CrewClock
    When the administrator opens Billing Settings
    And completes a test sandbox card payment
    Then a payment receipt is displayed with active subscription status
