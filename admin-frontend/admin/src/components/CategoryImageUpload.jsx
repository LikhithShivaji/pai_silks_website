import React, { useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { ADMIN_API, apiFetch } from "@/config/api";

/**
 * Set the image shown on the homepage tile for this category. CF-35.
 *
 * Deliberately small — a thumbnail button beside "← Back" and "+ Add", not a
 * drop zone. It is used rarely (once per category, then almost never), so it
 * should occupy the space of a button rather than a panel.
 *
 * Clicking opens the native file picker. There is no preview step: Cloudinary
 * re-encodes whatever is uploaded to WebP, so the URL that comes back IS the
 * stored image, and showing it as the thumbnail is both the confirmation and
 * the result.
 */
export default function CategoryImageUpload({ categoryId, categoryName, imageUrl, onUploaded }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(imageUrl || null);

  const pick = () => inputRef.current?.click();

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    // Reset immediately so choosing the SAME file again still fires onChange —
    // the input keeps its value otherwise and a retry after a failure would do
    // nothing, looking like the button had broken.
    e.target.value = "";
    if (!file) return;

    // Matches the server's multer limit. Checked here too so a large file is
    // refused before it is uploaded rather than after.
    if (file.size > 5 * 1024 * 1024) {
      alert("That image is larger than 5MB. Please choose a smaller one.");
      return;
    }

    setBusy(true);
    try {
      const body = new FormData();
      body.append("image", file);

      const res = await apiFetch(`${ADMIN_API}/api/categories/${categoryId}/image`, {
        method: "PUT",
        // No Content-Type header: the browser must set the multipart boundary
        // itself, and setting it by hand produces a body multer cannot parse.
        body,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        alert(data.message || "Could not update the category image.");
        return;
      }

      setPreview(data.image_url);
      onUploaded?.(categoryId, data.image_url);
    } catch (err) {
      console.error("Category image upload failed:", err);
      alert("Could not reach the server. The image was not changed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        onChange={onFile}
        className="hidden"
      />
      <button
        type="button"
        onClick={pick}
        disabled={busy}
        // Square, ~40px, sitting in the button row. Shows the current image so
        // the admin can see at a glance which categories still need one.
        // `cursor-pointer` and a hover response: the thumbnail is a button but
        // read as a static preview, because a <button> with a custom class set
        // gets neither the hand cursor nor any visible reaction by default.
        // `group` so the image inside can scale with the hover.
        className="group relative w-10 h-10 shrink-0 rounded border border-[#68232B]/30 overflow-hidden bg-white flex items-center justify-center cursor-pointer transition-all duration-200 hover:border-[#68232B] hover:shadow-md hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
        title={
          preview
            ? `Change the homepage image for "${categoryName}" (square, about 600x600)`
            : `Add a homepage image for "${categoryName}" (square, about 600x600)`
        }
      >
        {busy ? (
          <Loader2 size={16} className="animate-spin text-[#68232B]" />
        ) : preview ? (
          <img
            src={preview}
            alt=""
            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-110"
          />
        ) : (
          <ImagePlus size={16} className="text-[#68232B]/60" />
        )}
      </button>
    </>
  );
}
