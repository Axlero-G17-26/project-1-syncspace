// Import required modules
import bcrypt from "bcrypt";
import User from "../../models/Users.js";
import { generateToken } from "../auth/jwt.js";

// ======================================================
// Register User
// ======================================================

export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    console.log("\n========== REGISTER REQUEST ==========");
    console.log("Request Body:", req.body);

    // Basic validation
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required",
      });
    }

    // Check whether user already exists in MongoDB
    const existingUser = await User.findOne({
      email: email.toLowerCase(),
    });

    console.log("Existing User:", existingUser);

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User already exists",
      });
    }

    // Hash password before storing it
    const hashedPassword = await bcrypt.hash(password, 10);

    console.log("Password hashed successfully.");

    // Create user in MongoDB
    const newUser = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
    });

    console.log("\n✅ User saved successfully!");
    console.log(newUser);

    // Fetch all users from MongoDB
    const users = await User.find();

    console.log("\n========== USERS COLLECTION ==========");
    console.log("Total Users:", users.length);
    console.log(users);
    console.log("======================================\n");

    // Generate JWT token
    const token = generateToken(newUser);

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
      },
    });
  } catch (error) {
    console.error("\n❌ Register Error:");
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to register user",
      error: error.message,
    });
  }
};

// ======================================================
// Login User
// ======================================================

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Basic validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // Find user in MongoDB
    const user = await User.findOne({
      email: email.toLowerCase(),
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Compare entered password with hashed password
    const isPasswordValid = await bcrypt.compare(
      password,
      user.password,
    );

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Generate JWT token
    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to login",
      error: error.message,
    });
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