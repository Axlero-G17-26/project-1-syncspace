import authRoutes from "./routes/auth.routes.js";
import express from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api/auth", authRoutes);

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "syncspace backend is running",
  });
});

export default app;
