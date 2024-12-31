import cors from "cors";
import express from "express";
import { Server } from "socket.io";
import { client } from "./whatsapp.js";
import { createServer } from "http";

const PORT = 5000;
let isConnected = false;
let cachedQR = null;

const app = express();

app.use(express.json());
app.use(
  cors({
    origin: "http://localhost:5173",
  }),
);

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
  },
});

io.on("connection", (socket) => {
  console.log("[SOCKET]: socket connected", socket.id);

  socket.on("disconnect", (reason) => {
    cachedQR = null;
    console.log("[SOCKET]: socket disconnected", reason);
  });

  if (isConnected) {
    socket.emit("status", {
      message: "[STATUS]: WhatsApp user connected",
      connected: true,
      data: client.info.me.user,
    });
  } else {
    socket.emit("status", {
      message: "[STATUS]: WhatsApp user disconnected",
      connected: false,
      data: undefined,
    });

    if (cachedQR) {
      socket.emit("qr", cachedQR);
    }
  }
});

client.on("qr", (qr) => {
  if (!isConnected && !cachedQR) {
    console.log("[WHATSAPP]: Generating QR code");

    cachedQR = qr;
    io.emit("qr", cachedQR);
  }
});

client.on("ready", () => {
  isConnected = true;
  cachedQR = null;
  io.emit("status", {
    message: "[STATUS]: WhatsApp user connected",
    connected: true,
    data: client.info.me.user,
  });
});

client.on("disconnected", () => {
  isConnected = false;
  io.emit("status", {
    message: "[STATUS]: WhatsApp user disconnected, need to reconnect",
    connected: false,
    data: undefined,
  });
});

app.post("/sendMessage", async (req, res) => {
  if (isConnected) {
    try {
      // throw new Error("Error trying to send message");

      const { phone, message } = req.body;
      const phoneId = phone + "@c.us";

      const number_details = await client.getNumberId(phoneId);
      if (number_details) {
        await client.sendMessage(phoneId, message);

        res.status(200).json({
          statusCode: 200,
          message: "Mensaje enviado",
        });
      } else {
        throw new Error("Error trying to send message");
      }
    } catch (error) {
      console.log(`[ERROR]: ${error}`);
      res.status(400).json({
        statusCode: 400,
        message: error.message,
      });
    }
  } else {
    console.log(`[ERROR]: Can't send message without connection`);
    res.status(404).json({
      statusCode: 404,
      message: "Can't send message without connection",
    });
  }
});

client.initialize();

httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
