import fs from 'fs';
import path from 'path';

console.log("CWD:", process.cwd());
console.log("Files in CWD:", fs.readdirSync('.'));
if (fs.existsSync('src')) {
  console.log("src folder exists!");
  console.log("Files in src:", fs.readdirSync('src'));
} else {
  console.log("src folder does NOT exist in CWD.");
}
