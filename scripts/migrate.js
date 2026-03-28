import fs from "fs";
import path from "path";
import url from "url";
import dotenv from "dotenv";
import connectDB from "../config/db.js";
import mongoose from "mongoose";

dotenv.config();

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.resolve(__dirname, "../migrations");

const MigrationSchema = new mongoose.Schema(
  {
    name: { type: String, unique: true },
    appliedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

const Migration = mongoose.model("Migration", MigrationSchema);

const listMigrationFiles = () => {
  return fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".js"))
    .sort();
};

const run = async () => {
  await connectDB();

  const direction = process.argv[2] || "up";
  const files = listMigrationFiles();
  const applied = new Set((await Migration.find({}).lean()).map((m) => m.name));

  if (direction === "up") {
    for (const file of files) {
      if (applied.has(file)) continue;
      const mod = await import(path.resolve(migrationsDir, file));
      if (typeof mod.up !== "function") {
        throw new Error(`Missing up() in ${file}`);
      }
      await mod.up();
      await Migration.create({ name: file });
      console.log(`Applied ${file}`);
    }
  } else if (direction === "down") {
    const last = files.reverse().find((f) => applied.has(f));
    if (!last) {
      console.log("No migrations to roll back.");
      return;
    }
    const mod = await import(path.resolve(migrationsDir, last));
    if (typeof mod.down !== "function") {
      throw new Error(`Missing down() in ${last}`);
    }
    await mod.down();
    await Migration.deleteOne({ name: last });
    console.log(`Rolled back ${last}`);
  } else {
    throw new Error("Usage: node scripts/migrate.js [up|down]");
  }
};

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
