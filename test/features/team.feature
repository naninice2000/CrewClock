Feature: Team Management & Role-Based Access Control
  As a business administrator
  I want to view my team roster and invite new staff members
  So that authorized employees can log into CrewClock to track their shifts

  Scenario: Admin views team roster from mocked directory
    Given a business administrator is signed in to CrewClock
    When the administrator opens Team Management
    Then the team roster is loaded from the directory
    And existing staff members are listed in the team modal

  Scenario: Admin invites a new staff member
    Given a business administrator is signed in to CrewClock
    When the administrator opens Team Management
    And invites a new employee with email "charlie@example.com" and name "Charlie Staff"
    Then a success message confirms the invitation was sent
