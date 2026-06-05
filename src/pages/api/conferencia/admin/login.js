import { ADMIN_COOKIE, getAdminPassword, isPasswordValid } from "@/lib/rosdk-confrencia/admin";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const password = String(req.body?.password ?? "");

  if (!isPasswordValid(password)) {
    res.writeHead(303, { Location: "/conferencia/admin?error=1" });
    res.end();
    return;
  }

  res.setHeader(
    "Set-Cookie",
    `${ADMIN_COOKIE}=${getAdminPassword()}; Path=/; HttpOnly; SameSite=Lax`
  );
  res.writeHead(303, { Location: "/conferencia/admin" });
  res.end();
}
