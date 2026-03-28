import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business" },
    method: { type: String, required: true },
    path: { type: String, required: true },
    action: { type: String },
    entity: { type: String },
    entityId: { type: mongoose.Schema.Types.ObjectId },
    status: { type: Number },
    ipAddress: { type: String },
    userAgent: { type: String },
    meta: { type: Object },
  },
  { timestamps: true }
);

auditLogSchema.index({ businessId: 1, createdAt: -1 });
auditLogSchema.index({ userId: 1, createdAt: -1 });

const AuditLog = mongoose.model("AuditLog", auditLogSchema);
export default AuditLog;
