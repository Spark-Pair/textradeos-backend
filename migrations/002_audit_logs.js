import mongoose from "mongoose";

export const up = async () => {
  const db = mongoose.connection.db;
  const collection = db.collection("auditlogs");
  await collection.createIndex({ businessId: 1, createdAt: -1 });
  await collection.createIndex({ userId: 1, createdAt: -1 });
};

export const down = async () => {
  const db = mongoose.connection.db;
  const collection = db.collection("auditlogs");
  try {
    await collection.dropIndex("businessId_1_createdAt_-1");
  } catch {}
  try {
    await collection.dropIndex("userId_1_createdAt_-1");
  } catch {}
};
