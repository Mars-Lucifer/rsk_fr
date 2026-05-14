#!/usr/bin/env python3
import argparse
import base64
import json
import sys
from datetime import datetime, timezone


def b64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def parse_json_part(part: str) -> dict:
    return json.loads(b64url_decode(part).decode("utf-8"))


def format_timestamp(value):
    if not isinstance(value, int):
        return value
    return datetime.fromtimestamp(value, tz=timezone.utc).isoformat()


def parse_jwt(token: str) -> dict:
    parts = token.strip().split(".")
    if len(parts) != 3:
        raise ValueError("JWT must contain exactly 3 dot-separated parts")

    header = parse_json_part(parts[0])
    payload = parse_json_part(parts[1])

    readable_payload = dict(payload)
    for key in ("iat", "nbf", "exp", "last_password_change"):
        if key in readable_payload:
            readable_payload[f"{key}_utc"] = format_timestamp(readable_payload[key])

    return {
        "header": header,
        "payload": readable_payload,
        "signature_present": bool(parts[2]),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Decode a JWT locally without verifying its signature.")
    parser.add_argument("token", nargs="?", help="JWT token. If omitted, stdin is used.")
    args = parser.parse_args()

    token = args.token or sys.stdin.read().strip()
    if not token:
        print("No token provided.", file=sys.stderr)
        return 2

    try:
        result = parse_jwt(token)
    except Exception as exc:
        print(f"Failed to decode JWT: {exc}", file=sys.stderr)
        return 1

    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
