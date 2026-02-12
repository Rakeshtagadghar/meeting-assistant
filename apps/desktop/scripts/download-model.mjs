import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { finished } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

try {
  const response = await fetch(MODEL_URL);
  if (!response.ok) {
    throw new Error(
      `Failed to download model: ${response.status} ${response.statusText}`,
    );
  }

  const fileStream = fs.createWriteStream(TARGET_FILE);
  await finished(Readable.fromWeb(response.body).pipe(fileStream));
  console.log("Model downloaded successfully.");
} catch (error) {
  console.error("Error downloading model:", error);
  if (fs.existsSync(TARGET_FILE)) {
    fs.unlinkSync(TARGET_FILE); // Clean up partial file
  }
  process.exit(1);
}
