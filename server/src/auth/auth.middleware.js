import jwt from "jsonwebtoken";
import users from "../data/users.js";

// Creating a middelware:-
//         Client
//    │
//    ▼
// authMiddleware
//    │
//    ├── Invalid Token ❌
//    │        │
//    │        ▼
//    │   401 Unauthorized
//    │
//    └── Valid Token ✅
//             │
//             ▼
//           next()
//             │
//             ▼
//        Controller

export const authMiddleware = (req, res, next) => {
    // To read the AUTHORIZATION'S headers:-
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        res.status(401).json({
            message: "Access denied. No token provided.",
        });
    }

    if (!authHeader.startsWith("Bearer")) {
        res.status(401).json({
            message: "Invalid Token Format.",
        });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log("Decoded:", decoded);
        console.log("Users:", users);
        const user = users.find((user) => user.id == decoded.id);

        if (!user) {
            res.status(401).json({
                message: "User Not Found."
            });
        }
        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({
            message: "invalid or expired token.",
        });
    };
};