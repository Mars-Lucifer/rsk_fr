export const ADMIN_COOKIE = "rsk_admin";

export function getAdminPassword() {
  return process.env.ADMIN_PASSWORD || process.env.MAYAK_ADMIN_PASSWORD || "a12345";
}

export function isPasswordValid(password) {
  return password === getAdminPassword();
}

export function isAdminSession(req) {
  if (!req) return false;
  
  // Pages Router req.cookies
  if (req.cookies) {
    return req.cookies[ADMIN_COOKIE] === getAdminPassword();
  }
  
  return false;
}
