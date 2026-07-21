import jwt from "jsonwebtoken";

export const generateToken = (user) => {
    return jwt.sign(
        {
            id : user.id,
            email : user.email,
        },
        process.env.JWT_SECRET,
        {
            expiresIn : process.env.JWT_EXPIRES_IN,
        }
    );
};

// To verify token from client:-
export const verifyToken = (token) => {
    return jwt.verify(token, process.env.JWT_SECRET);
};