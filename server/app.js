require("dotenv").config();
const express = require("express");
const app = express();

app.get("/", (req,res) => {
    res.send("Syncspace backend is running");
})

const port = process.env.port;

app.listen(port, () => {
    console.log("server is running on port 5000");
})