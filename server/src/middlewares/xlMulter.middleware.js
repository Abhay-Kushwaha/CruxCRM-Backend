import multer from "multer";
import path from "path";
import fs from "fs";

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = "./public/temp";
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

export const xlUpload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = [".xlsx", ".xls"];

    if (!allowedExtensions.includes(ext)) {
      req.fileValidationError =
        "Invalid file format. Only .xlsx and .xls files are allowed.";
      return cb(null, false); // reject the file but don’t throw
    }

    cb(null, true);
  },
});
