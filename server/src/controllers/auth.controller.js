//  importing :-
import bcrypt from "bcrypt";
import users from "../data/users.js";
import { generateToken } from "../auth/jwt.js";

//  testing mail and password are valid or ?, we can use postman to test:-
export const register = async (req, res) => {
    const { name, email, password } = req.body;

    const existingUser = users.find((user) => user.email === email);

    if (existingUser) {
        return res.status(409).json({
            message: "User already exists",
        });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = {
        id: (users.length + 1).toString(),
        name,
        email,
        password: hashedPassword,
    };

    users.push(newUser);

    const token = generateToken(newUser);

    return res.status(201).json({
        message: "User registered successfully",
        token,
    });
};

export const login = async (req, res) => {
    const { email, password } = req.body;
// if the user mail is equal to that mail we have created in the user.js:-
    const user = users.find((user) => user.email === email);
// if the email is not valid:-
    if (!user) {
        return res.status(404).json({
            message: "User not found",
        });
    }
// Note :- password is nothing but that we have been used in users.js
    const isPasswordValid = await bcrypt.compare(
        password,
        user.password
    );
// if the password is not valid :-
    if (!isPasswordValid) {
        return res.status(401).json({
            message: "Invalid credentials",
        });
    }

// if both mail and password are correct, create a token and send positive response:- 

    const token = generateToken(user);

    return res.status(200).json({
        message: "Login successful",
        token,
    });
};