import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({ message: "Not authorized, no token" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.token = token;
    req.sessionId = decoded.sessionId;

    // Fetch user from DB
    const user = await User.findById(decoded.id)
      .populate("businessId", "name isActive");

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: "Not authorized, token failed" });
  }
};

export const requireRoles = (roles = []) => (req, res, next) => {
  if (!req.user || (roles.length && !roles.includes(req.user.role))) {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
};

export const tenantGuard = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  if (req.user.role === "developer") return next();
  if (!req.user.businessId) {
    return res.status(403).json({ message: "No business assigned" });
  }
  if (req.user.businessId && req.user.businessId.isActive === false) {
    return res.status(403).json({ message: "Business is inactive" });
  }
  next();
};
