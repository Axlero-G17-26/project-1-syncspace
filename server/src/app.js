import authRoutes from "./routes/auth.routes.js";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api/auth", authRoutes);

// Serve static client files
const clientDistPath = path.join(__dirname, "../../client/dist");
app.use(express.static(clientDistPath));

app.get("/api", (req, res) => {
  res.status(200).json({
    success: true,
    message: "syncspace backend is running",
  });
});

// Catch-all route to serve the React app will be attached in server.js


export default app;
