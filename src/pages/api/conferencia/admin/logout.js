import { clearedSessionCookie } from "@/lib/rosdk-confrencia/admin";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  res.setHeader("Set-Cookie", clearedSessionCookie());
  res.writeHead(303, { Location: "/conferencia/admin" });
  res.end();
  return undefined;
}
