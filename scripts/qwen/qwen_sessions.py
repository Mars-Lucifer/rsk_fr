#!/usr/bin/env python3
import argparse
import json
import os
import re
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright

from parse_jwt import parse_jwt


QWEN_URL = "https://chat.qwen.ai/"
TOKEN_COOKIE_NAME = "token"
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parents[1]
SESSIONS_DIR = Path(os.environ.get("MAYAK_QWEN_SESSIONS_DIR", PROJECT_ROOT / "data" / "qwen-sessions"))
CACHE_FILE = Path(os.environ.get("MAYAK_QWEN_TOKEN_CACHE", PROJECT_ROOT / "data" / "qwen-tokens-cache.json"))
SETTINGS_FILE = PROJECT_ROOT / "data" / "mayak-settings.json"
IGNORED_EMAIL_DOMAINS = {
    "service.alibaba.com",
    "google.com",
    "broofa.com",
}


def safe_account_name(name: str) -> str:
    if not re.fullmatch(r"[A-Za-z0-9_.-]+", name):
        raise ValueError("Account name may contain only letters, numbers, dots, dashes, and underscores")
    return name


def account_dir(account: str) -> Path:
    return SESSIONS_DIR / safe_account_name(account)


def utc_from_ts(value: int) -> datetime:
    return datetime.fromtimestamp(value, tz=timezone.utc)


def load_cache() -> dict:
    if not CACHE_FILE.exists():
        return {}
    return json.loads(CACHE_FILE.read_text(encoding="utf-8"))


def save_cache(data: dict) -> None:
    CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
    CACHE_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def normalize_email(value: str | None) -> str | None:
    email = (value or "").strip().lower()
    if not EMAIL_RE.fullmatch(email):
        return None
    domain = email.split("@", 1)[1]
    if domain in IGNORED_EMAIL_DOMAINS:
        return None
    return email


def pick_best_email(candidates: list[str]) -> str | None:
    normalized = []
    for candidate in candidates:
        email = normalize_email(candidate)
        if email and email not in normalized:
            normalized.append(email)

    if not normalized:
        return None

    preferred_domains = ("gmail.com", "yandex.ru", "mail.ru", "outlook.com", "hotmail.com")
    for domain in preferred_domains:
        for email in normalized:
            if email.endswith(f"@{domain}"):
                return email

    return normalized[0]


def read_profile_email(account: str) -> str | None:
    profile = account_dir(account)
    candidates: list[str] = []
    for relative in ("Local State", "Default/Preferences", "Default/Secure Preferences"):
        file_path = profile / relative
        if not file_path.exists() or not file_path.is_file():
            continue
        try:
            text = file_path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        candidates.extend(EMAIL_RE.findall(text))
    return pick_best_email(candidates)


def read_page_email(page) -> str | None:
    try:
        data = page.evaluate(
            """
            () => {
              const dump = {
                title: document.title || "",
                url: location.href,
                text: document.body ? document.body.innerText : "",
                localStorage: {},
                sessionStorage: {},
              };
              for (let i = 0; i < localStorage.length; i += 1) {
                const key = localStorage.key(i);
                dump.localStorage[key] = localStorage.getItem(key);
              }
              for (let i = 0; i < sessionStorage.length; i += 1) {
                const key = sessionStorage.key(i);
                dump.sessionStorage[key] = sessionStorage.getItem(key);
              }
              return dump;
            }
            """
        )
    except PlaywrightError:
        return None

    return pick_best_email(EMAIL_RE.findall(json.dumps(data, ensure_ascii=False)))


def read_cached_email(account: str) -> str | None:
    cache = load_cache()
    return normalize_email(cache.get(account, {}).get("email"))


def read_settings_email(account: str) -> str | None:
    if not SETTINGS_FILE.exists():
        return None
    try:
        settings = json.loads(SETTINGS_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None

    tokens = settings.get("qwenTokens")
    if not isinstance(tokens, list):
        return None

    for entry in tokens:
        if not isinstance(entry, dict):
            continue
        entry_account = str(entry.get("account") or entry.get("sessionAccount") or "").strip()
        if entry_account == account:
            return normalize_email(entry.get("email"))

    return None


def resolve_email(account: str, page=None) -> str | None:
    page_email = read_page_email(page) if page is not None else None
    return page_email or read_profile_email(account) or read_cached_email(account) or read_settings_email(account)


def token_info(token: str, email: str | None = None) -> dict:
    parsed = parse_jwt(token)
    payload = parsed["payload"]
    exp = payload.get("exp")
    expires_at = utc_from_ts(exp) if isinstance(exp, int) else None
    return {
        "id": payload.get("id"),
        "exp": exp,
        "expires_at_utc": expires_at.isoformat() if expires_at else None,
        "days_left": round((expires_at - datetime.now(timezone.utc)).total_seconds() / 86400, 2) if expires_at else None,
        "token": token,
        "email": email,
    }


def print_token_info(account: str, info: dict, include_token: bool) -> None:
    public = dict(info)
    if not include_token:
        public.pop("token", None)
    print(json.dumps({account: public}, ensure_ascii=False, indent=2))


def get_token_from_context(context) -> str | None:
    try:
        cookies = context.cookies([QWEN_URL])
    except PlaywrightError:
        return None

    for cookie in cookies:
        if cookie.get("name") == TOKEN_COOKIE_NAME:
            return cookie.get("value")
    return None


def open_context(playwright, account: str, headless: bool = False):
    profile = account_dir(account)
    profile.mkdir(parents=True, exist_ok=True)
    options = {
        "user_data_dir": str(profile),
        "headless": headless,
        "viewport": {"width": 1280, "height": 900},
        "locale": "ru-RU",
        "args": ["--disable-blink-features=AutomationControlled"],
    }
    browser_channel = os.environ.get("MAYAK_QWEN_BROWSER_CHANNEL", "").strip() or ("chrome" if sys.platform == "win32" else "")
    if browser_channel:
        options["channel"] = browser_channel
    return playwright.chromium.launch_persistent_context(**options)


def get_login_timeout_seconds() -> int:
    raw_value = os.environ.get("MAYAK_QWEN_LOGIN_TIMEOUT_SECONDS", "").strip()
    try:
        value = int(raw_value)
    except ValueError:
        value = 600
    return value if value > 0 else 600


def login(account: str) -> int:
    print(f"Opening browser profile for account '{account}'.")
    print("Log in through Google if needed. This script will continue automatically when the Qwen token appears.")
    with sync_playwright() as playwright:
        context = open_context(playwright, account, headless=False)
        page = context.pages[0] if context.pages else context.new_page()
        page.goto(QWEN_URL, wait_until="domcontentloaded")
        token = None
        email = None
        deadline = time.monotonic() + get_login_timeout_seconds()

        while time.monotonic() < deadline:
            token = get_token_from_context(context)
            email = resolve_email(account, page)
            if token:
                break
            time.sleep(2)

        try:
            context.close()
        except PlaywrightError:
            pass

    if not token:
        print("No Qwen token cookie found. Make sure login is complete on chat.qwen.ai.", file=sys.stderr)
        return 1

    info = token_info(token, email=email)
    cache = load_cache()
    cache[account] = info
    save_cache(cache)
    print_token_info(account, info, include_token=False)
    return 0


def check(account: str, include_token: bool) -> int:
    with sync_playwright() as playwright:
        context = open_context(playwright, account, headless=True)
        page = context.pages[0] if context.pages else context.new_page()
        try:
            page.goto(QWEN_URL, wait_until="domcontentloaded")
            try:
                page.wait_for_load_state("networkidle", timeout=15000)
            except (PlaywrightTimeoutError, PlaywrightError):
                pass
            time.sleep(2)
        except PlaywrightError:
            pass
        token = get_token_from_context(context)
        email = resolve_email(account, page)
        context.close()

    if not token:
        print(f"No token found for '{account}'. Run: python3 qwen_sessions.py login {account}", file=sys.stderr)
        return 1

    info = token_info(token, email=email)
    cache = load_cache()
    cache[account] = info
    save_cache(cache)
    print_token_info(account, info, include_token=include_token)
    return 0


def refresh(account: str, days: int, include_token: bool, headless: bool = False) -> int:
    email = None
    with sync_playwright() as playwright:
        context = open_context(playwright, account, headless=headless)
        page = context.pages[0] if context.pages else context.new_page()
        try:
            page.goto(QWEN_URL, wait_until="domcontentloaded")
            try:
                page.wait_for_load_state("networkidle", timeout=15000)
            except (PlaywrightTimeoutError, PlaywrightError):
                pass
            time.sleep(3)
            token = get_token_from_context(context)
            email = resolve_email(account, page)
        except PlaywrightError:
            token = get_token_from_context(context)
            email = resolve_email(account, page)

        if not token:
            if headless:
                context.close()
                print(f"No token found for '{account}' in headless mode. Manual login is required.", file=sys.stderr)
                return 1
            print("No token found. Complete login in the opened browser, then press Enter here.")
            input()
            token = get_token_from_context(context)
            email = resolve_email(account, page)

        try:
            context.close()
        except PlaywrightError:
            pass

    if not token:
        print(f"No token found for '{account}' after refresh attempt.", file=sys.stderr)
        return 1

    info = token_info(token, email=email)
    exp = info.get("exp")
    if isinstance(exp, int):
        expires_at = utc_from_ts(exp)
        if expires_at - datetime.now(timezone.utc) > timedelta(days=days):
            print(f"Token is still valid for more than {days} days; Qwen may not rotate it yet.")

    cache = load_cache()
    cache[account] = info
    save_cache(cache)
    print_token_info(account, info, include_token=include_token)
    return 0


def saved_accounts() -> list[str]:
    if not SESSIONS_DIR.exists():
        return []
    return sorted(path.name for path in SESSIONS_DIR.iterdir() if path.is_dir())


def check_all(include_token: bool) -> int:
    accounts = saved_accounts()
    if not accounts:
        print("No account profiles found.")
        return 0

    status = 0
    for account in accounts:
        if check(account, include_token) != 0:
            status = 1
    return status


def refresh_all(days: int, include_token: bool, headless: bool = False) -> int:
    accounts = saved_accounts()
    if not accounts:
        print("No account profiles found.")
        return 0

    status = 0
    for account in accounts:
        if refresh(account, days=days, include_token=include_token, headless=headless) != 0:
            status = 1
    return status


def main() -> int:
    parser = argparse.ArgumentParser(description="Manage Qwen browser sessions and token cookies.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    login_parser = subparsers.add_parser("login", help="Open a persistent profile and log in manually")
    login_parser.add_argument("account", help="Local account profile name, e.g. acc01")

    check_parser = subparsers.add_parser("check", help="Read and decode token from a saved profile")
    check_parser.add_argument("account")
    check_parser.add_argument("--show-token", action="store_true", help="Print the raw token")

    refresh_parser = subparsers.add_parser("refresh", help="Open Qwen and let the site rotate token if possible")
    refresh_parser.add_argument("account")
    refresh_parser.add_argument("--days", type=int, default=5, help="Warn if token is valid longer than this")
    refresh_parser.add_argument("--show-token", action="store_true", help="Print the raw token")
    refresh_parser.add_argument("--headless", action="store_true", help="Run refresh without showing browser")

    all_parser = subparsers.add_parser("check-all", help="Check all saved account profiles")
    all_parser.add_argument("--show-token", action="store_true", help="Print raw tokens")

    refresh_all_parser = subparsers.add_parser("refresh-all", help="Refresh all saved account profiles")
    refresh_all_parser.add_argument("--days", type=int, default=5, help="Warn if token is valid longer than this")
    refresh_all_parser.add_argument("--show-token", action="store_true", help="Print raw tokens")
    refresh_all_parser.add_argument("--headless", action="store_true", help="Run refresh without showing browser")

    args = parser.parse_args()

    try:
        if args.command == "login":
            return login(args.account)
        if args.command == "check":
            return check(args.account, include_token=args.show_token)
        if args.command == "refresh":
            return refresh(args.account, days=args.days, include_token=args.show_token, headless=args.headless)
        if args.command == "check-all":
            return check_all(include_token=args.show_token)
        if args.command == "refresh-all":
            return refresh_all(days=args.days, include_token=args.show_token, headless=args.headless)
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 2

    return 2


if __name__ == "__main__":
    raise SystemExit(main())
