import { getTokenFromReq } from "../../../lib/auth";

export default function handler(req, res) {
  const token = getTokenFromReq(req);
  res.status(200).json({
    hasCookieHeader: !!req.headers.cookie,
    cookieHeader: req.headers.cookie || null,
    tokenFound: !!token,
  });
}