import fs from "node:fs";
import path from "node:path";
import { https } from "follow-redirects";

const MODEL_URL =
  "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin";
const TARGET_DIR = path.join(__dirname, "../src-tauri/models");
const TARGET_FILE = path.join(TARGET_DIR, "ggml-small.bin");

if (!fs.existsSync(TARGET_DIR)) {
  fs.mkdirSync(TARGET_DIR, { recursive: true });
}

if (fs.existsSync(TARGET_FILE)) {
  console.log("Model already exists, skipping download.");
  process.exit(0);
}

console.log(`Downloading model from ${MODEL_URL}...`);
const file = fs.createWriteStream(TARGET_FILE);

https
  .get(MODEL_URL, (response) => {
    if (response.statusCode !== 200) {
      console.error(`Failed to download model: ${response.statusCode}`);
      process.exit(1);
    }

    const totalSize = parseInt(response.headers["content-length"], 10);
    let downloaded = 0;

    response.pipe(file);

    response.on("data", (chunk) => {
      downloaded += chunk.length;
      const percentage = ((downloaded / totalSize) * 100).toFixed(2);
      process.stdout.write(`\rDownloading: ${percentage}%`);
    });

    file.on("finish", () => {
      file.close(() => {
        console.log("\nModel downloaded successfully.");
      });
    });
  })
  .on("error", (err) => {
    fs.unlink(TARGET_FILE, () => {}); // Delete partial file
    console.error(`Error downloading model: ${err.message}`);
    process.exit(1);
  });
