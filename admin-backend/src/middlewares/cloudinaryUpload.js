const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");
const crypto = require("crypto");
const path = require("path");

// The SHARED config module — not a second cloudinary.config() call.
//
// This file used to require("cloudinary").v2 and configure it independently of
// config/cloudinary.js. Two configurations of the same singleton meant changing
// credentials in one place silently left the other on the old values, and
// neither file was obviously the authority. See CLAUDE.md AB-27.
const cloudinary = require("../config/cloudinary");

/**
 * Extensions we accept. Checked alongside the declared mimetype.
 *
 * `file.mimetype` is the Content-Type the CLIENT sent in the multipart body —
 * it is a claim, not a fact, so any file can announce itself as image/jpeg.
 * That is CLAUDE.md AB-21.
 *
 * The real boundary is Cloudinary itself: `resource_type: "image"` makes it
 * reject anything it cannot decode as an image, and `format: "webp"` means it
 * re-encodes what it accepts, so the bytes that end up stored are Cloudinary's
 * output rather than whatever was uploaded. A disguised file gets refused
 * there.
 *
 * These checks are therefore a cheap early filter, not the security boundary.
 * Magic-byte inspection (the `file-type` package) would be stricter, but multer
 * exposes only a stream at this point and, since AB-09/AB-01, this route is
 * reachable only by an authenticated admin — so the extra dependency and
 * stream-buffering are not warranted. Recorded as optional hardening.
 */
const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);
const ALLOWED_MIMETYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: "products",
    resource_type: "image",
    format: "webp",

    /**
     * public_id is generated SERVER-SIDE. The client's filename is ignored.
     *
     * It used to be `${Date.now()}-${file.originalname}`. `originalname` comes
     * straight from the multipart `filename` parameter and can contain `/` and
     * `..`. Cloudinary treats `/` as a folder separator and signed uploads
     * default to overwrite, so a crafted filename could write OUTSIDE
     * `products/` and overwrite an existing asset — including one belonging to
     * a different product. See CLAUDE.md AB-20.
     *
     * A random 16-byte id removes the class of problem rather than trying to
     * sanitise a hostile string: there is nothing left of the client's input to
     * escape. It also fixes a smaller bug — two files uploaded in the same
     * millisecond with the same name previously collided and overwrote each
     * other.
     */
    public_id: crypto.randomBytes(16).toString("hex"),
  }),
});

const upload = multer({
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file
    files: 10,                 // matches upload.array('images', 10)
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();

    if (!ALLOWED_MIMETYPES.has(file.mimetype)) {
      return cb(new Error("Only JPEG, PNG, WebP or AVIF images are allowed."));
    }
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return cb(new Error("Unsupported image file extension."));
    }
    cb(null, true);
  },
  storage,
});

module.exports = upload;
