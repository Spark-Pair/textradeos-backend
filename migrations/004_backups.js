import mongoose from "mongoose";

export const up = async () => {
  const db = mongoose.connection.db;
  const collection = db.collection("backupsnapshots");
  await collection.createIndex({ businessId: 1, createdAt: -1 });
};

export const down = async () => {
  const db = mongoose.connection.db;
  const collection = db.collection("backupsnapshots");
  try {
    await collection.dropIndex("businessId_1_createdAt_-1");
  } catch {}
};
