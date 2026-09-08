"""
Behave environment configuration.
Handles Playwright lifecycle, background local HTTP server, and network route mocking.
"""

import os
import sys
import threading
import functools
from http.server import HTTPServer, SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright

TEST_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if TEST_DIR not in sys.path:
    sys.path.insert(0, TEST_DIR)

WORKSPACE_DIR = os.path.abspath(os.path.join(TEST_DIR, ".."))

from mocks.apps_script_mock import AppsScriptMock
from pages.clock_page import ClockPage


def before_all(context):
    """Starts local HTTP server and launches Playwright Chromium browser."""
    handler = functools.partial(SimpleHTTPRequestHandler, directory=WORKSPACE_DIR)
    context.server = HTTPServer(("127.0.0.1", 0), handler)
    port = context.server.server_address[1]
    context.server_thread = threading.Thread(target=context.server.serve_forever, daemon=True)
    context.server_thread.start()
    context.base_url = f"http://127.0.0.1:{port}"

    context.playwright = sync_playwright().start()
    context.browser = context.playwright.chromium.launch(
        headless=True,
        args=["--disable-web-security", "--no-sandbox"]
    )


def after_all(context):
    """Stops Playwright browser and terminates the local HTTP server."""
    if hasattr(context, "browser"):
        context.browser.close()
    if hasattr(context, "playwright"):
        context.playwright.stop()
    if hasattr(context, "server"):
        context.server.shutdown()
        context.server.server_close()


def before_scenario(context, scenario):
    """Initializes browser context with GPS mock and network route interception."""
    context.mock = AppsScriptMock()
    context.browser_context = context.browser.new_context(
        viewport={"width": 1280, "height": 850},
        geolocation={"latitude": 37.774929, "longitude": -122.419416},
        permissions=["geolocation"]
    )
    context.page = context.browser_context.new_page()
    context.page.route("**/*", context.mock.handle_route)
    context.clock_page = ClockPage(context.page, context.base_url)


def after_scenario(context, scenario):
    """Cleans up browser context after each scenario."""
    if hasattr(context, "page"):
        context.page.close()
    if hasattr(context, "browser_context"):
        context.browser_context.close()
