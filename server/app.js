require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();

// Allows client to make requests by using CORS:- 
// first middleware:-
app.use(
    cors({
        origin : "http://localhost:5173",
        methods : ["GET", "POST", "PUT", "DELETE"],
        credentials : true,
    })
);

app.use(express.json());

// Routes:-

app.get("/", (req,res) => {
    res.send("Syncspace backend is running");
})

// IF Client need to post -> testing part:-

app.post("/test", (req, res) => {
    console.log(req.body);

    res.json({
        success : true,
        message : "Data is received successfully",
        data : req.body,
    });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
})