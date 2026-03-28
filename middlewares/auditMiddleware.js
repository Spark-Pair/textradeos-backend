import AuditLog from "../models/AuditLog.js";

const redact = (obj) => {
  if (!obj || typeof obj !== "object") return obj;
  const clone = Array.isArray(obj) ? [...obj] : { ...obj };
  const keys = ["password", "token", "jwt", "authorization", "sessionId"];
  for (const k of keys) {
    if (k in clone) clone[k] = "[REDACTED]";
  }
  return clone;
};

export const auditLogger = (req, res, next) => {
  const method = req.method?.toUpperCase();
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return next();

  res.on("finish", async () => {
    try {
      if (!req.user) return;
      const base = req.audit || {};
      await AuditLog.create({
        userId: req.user._id,
        businessId: req.user.businessId?._id || req.user.businessId || null,
        method,
        path: req.originalUrl,
        action: base.action,
        entity: base.entity,
        entityId: base.entityId,
        status: res.statusCode,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        meta: base.meta || redact(req.body),
      });
    } catch (err) {
      // Avoid blocking responses for audit failures
    }
  });

  next();
};
