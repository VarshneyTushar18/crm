const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { slugify } = require("transliteration");
const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const { GridFSBucket, ObjectId } = require("mongodb");

const GRIDFS_BUCKET = "crmUploads";

const isServerless = () =>
  process.env.VERCEL === "1" || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);

const isObjectStorageConfigured = () =>
  Boolean(
    process.env.DO_SPACES_KEY &&
      process.env.DO_SPACES_SECRET &&
      process.env.DO_SPACES_URL &&
      process.env.DO_SPACES_NAME
  );

const buildFilename = (originalname = "file") => {
  const ext = path.extname(originalname);
  const base = path.parse(originalname).name || "file";
  const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  return `${slugify(base)}-${uniqueSuffix}${ext}`;
};

const signFileId = (fileId) => {
  const secret = process.env.JWT_SECRET || process.env.DATABASE || "crm-file-access";
  return crypto.createHmac("sha256", secret).update(String(fileId)).digest("hex").slice(0, 32);
};

const verifyFileSig = (fileId, sig) => {
  if (!fileId || !sig) return false;
  const expected = signFileId(fileId);
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(sig, "utf8"));
  } catch {
    return false;
  }
};

const buildSignedFileUrl = (fileId) => {
  const id = String(fileId);
  return `/api/files/${id}?sig=${signFileId(id)}`;
};

const uploadToObjectStorage = async (file, folder, filename) => {
  const client = new S3Client({
    endpoint: `https://${process.env.DO_SPACES_URL}`,
    region: process.env.REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.DO_SPACES_KEY,
      secretAccessKey: process.env.DO_SPACES_SECRET,
    },
  });

  const key = `public/uploads/${folder}/${filename}`;
  await client.send(
    new PutObjectCommand({
      Bucket: process.env.DO_SPACES_NAME,
      Key: key,
      Body: file.buffer,
      ACL: "public-read",
      ContentType: file.mimetype || "application/octet-stream",
    })
  );

  if (process.env.DO_SPACES_CDN_URL) {
    return `${process.env.DO_SPACES_CDN_URL.replace(/\/$/, "")}/${key}`;
  }

  return `https://${process.env.DO_SPACES_NAME}.${process.env.DO_SPACES_URL}/${key}`;
};

const uploadToGridFS = async (file, folder, filename) => {
  if (mongoose.connection.readyState !== 1) {
    throw new Error("Database not connected — cannot store uploaded file");
  }

  const bucket = new GridFSBucket(mongoose.connection.db, { bucketName: GRIDFS_BUCKET });
  const storageName = `${folder}/${filename}`;

  const fileId = await new Promise((resolve, reject) => {
    const stream = bucket.openUploadStream(storageName, {
      contentType: file.mimetype || "application/octet-stream",
      metadata: {
        folder,
        originalName: file.originalname || filename,
      },
    });
    stream.on("error", reject);
    stream.on("finish", () => resolve(stream.id));
    stream.end(file.buffer);
  });

  return buildSignedFileUrl(fileId);
};

const uploadToLocalDisk = async (file, folder, filename) => {
  const uploadDir = path.join(__dirname, "../../uploads", folder);
  await fs.promises.mkdir(uploadDir, { recursive: true });
  await fs.promises.writeFile(path.join(uploadDir, filename), file.buffer);
  return `/uploads/${folder}/${filename}`;
};

const persistFile = async (file, folder = "misc") => {
  if (!file?.buffer) {
    throw new Error("Uploaded file data missing");
  }

  const filename = buildFilename(file.originalname);
  let url;

  if (isObjectStorageConfigured()) {
    url = await uploadToObjectStorage(file, folder, filename);
  } else if (isServerless()) {
    url = await uploadToGridFS(file, folder, filename);
  } else {
    url = await uploadToLocalDisk(file, folder, filename);
  }

  return {
    url,
    filename,
    originalName: file.originalname || filename,
  };
};

/** Persist a data-URL selfie (camera capture) to local disk / GridFS / object storage. */
const persistDataUrl = async (dataUrl, folder = "attendance", filenameHint = "selfie.jpg") => {
  const raw = String(dataUrl || "");
  const match = raw.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Invalid selfie image data");
  }
  const mime = match[1];
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length) {
    throw new Error("Empty selfie image");
  }
  if (buffer.length > 8 * 1024 * 1024) {
    throw new Error("Selfie image too large (max 8 MB)");
  }
  const ext =
    mime.includes("png") ? ".png" : mime.includes("webp") ? ".webp" : ".jpg";
  const safeName = String(filenameHint || "selfie").replace(/\.[a-z]+$/i, "") + ext;

  return persistFile(
    {
      buffer,
      originalname: safeName,
      mimetype: mime,
    },
    folder
  );
};

const persistFiles = async (files, folder) => {
  const list = Array.isArray(files) ? files : [];
  return Promise.all(list.map((file) => persistFile(file, folder)));
};

/** Best-effort delete for a previously persisted URL (local disk / GridFS / Spaces). */
const deletePersistedUrl = async (fileUrl) => {
  const url = String(fileUrl || "").trim();
  if (!url) return { deleted: false, reason: "empty" };

  // GridFS signed URL: /api/files/:id?sig=...
  const gridMatch = url.match(/\/api\/files\/([a-fA-F0-9]{24})(?:\?|$)/);
  if (gridMatch) {
    if (mongoose.connection.readyState !== 1) {
      return { deleted: false, reason: "db_not_ready" };
    }
    const bucket = new GridFSBucket(mongoose.connection.db, { bucketName: GRIDFS_BUCKET });
    const _id = new ObjectId(gridMatch[1]);
    try {
      await bucket.delete(_id);
      return { deleted: true, storage: "gridfs" };
    } catch (err) {
      if (String(err?.message || "").includes("FileNotFound")) {
        return { deleted: false, reason: "not_found" };
      }
      throw err;
    }
  }

  // Local disk: /uploads/folder/filename
  const localMatch = url.match(/^\/uploads\/([^/?#]+)\/([^/?#]+)$/);
  if (localMatch) {
    const filePath = path.join(__dirname, "../../uploads", localMatch[1], localMatch[2]);
    try {
      await fs.promises.unlink(filePath);
      return { deleted: true, storage: "local" };
    } catch (err) {
      if (err?.code === "ENOENT") return { deleted: false, reason: "not_found" };
      throw err;
    }
  }

  // DigitalOcean Spaces / S3 public URL
  if (isObjectStorageConfigured()) {
    try {
      const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
      const key = parsed.pathname.replace(/^\//, "");
      if (key.startsWith("public/uploads/")) {
        const client = new S3Client({
          endpoint: `https://${process.env.DO_SPACES_URL}`,
          region: process.env.REGION || "us-east-1",
          credentials: {
            accessKeyId: process.env.DO_SPACES_KEY,
            secretAccessKey: process.env.DO_SPACES_SECRET,
          },
        });
        await client.send(
          new DeleteObjectCommand({
            Bucket: process.env.DO_SPACES_NAME,
            Key: key,
          })
        );
        return { deleted: true, storage: "spaces" };
      }
    } catch {
      return { deleted: false, reason: "spaces_error" };
    }
  }

  return { deleted: false, reason: "unsupported_url" };
};

const openGridFsDownload = async (fileId, res) => {
  if (!ObjectId.isValid(fileId)) {
    return res.status(400).json({ success: false, message: "Invalid file id" });
  }

  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ success: false, message: "Database not ready" });
  }

  const bucket = new GridFSBucket(mongoose.connection.db, { bucketName: GRIDFS_BUCKET });
  const _id = new ObjectId(fileId);
  const files = await bucket.find({ _id }).toArray();

  if (!files.length) {
    return res.status(404).json({ success: false, message: "File not found" });
  }

  const meta = files[0];
  res.set("Content-Type", meta.contentType || "application/octet-stream");
  if (meta.metadata?.originalName) {
    res.set(
      "Content-Disposition",
      `inline; filename="${String(meta.metadata.originalName).replace(/"/g, "")}"`
    );
  }

  bucket.openDownloadStream(_id).pipe(res);
};

module.exports = {
  persistFile,
  persistFiles,
  persistDataUrl,
  deletePersistedUrl,
  isServerless,
  isObjectStorageConfigured,
  verifyFileSig,
  openGridFsDownload,
};
