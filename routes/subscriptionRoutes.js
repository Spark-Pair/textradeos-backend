import express from "express";
import {
  createSubscription,
  getSubscriptions,
  getSubscriptionById,
  updateSubscription,
  deleteSubscription,
  getMySubscriptionStatus,
  toggleSubscriptionStatus,
} from "../controllers/subscriptionController.js";
import { requireRoles, tenantGuard } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.route('/my-status').get(tenantGuard, getMySubscriptionStatus);

router.route("/")
  .get(requireRoles(["developer"]), getSubscriptions)
  .post(requireRoles(["developer"]), createSubscription);

router.route("/:id")
  .get(requireRoles(["developer"]), getSubscriptionById)
  .put(requireRoles(["developer"]), updateSubscription)
  .delete(requireRoles(["developer"]), deleteSubscription);

router.patch("/:id/toggle", requireRoles(["developer"]), toggleSubscriptionStatus);

export default router;
