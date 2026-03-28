import express from "express";
import { getUser, loginUser, logoutUser } from "../controllers/userController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/login", loginUser);
router.post("/logout", logoutUser);
router.get("/user/:id", protect, getUser);

export default router;
