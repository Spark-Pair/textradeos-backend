import express from "express";
import {
  createBusiness,
  getBusinesses,
  getBusinessById,
  updateBusiness,
  deleteBusiness,
  toggleBusinessStatus,
} from "../controllers/businessController.js";
import { requireRoles } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.route("/")
  .get(requireRoles(["developer"]), getBusinesses)
  .post(requireRoles(["developer"]), createBusiness);

router.route("/:id")
  .get(requireRoles(["developer"]), getBusinessById)
  .put(requireRoles(["developer"]), updateBusiness)
  .delete(requireRoles(["developer"]), deleteBusiness);

router.patch("/:id/toggle", requireRoles(["developer"]), toggleBusinessStatus);

export default router;
