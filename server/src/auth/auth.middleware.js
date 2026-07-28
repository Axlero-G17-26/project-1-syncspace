import jwt from "jsonwebtoken";
import User from "../../models/Users.js";


// ======================================================
// Authentication Middleware
// ======================================================

export const protect = async (req, res, next) => {
  try {
    let token;

    // Authorization header format:
    // Bearer eyJhbGciOiJIUzI1Ni...
    const authorizationHeader = req.headers.authorization;

    if (
      authorizationHeader &&
      authorizationHeader.startsWith("Bearer ")
    ) {
      token = authorizationHeader.split(" ")[1];
    }

    // Token missing
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication token is required",
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET,
    );

    // Find authenticated user in MongoDB
    const user = await User.findById(decoded.id).select(
      "-password",
    );

    // User may have been deleted after token was issued
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User associated with this token no longer exists",
      });
    }

    // Attach user to request
    req.user = user;

    next();
  } catch (error) {
    console.error("Authentication middleware error:", error);

    // Invalid or expired token
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token",
      });
    }

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Authentication token has expired",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Authentication failed",
      error: error.message,
    });
  }
};
// auth middleware