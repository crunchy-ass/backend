require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const { GridFSBucket } = require("mongodb");
const Song = require("./models/Song");

const app = express();
app.use(cors({ origin: "*" }));

app.use(express.json());

// Env
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

// Connect Mongo
mongoose.connect(MONGO_URI);
const conn = mongoose.connection;

let gfsBucket;

conn.once("open", () => {
  gfsBucket = new GridFSBucket(conn.db, { bucketName: "fs" });
  console.log("MongoDB connected, GridFS ready.");
});

app.get("/api/ping", (req, res) => res.json({ ok: true }));

// ------------------ FILE UPLOAD (NO multer-gridfs-storage) ------------------

const upload = multer({ storage: multer.memoryStorage() });

app.post("/api/songs/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const title = req.body.title || req.file.originalname;
    const artist = req.body.artist || "Unknown";

    const uploadStream = gfsBucket.openUploadStream(req.file.originalname, {
      contentType: req.file.mimetype,
      metadata: { title, artist },
    });

    uploadStream.end(req.file.buffer);

    uploadStream.on("finish", async (file) => {
      const song = await Song.create({
        title,
        artist,
        filename: file.filename,
        gridFsId: file._id,
        mimeType: req.file.mimetype,
      });

      res.json({ success: true, song });
    });

    uploadStream.on("error", (err) => {
      res.status(500).json({ error: err.message });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------ LIST SONGS ------------------

app.get("/api/songs", async (req, res) => {
  try {
    const q = (req.query.search || "").trim();
    let filter = q ? { $text: { $search: q } } : {};
    const songs = await Song.find(filter).sort({ createdAt: -1 });
    res.json({ songs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------ STREAM SONG ------------------

app.get("/api/songs/:id/stream", async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);
    if (!song) return res.status(404).send("Song not found");

    res.set("Content-Type", song.mimeType);

    const stream = gfsBucket.openDownloadStream(song.gridFsId);

    stream.on("error", () => res.status(404).send("File not found"));
    stream.pipe(res);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// ------------------ START SERVER ------------------

app.listen(PORT, () => console.log(`Server listening on ${PORT}`));

