import express from "express";
import {
  createPlan,
  deletePlan,
  extendDeveloperSubscription,
  getDeveloperConsole,
  getDeveloperPayments,
  getDeveloperUsers,
  getPlans,
  updateDeveloperUser,
  updatePlan,
} from "../controllers/developerController.js";
import { requireRoles } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.use(requireRoles(["developer"]));

router.get("/console", getDeveloperConsole);
router.get("/users", getDeveloperUsers);
router.patch("/users/:id", updateDeveloperUser);
router.get("/payments", getDeveloperPayments);
router.patch("/subscriptions/:id/extend", extendDeveloperSubscription);

router.route("/plans")
  .get(getPlans)
  .post(createPlan);

router.route("/plans/:id")
  .put(updatePlan)
  .delete(deletePlan);

export default router;
