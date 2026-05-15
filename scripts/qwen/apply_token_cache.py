#!/usr/bin/env python3
import json
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parents[1]
SETTINGS_FILE = PROJECT_ROOT / "data" / "mayak-settings.json"
CACHE_FILE = PROJECT_ROOT / "data" / "qwen-tokens-cache.json"


def account_from_index(index: int) -> str:
    return f"acc{index + 1:02d}"


def read_json(path: Path, fallback):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return fallback


def main() -> int:
    settings = read_json(SETTINGS_FILE, {})
    cache = read_json(CACHE_FILE, {})
    if not isinstance(settings, dict):
        settings = {}
    if not isinstance(cache, dict) or not cache:
        print(f"No token cache found: {CACHE_FILE}")
        return 1

    current_tokens = settings.get("qwenTokens")
    if not isinstance(current_tokens, list):
        current_tokens = []

    next_tokens = []
    used_accounts = set()

    for index, entry in enumerate(current_tokens):
        if not isinstance(entry, dict):
            continue
        account = str(entry.get("account") or entry.get("sessionAccount") or account_from_index(index)).strip()
        cached = cache.get(account) if account else None
        if isinstance(cached, dict) and cached.get("token"):
            email = str(cached.get("email") or entry.get("email") or "").strip()
            next_tokens.append(
                {
                    **entry,
                    "name": email or entry.get("name") or account,
                    "token": cached["token"],
                    "email": email,
                    "account": account,
                    "sessionAccount": entry.get("sessionAccount") or "",
                }
            )
            used_accounts.add(account)
        else:
            next_tokens.append({**entry, "account": account})
            used_accounts.add(account)

    for account in sorted(cache):
        if account in used_accounts:
            continue
        cached = cache.get(account)
        if not isinstance(cached, dict) or not cached.get("token"):
            continue
        email = str(cached.get("email") or "").strip()
        next_tokens.append(
            {
                "name": email or account,
                "token": cached["token"],
                "email": email,
                "account": account,
                "sessionAccount": "",
            }
        )

    settings["qwenTokens"] = next_tokens
    SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
    SETTINGS_FILE.write_text(json.dumps(settings, ensure_ascii=False, indent=2), encoding="utf-8")

    print("Updated Qwen tokens in data/mayak-settings.json:")
    for token in next_tokens:
        print(f"- {token.get('account')}: {token.get('email') or token.get('name') or '(no email)'}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
