// Import required modules
import bcrypt from "bcrypt";
import User from "../../models/Users.js";
import { generateToken } from "../auth/jwt.js";

// ======================================================
// Register User
// ======================================================

import mongoose from "mongoose";

// In-memory mock for disconnected state
const mockUsers = [];

export const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    console.log("\n========== REGISTER REQUEST ==========");
    console.log("Request Body:", req.body);

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required",
      });
    }

    if (mongoose.connection.readyState !== 1) {
      console.warn("MongoDB not connected. Bypassing MongoDB for Registration.");
      
      if (mockUsers.find((u) => u.email === email.toLowerCase())) {
        return res.status(409).json({ success: false, message: "User already exists" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = { _id: Date.now().toString(), name: name.trim(), email: email.toLowerCase().trim(), password: hashedPassword, role: role || "interviewee" };
      mockUsers.push(newUser);

      const token = generateToken(newUser);
      return res.status(201).json({
        success: true,
        message: "User registered successfully (Mock)",
        token,
        user: { id: newUser._id, name: newUser.name, email: newUser.email, role: newUser.role },
      });
    }

    const existingUser = await User.findOne({
      email: email.toLowerCase(),
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role: role || "interviewee",
    });

    const token = generateToken(newUser);

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
    });
  } catch (error) {
    console.error("\n❌ Register Error:");
    console.error(error);
    return res.status(500).json({ success: false, message: "Failed to register user", error: error.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    if (mongoose.connection.readyState !== 1) {
      console.warn("MongoDB not connected. Bypassing MongoDB for Login.");
      const user = mockUsers.find((u) => u.email === email.toLowerCase().trim());

      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ success: false, message: "Invalid credentials" });
      }

      const token = generateToken(user);
      return res.status(200).json({
        success: true,
        message: "Login successful (Mock)",
        token,
        user: { id: user._id, name: user.name, email: user.email, role: user.role },
      });
    }

    const user = await User.findOne({
      email: email.toLowerCase().trim(),
    }).select("+password");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ success: false, message: "Failed to login", error: error.message });
  }
};

// ======================================================
// Logout User
// ======================================================

export const logout = (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Logout successful",
  });
};
