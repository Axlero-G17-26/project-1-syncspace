import { authMiddleware } from "../auth/auth.middleware.js";
import express from "express";
import { login, register, logout } from "../controllers/auth.controller.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/logout", authMiddleware, logout);
router.get("/profile", authMiddleware, (req, res) => {
    res.status(200).json({
        message: "Profile fetched successfully",
        user: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
    },
    });
});

export default router;