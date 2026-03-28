import express from "express";
import {
  createBackup,
  listBackups,
  getBackup,
  restoreBackup,
} from "../controllers/backupController.js";
import { requireRoles } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/", createBackup);
router.get("/", listBackups);
router.get("/:id", getBackup);
router.post("/:id/restore", requireRoles(["developer", "admin"]), restoreBackup);

export default router;
