// import jwt from "jsonwebtoken";

// export const generateToken = (user) => {
//     return jwt.sign(
//         {
//             id : user.id,
//             email : user.email,
//         },
//         process.env.JWT_SECRET,
//         {
//             expiresIn : process.env.JWT_EXPIRES_IN,
//         }
//     );
// };

// // To verify token from client:-
// export const verifyToken = (token) => {
//     return jwt.verify(token, process.env.JWT_SECRET);
// };

import jwt from "jsonwebtoken";

// ======================================================
// Generate JWT Token
// ======================================================

export const generateToken = (user) => {
  const payload = {
    id: user._id.toString(),
    email: user.email,
  };

  return jwt.sign(
    payload,
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN,
    }
  );
};

// ======================================================
// Verify JWT Token
// ======================================================

export const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};