const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { nanoid } = require("nanoid");

const app = express();
const port = process.env.PORT || 3000;
const dataDir = path.join(__dirname, "data");
const publicDir = path.join(__dirname, "public");

const MAX_FILE_SIZE = 200 * 1024; // 200KB
const MAX_CELLS = 500; // reasonable upper bound for a bingo list
const MAX_CELL_LENGTH = 160; // prevent runaway long strings

fs.mkdirSync(dataDir, { recursive: true });

const storage = multer.diskStorage({
  destination: dataDir,
  filename: (_req, file, cb) => {
    const id = nanoid(10);
    cb(null, `${id}.csv`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== "text/csv" && path.extname(file.originalname) !== ".csv") {
      return cb(new Error("Please upload a CSV file."));
    }
    cb(null, true);
  },
});

app.use(express.static(publicDir));

app.post("/api/upload", upload.single("csv"), (req, res) => {
  const removeUploaded = () => {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
  };

  if (!req.file) {
    return res.status(400).json({ error: "CSV file required." });
  }

  try {
    const id = path.parse(req.file.filename).name;
    const title = (req.body.title || "").trim() || "Untitled Board";
    const content = fs.readFileSync(req.file.path, "utf-8");
    const tokens = parseCsvTokens(content);

    if (tokens.length === 0) {
      removeUploaded();
      return res.status(400).json({ error: "CSV is empty." });
    }

    if (tokens.length > MAX_CELLS) {
      removeUploaded();
      return res.status(400).json({ error: `Too many entries (max ${MAX_CELLS}).` });
    }

    const meta = {
      id,
      title,
      originalName: req.file.originalname,
      uploadedAt: Date.now(),
    };

    fs.writeFileSync(path.join(dataDir, `${id}.json`), JSON.stringify(meta, null, 2));
    const url = `${req.protocol}://${req.get("host")}/game/${id}`;
    res.json({ id, url });
  } catch (err) {
    removeUploaded();
    res.status(400).json({ error: err.message || "Invalid CSV." });
  }
});

app.get("/api/board/:id", (req, res) => {
  const { id } = req.params;
  const csvPath = path.join(dataDir, `${id}.csv`);
  if (!fs.existsSync(csvPath)) {
    return res.status(404).json({ error: "Board not found." });
  }

  const metaPath = path.join(dataDir, `${id}.json`);
  const meta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, "utf-8")) : { id, title: "Bingo Board" };

  const content = fs.readFileSync(csvPath, "utf-8");
  let tokens;
  try {
    tokens = parseCsvTokens(content);
  } catch (err) {
    return res.status(400).json({ error: err.message || "Invalid CSV." });
  }

  if (tokens.length === 0) {
    return res.status(400).json({ error: "CSV is empty." });
  }

  const cells = buildBoardCells(tokens);
  res.json({ id, title: meta.title, cells, freeIndex: 12 });
});

function buildBoardCells(list) {
  const cleaned = [...list];
  // Shuffle
  for (let i = cleaned.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [cleaned[i], cleaned[j]] = [cleaned[j], cleaned[i]];
  }

  const needed = 24; // free space takes the center slot
  const picked = [];
  while (picked.length < needed) {
    const next = cleaned[picked.length % cleaned.length];
    picked.push(next);
  }

  const cells = [...picked.slice(0, 12), "FREE", ...picked.slice(12)];
  while (cells.length < 25) {
    cells.push("FREE");
  }
  return cells.slice(0, 25);
}

function parseCsvTokens(content) {
  const tooBig = Buffer.byteLength(content, "utf-8") > MAX_FILE_SIZE;
  if (tooBig) {
    throw new Error(`File exceeds ${MAX_FILE_SIZE / 1024}KB limit.`);
  }

  const tokens = content
    .split(/[\r\n,]+/)
    .map((cell) => cell.trim())
    .filter(Boolean)
    .map((cell) => (cell.length > MAX_CELL_LENGTH ? cell.slice(0, MAX_CELL_LENGTH) : cell));

  if (tokens.length > MAX_CELLS) {
    throw new Error(`Too many entries (max ${MAX_CELLS}).`);
  }

  return tokens;
}

app.get("/game/:id", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.get("*", (_req, res) => {
  res.redirect("/");
});

app.listen(port, () => {
  console.log(`MoBingo running on http://localhost:${port}`);
});
