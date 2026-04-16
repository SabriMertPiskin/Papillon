# Selenium End-to-End Test Documentation

This folder contains Selenium-based end-to-end tests for the Papillon graduation project. The tests verify the main user journeys from the browser, including authentication, dashboard navigation, profile settings, security tools, malware upload UI, route protection, and optional cPanel telemetry integration.

## Test Scope

The Selenium suite is designed as a graduation-project level E2E regression suite. It focuses on proving that the most important user flows work through the actual UI.

Covered areas:

- User registration, login, invalid login, and logout flows.
- Dashboard and sidebar navigation.
- Protected route redirects and 404 page handling.
- Password analysis, text encryption, CVE, blacklist, Outlook, malware, and profile smoke flows.
- Profile password change flow.
- MFA setup card smoke test.
- Optional cPanel data page smoke test with real connection settings.

Not intended to be exhaustive:

- Full API-level edge-case coverage.
- Every possible validation message in every form.
- Mobile/responsive browser matrix.
- Full cPanel table value verification for every remote data source.

## Prerequisites

Start the backend and frontend before running these tests.

Recommended local setup:

```powershell
# Backend terminal
cd backend\papillon
python manage.py runserver
```

```powershell
# Frontend terminal
cd frontend
npm run dev
```

Install Python test dependencies:

```powershell
pip install -r requirements.txt
```

Chrome must be installed because the tests use Selenium with Chrome WebDriver.

## Default Test User

Most tests use the existing default account:

```text
Email: test@test.com
Password: 12345678
```

Only the registration tests create a new random user. Other tests intentionally reuse the default account so the suite does not register a new user before every test.

## Running The Full Selenium Suite

From the repository root:

```powershell
python -m unittest discover -s tests/selenium -p "test_*.py"
```

Expected result example:

```text
Ran 16 tests
OK (skipped=1)
```

The skipped test is usually the optional cPanel test when cPanel environment variables are not set.

## Running With Visible Step Delay

To visually follow each Selenium action, set a one-second delay:

```powershell
$env:SELENIUM_STEP_SLEEP="1"
python -m unittest discover -s tests/selenium -p "test_*.py"
```

To run faster again:

```powershell
$env:SELENIUM_STEP_SLEEP="0"
```

## Headless Mode

For CI or faster local runs:

```powershell
$env:SELENIUM_HEADLESS="1"
python -m unittest discover -s tests/selenium -p "test_*.py"
```

## cPanel Test Configuration

The cPanel Selenium test is optional. It is skipped automatically if cPanel connection environment variables are missing.

Set these variables before running the cPanel test:

```powershell
$env:CPANEL_HOST="srvc08.trwww.com"
$env:CPANEL_USERNAME="drfatmaa"
$env:CPANEL_API="your-cpanel-api-token"
$env:CPANEL_PASSWORD="your-cpanel-password"
```

Then run:

```powershell
python -m unittest tests.selenium.test_cpanel_flow
```

The cPanel test logs in with the default Papillon user, opens profile settings, saves the cPanel connection values, navigates to `/cpanel-data`, and passes when the expected cPanel data marker appears.

## Useful Single-Test Commands

Authentication flow:

```powershell
python -m unittest tests.selenium.test_auth_flow
```

Navigation flow:

```powershell
python -m unittest tests.selenium.test_navigation
```

Tool smoke tests:

```powershell
python -m unittest tests.selenium.test_tools
```

Profile flow:

```powershell
python -m unittest tests.selenium.test_profile_flow
```

Route guard and MFA smoke tests:

```powershell
python -m unittest tests.selenium.test_route_guards
```

Malware upload UI smoke test:

```powershell
python -m unittest tests.selenium.test_malware_smoke
```

## Debug Artifacts

The test helper can save screenshots and HTML snapshots under:

```text
tests/selenium/artifacts
```

These artifacts are useful when a test fails locally but the page visually appears to work.

## Graduation Project Notes

For the graduation project, this Selenium suite demonstrates that Papillon's core browser-based workflows are automatically testable. It should be presented as an E2E smoke and regression suite rather than a complete replacement for backend unit tests.

Recommended proof for the report or presentation:

- Include the command used to run the suite.
- Include the final terminal output showing `OK`.
- Mention that cPanel is optional and skipped unless real credentials are provided through environment variables.
