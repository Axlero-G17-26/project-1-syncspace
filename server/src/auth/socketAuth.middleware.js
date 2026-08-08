import User from "../../models/Users.js";
import { verifyToken } from "./jwt.js";

const socketAuthMiddleware = async (socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token;

    if (!token) {
      return next(
        new Error("Authentication token is required"),
      );
    }

    const decoded = verifyToken(token);

    const user = await User.findById(
      decoded.id,
    ).select("-password");

    if (!user) {
      return next(
        new Error(
          "User associated with this token no longer exists",
        ),
      );
    }

    // Attach authenticated user to socket
    socket.user = user;

    next();
  } catch (error) {
    console.error(
      "Socket authentication error:",
      error,
    );

    if (error.name === "TokenExpiredError") {
      return next(
        new Error(
          "Authentication token has expired",
        ),
      );
    }

    if (error.name === "JsonWebTokenError") {
      return next(
        new Error(
          "Invalid authentication token",
        ),
      );
    }

    return next(
      new Error(
        "Socket authentication failed",
      ),
    );
  }
};

export default socketAuthMiddleware;