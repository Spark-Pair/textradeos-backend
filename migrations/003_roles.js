import mongoose from "mongoose";

export const up = async () => {
  const db = mongoose.connection.db;
  await db.collection("users").updateMany(
    { role: { $exists: false } },
    { $set: { role: "user" } }
  );
};

export const down = async () => {
  // no-op
};
