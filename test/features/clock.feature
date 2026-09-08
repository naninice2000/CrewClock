Feature: Attendance Clock In and Out
  As a staff member
  I want to record my attendance using GPS-verified clock in and clock out
  So that my hours and location are reliably logged to Google Sheets

  Scenario: Staff member clocks in and sees active shift timer
    Given an employee is signed in to SheetPunch
    When the employee clicks Clock In
    Then the active shift screen is displayed
    And the live shift timer starts ticking
    And the employee GPS coordinates are displayed

  Scenario: Staff member clocks out with confirmation
    Given an employee is currently clocked in with an active shift
    When the employee clicks Clock Out
    And confirms clock out in the confirmation dialog
    Then the farewell shift completion summary is displayed
    And the shift duration is shown
