import {
  createSessionToken,
  isAdminConfigured,
  isPasswordValid,
  sessionCookie,
} from "@/lib/rosdk-confrencia/admin";
import { CREATE_SUBMISSION_LIMIT, rejectIfRateLimited } from "@/lib/rosdk-confrencia/rateLimit";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Тот же лимит, что и на публичных заявках: перебор пароля должен быть дорогим.
  if (rejectIfRateLimited(res, "admin-login", req, CREATE_SUBMISSION_LIMIT)) {
    return undefined;
  }

  if (!isAdminConfigured()) {
    res.writeHead(303, { Location: "/conferencia/admin?error=config" });
    res.end();
    return undefined;
  }

  if (!isPasswordValid(String(req.body?.password ?? ""))) {
    res.writeHead(303, { Location: "/conferencia/admin?error=1" });
    res.end();
    return undefined;
  }

  res.setHeader("Set-Cookie", sessionCookie(createSessionToken()));
  res.writeHead(303, { Location: "/conferencia/admin" });
  res.end();
  return undefined;
}
