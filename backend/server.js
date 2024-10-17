const express = require("express");
const connectDB = require("./config/db");
const dotenv = require("dotenv");
const userRoutes = require("./routes/userRoutes");
const chatRoutes = require("./routes/chatRoutes");
const messageRoutes = require("./routes/messageRoutes");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");
const path = require("path");

dotenv.config();
connectDB();
const app = express();

app.use(express.json()); // to accept JSON data

// API Routes
app.use("/api/user", userRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/message", messageRoutes);

// --------------------------deployment------------------------------
const __dirname1 = path.resolve();

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname1, "/frontend/build")));

  app.get("*", (req, res) =>
    res.sendFile(path.resolve(__dirname1, "frontend", "build", "index.html"))
  );
} else {
  app.get("/", (req, res) => {
    res.send("API is running..");
  });
}
// --------------------------deployment------------------------------

// Error Handling middlewares
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const server = app.listen(
  PORT,
  console.log(`Server running on PORT ${PORT}...`.yellow.bold)
);

const io = require("socket.io")(server, {
  pingTimeout: 60000,
  cors: {
    origin: "http://localhost:3000",
    // credentials: true,
  },
});

// -------------------------- WebSockets ------------------------------

io.on("connection", (socket) => {
  console.log("Connected to socket.io");

  // Store user ID for later use in call handling
  socket.on("setup", (userData) => {
    socket.userId = userData._id; // Store userId on the socket object
    socket.join(userData._id);
    console.log(`User ${userData._id} has connected and joined their room`);
    socket.emit("connected");
  });

  // Chat functionality
  socket.on("join chat", (room) => {
    socket.join(room);
    console.log("User joined room: " + room);
  });

  socket.on("typing", (room) => socket.in(room).emit("typing"));
  socket.on("stop typing", (room) => socket.in(room).emit("stop typing"));

  socket.on("new message", (newMessageRecieved) => {
    var chat = newMessageRecieved.chat;

    if (!chat.users) {
      console.log("chat.users not defined");
      return;
    }

    chat.users.forEach((user) => {
      if (user._id == newMessageRecieved.sender._id) return;
      console.log(`Emitting message to user ${user._id}`);
      socket.in(user._id).emit("message received", newMessageRecieved);
    });
  });

  // -------------------------- Video/Audio Call Functionality ------------------------------

  socket.on("call-initiated", (callData) => {
    // Find the receiver socket ID and emit the call data
    const receiverSocketId = Object.keys(io.sockets.sockets).find(
      (socketId) => io.sockets.sockets[socketId].userId === callData.receiverId
    );

    if (receiverSocketId) {
      io.to(receiverSocketId).emit("call-initiated", callData);
    } else {
      console.log(`User ${callData.receiverId} not found or not connected`);
    }
  });

  socket.on("call-answered", (callData) => {
    // Find the caller socket ID and emit the call data
    const callerSocketId = Object.keys(io.sockets.sockets).find(
      (socketId) => io.sockets.sockets[socketId].userId === callData.callerId
    );

    if (callerSocketId) {
      io.to(callerSocketId).emit("call-answered", callData);
    } else {
      console.log(`User ${callData.callerId} not found or not connected`);
    }
  });

  socket.on("call-rejected", (callData) => {
    // Find the caller socket ID and emit the call data
    const callerSocketId = Object.keys(io.sockets.sockets).find(
      (socketId) => io.sockets.sockets[socketId].userId === callData.callerId
    );

    if (callerSocketId) {
      io.to(callerSocketId).emit("call-rejected", callData);
    } else {
      console.log(`User ${callData.callerId} not found or not connected`);
    }
  });

  socket.on("ice-candidate", (candidate, userId, roomId) => {
    // Find the target user's socket ID and emit the ICE candidate
    const targetSocketId = Object.keys(io.sockets.sockets).find(
      (socketId) => io.sockets.sockets[socketId].userId === userId
    );

    if (targetSocketId) {
      io.to(targetSocketId).emit("ice-candidate", candidate, roomId);
    } else {
      console.log(`User ${userId} not found or not connected`);
    }
  });

  // Handle user leaving the call
  socket.on("leave-call", (roomId) => {
    socket.leave(roomId);
    socket.broadcast.to(roomId).emit("user-left-call", socket.id);
  });

  // -------------------------- Disconnect Handling ------------------------------
  socket.on("disconnect", () => {
    console.log("USER DISCONNECTED");
  });
});