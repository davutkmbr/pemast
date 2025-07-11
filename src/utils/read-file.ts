import fs from 'fs';
import path from 'path';

type ReadFile = (filePath: string, encoding?: BufferEncoding) => Promise<string>;

export const readFile: ReadFile = (filePath: string, encoding: BufferEncoding = 'utf8') => {
    const rootPath = path.join(__dirname, '..', '..');
    const fullPath = path.join(rootPath, filePath);
    
    return new Promise((resolve, reject) => {
        fs.readFile(fullPath, encoding, (err, data) => {
            if (err) reject(err);
            resolve(data);
        });
    });
};