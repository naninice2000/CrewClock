# CrewClock - Python + Playwright BDD Test Automation (Behave)

End-to-End Behavior-Driven Development (BDD) test automation for the CrewClock web application using **Python**, **Playwright**, and **Behave** (native Python Cucumber BDD runner).

---

## Architecture & Features

- **Pure Python BDD (`behave`)**: Readable Gherkin `.feature` specifications mapped directly to step definitions in `test/features/steps/`.
- **Page Object Model (POM)**: High-level UI abstraction layer in `test/pages/clock_page.py`.
- **Zero External Network Dependencies**: All calls to **Google Apps Script Web Apps** (`script.google.com/**`) and **Google Sheets REST API** (`sheets.googleapis.com/**`) are intercepted and mocked in Playwright using `page.route()`. Tests run completely offline and never touch production Google Sheets or AppScript deployments.
- **Ephemeral Local Web Server**: Tests automatically boot a lightweight local HTTP server on an open ephemeral port (`127.0.0.1:0`) in `environment.py` and tear it down after testing.
- **GPS Simulation**: Headless Chromium is pre-configured with geolocation permissions (`37.7749°, -122.4194°`) to test real coordinate capture.

---

## Directory Structure

```
test/
├── README.md                      # Test suite documentation
├── requirements.txt               # Dependencies (behave, playwright)
├── mocks/
│   ├── __init__.py
│   └── apps_script_mock.py        # Network route interceptor for Apps Script actions
├── pages/
│   ├── __init__.py
│   └── clock_page.py              # Page Object Model locators and actions
└── features/
    ├── environment.py             # Behave lifecycle hooks (http server, browser, mock routing)
    ├── clock.feature              # Clock in, active shift timer, clock out confirmation
    ├── team.feature               # Admin viewing roster, inviting new employee
    ├── billing.feature            # Plan rates, annual/monthly toggles, test checkout
    └── steps/
        ├── __init__.py
        ├── common_steps.py        # Shared auth steps (Admin/Employee sign-in)
        ├── clock_steps.py         # Step mappings for clock.feature
        ├── team_steps.py          # Step mappings for team.feature
        └── billing_steps.py       # Step mappings for billing.feature
```

---

## Running Tests

### 1. Setup Virtual Environment
```bash
python3 -m venv .venv
.venv/bin/pip install -r test/requirements.txt
.venv/bin/playwright install chromium
```

### 2. Run All BDD Tests with Behave
```bash
.venv/bin/behave test/features
```
*(Or if `.venv` is activated: `behave test/features`)*

### 3. Run a Specific Feature
```bash
.venv/bin/behave test/features/clock.feature
.venv/bin/behave test/features/team.feature
.venv/bin/behave test/features/billing.feature
```
