import cors from "cors";
import express from "express";
import { Server } from "socket.io";
import { client } from "./whatsapp.js";
import { createServer } from "http";

const PORT = 5000;
let isConnected = false;

const app = express();

app.use(express.json());
app.use(
  cors({
    origin: "http://localhost:5173",
  }),
);

client.initialize();

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
  },
});

io.on("connection", (socket) => {
  console.log("Socket: User connected", socket.id);

  socket.on("disconnect", (reason) => {
    console.log("Socket: user disconnected", reason);
  });

  if (isConnected) {
    socket.emit("status", {
      message: "WhatsApp: user connected",
      connected: true,
    });
  } else {
    socket.emit("status", {
      message: "WhatsApp: user disconnected",
      connected: false,
    });
  }
});

client.on("qr", async (qr) => {
  if (!isConnected) {
    let qrc = await new Promise((resolve, reject) => {
      client.once("qr", (qrc) => resolve(qrc));
      setTimeout(() => {
        reject(new Error("QR event wasn't emitted in 40 seconds."));
      }, 40000);
    });
    io.emit("qr", qrc);
  }
});

client.on("ready", () => {
  isConnected = true;
  io.emit("status", {
    message: "WhatsApp: user connected",
    connected: true,
  });
});

client.on("disconnected", () => {
  isConnected = false;
  io.emit("status", {
    message: "WhatsApp: user disconnected, need to reconnect",
    connected: false,
  });
});

app.post("/sendMessage", async (req, res) => {
  if (isConnected) {
    try {
      const { phone, message } = req.body;
      const phoneId = phone + "@c.us";
      const number_details = await client.getNumberId(phoneId);

      if (number_details) {
        await client.sendMessage(chatId, message);
        res.json({
          statusCode: 200,
          message: "Mensaje enviado",
        });
      } else {
        res.json({
          statusCode: 404,
          message: "Error sending message",
        });
      }
    } catch (error) {
      res.json({
        statusCode: 404,
        message: "Error trying to send message",
      });
    }
  } else {
    res.json({
      statusCode: 404,
      message: "Error trying to send message, need to reconnect to WhatsApp",
    });
  }
});

httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
