const uploadSection = document.querySelector("#upload-section");
const uploadForm = document.querySelector("#upload-form");
const fileInput = document.querySelector("#csv-file");
const fileLabel = document.querySelector("#file-label");
const shareBlock = document.querySelector("#share-result");
const shareInput = document.querySelector("#share-url");
const copyBtn = document.querySelector("#copy-btn");

const boardSection = document.querySelector("#board-section");
const boardGrid = document.querySelector("#board-grid");
const boardTitle = document.querySelector("#board-title");
const boardStatus = document.querySelector("#board-status");
const cellCount = document.querySelector("#cell-count");
const resetBtn = document.querySelector("#reset-btn");
const shareBtn = document.querySelector("#share-btn");
const boardShare = document.querySelector("#board-share");
const boardShareInput = document.querySelector("#board-share-url");
const boardCopyBtn = document.querySelector("#board-copy-btn");

const pathMatch = window.location.pathname.match(/^\/game\/([A-Za-z0-9_-]+)/);
const viewingBoardId = pathMatch ? pathMatch[1] : null;

const marksKey = (id) => `mobingo:marks:${id}`;
const boardDataKey = (id) => `mobingo:board:${id}`;

if (viewingBoardId) {
  document.body.classList.add("is-game");
  uploadSection.classList.add("hidden");
  boardSection.classList.remove("hidden");
  loadBoard(viewingBoardId);
} else {
  boardSection.classList.add("hidden");
}

uploadForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(uploadForm);
  if (!formData.get("csv") || formData.get("csv").size === 0) {
    boardStatus.textContent = "Please pick a CSV first.";
    return;
  }

  try {
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    if (!res.ok) {
      const message = await res.text();
      throw new Error(message || "Upload failed");
    }
    const data = await res.json();
    const shareUrl = data.url;
    shareInput.value = shareUrl;
    shareBlock.classList.remove("hidden");
    boardSection.classList.remove("hidden");
    boardStatus.textContent = "Upload succeeded. Preview the board via the link.";
  } catch (err) {
    boardStatus.textContent = err.message;
  }
});

fileInput?.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  fileLabel.textContent = file ? file.name : "Choose a CSV file";
});

const dropZone = document.querySelector(".file");
["dragenter", "dragover"].forEach((eventName) => {
  dropZone?.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add("drag");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  dropZone?.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove("drag");
  });
});

dropZone?.addEventListener("drop", (event) => {
  const file = event.dataTransfer?.files?.[0];
  if (!file) return;
  const dt = new DataTransfer();
  dt.items.add(file);
  fileInput.files = dt.files;
  fileLabel.textContent = file.name;
});

copyBtn?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(shareInput.value);
    copyBtn.textContent = "Copied";
    setTimeout(() => (copyBtn.textContent = "Copy"), 1400);
  } catch {
    copyBtn.textContent = "Copy failed";
    setTimeout(() => (copyBtn.textContent = "Copy"), 1400);
  }
});

shareBtn?.addEventListener("click", () => {
  if (!viewingBoardId) return;
  const url = `${window.location.origin}/game/${viewingBoardId}`;
  boardShareInput.value = url;
  boardShare.classList.remove("hidden");
  boardStatus.textContent = "Share link ready below.";
});

boardCopyBtn?.addEventListener("click", async () => {
  if (!viewingBoardId) return;
  const url = `${window.location.origin}/game/${viewingBoardId}`;
  try {
    await navigator.clipboard.writeText(url);
    boardCopyBtn.textContent = "Copied";
    setTimeout(() => (boardCopyBtn.textContent = "Copy"), 1400);
    boardStatus.textContent = "Link copied to clipboard.";
  } catch {
    boardStatus.textContent = "Copy failed. You can manually select the link.";
  }
});

resetBtn?.addEventListener("click", () => {
  if (!viewingBoardId) return;
  localStorage.removeItem(marksKey(viewingBoardId));
  boardGrid.querySelectorAll(".cell").forEach((cell) => cell.classList.remove("marked"));
});

async function loadBoard(id) {
  boardStatus.textContent = "Loading board...";
  const cached = localStorage.getItem(boardDataKey(id));
  if (cached) {
    try {
      renderBoard(JSON.parse(cached));
      boardStatus.textContent = "Tap tiles to mark them.";
    } catch {
      // ignore parse errors and fall through to fetch
    }
  }

  try {
    const res = await fetch(`/api/board/${id}`);
    if (!res.ok) {
      boardStatus.textContent = "Board not found.";
      return;
    }
    const data = await res.json();
    if (!cached) {
      localStorage.setItem(boardDataKey(id), JSON.stringify(data));
      renderBoard(data);
    }
  } catch (err) {
    boardStatus.textContent = `Error: ${err.message}`;
  }
}

function renderBoard(board) {
  boardTitle.textContent = board.title || "Bingo Board";
  const freeIndex = typeof board.freeIndex === "number" ? board.freeIndex : 12;
  const rawCells = Array.isArray(board.cells) ? board.cells : Array.isArray(board.rows) ? board.rows.flat() : [];
  const cells = ensureFiveByFive(rawCells, freeIndex);
  cellCount.textContent = "";
  boardGrid.innerHTML = "";
  const savedMarks = new Set(JSON.parse(localStorage.getItem(marksKey(board.id)) || "[]"));
  boardGrid.style.gridTemplateColumns = "repeat(5, 1fr)";

  cells.forEach((text, index) => {
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.innerHTML = sanitize(text);
    if (index === freeIndex) {
      cell.classList.add("free");
    }
    if (savedMarks.has(index)) {
      cell.classList.add("marked");
    }
    cell.addEventListener("click", () => {
      const marks = new Set(JSON.parse(localStorage.getItem(marksKey(board.id)) || "[]"));
      if (cell.classList.contains("marked")) {
        cell.classList.remove("marked");
        marks.delete(index);
      } else {
        cell.classList.add("marked");
        marks.add(index);
      }
      localStorage.setItem(marksKey(board.id), JSON.stringify([...marks]));
    });
    boardGrid.appendChild(cell);
  });

  boardStatus.textContent = "Tap tiles to mark them.";
}

function sanitize(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML || " ";
}

function ensureFiveByFive(list, freeIndex) {
  const cells = list.slice(0, 25);
  while (cells.length < 25) {
    cells.push("");
  }
  const idx = freeIndex >= 0 && freeIndex < 25 ? freeIndex : 12;
  cells[idx] = "FREE";
  return cells.slice(0, 25);
}
