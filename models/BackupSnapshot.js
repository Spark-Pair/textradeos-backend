import mongoose from "mongoose";

const backupSnapshotSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    scope: { type: String, enum: ["business"], default: "business" },
    note: { type: String },
    data: { type: Object, required: true },
    size: { type: Number },
  },
  { timestamps: true }
);

backupSnapshotSchema.index({ businessId: 1, createdAt: -1 });

const BackupSnapshot = mongoose.model("BackupSnapshot", backupSnapshotSchema);
export default BackupSnapshot;
