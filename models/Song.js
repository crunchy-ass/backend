const mongoose = require("mongoose");

const SongSchema = new mongoose.Schema({
  title: String,
  artist: String,
  filename: String,
  gridFsId: mongoose.Schema.Types.ObjectId,
  mimeType: String,
  createdAt: { type: Date, default: Date.now },
});

SongSchema.index({ title: "text", artist: "text", filename: "text" });

module.exports = mongoose.model("Song", SongSchema);
