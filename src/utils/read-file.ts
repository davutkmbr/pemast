import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

type ReadFile = (filePath: string, encoding?: BufferEncoding) => Promise<string>;

export const readFile: ReadFile = (filePath: string, encoding: BufferEncoding = "utf8") => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const rootPath = path.join(__dirname, "..", "..");
  const fullPath = path.join(rootPath, filePath);

  return new Promise((resolve, reject) => {
    fs.readFile(fullPath, encoding, (err, data) => {
      if (err) reject(err);
      resolve(data);
    });
  });
};
