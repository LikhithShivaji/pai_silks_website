import React, { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import ImageUpload from "./ImageUpload";
import ImageIcon from "@/assets/svg/ImageIcon.svg?react";

const UpdateProduct = ({ setCategoryProducts, categoryName, onBack, updateProductDetails }) => {
  const [productImages, setProductImages] = useState([]);
  const [loading, setLoading] = useState(false);

  // controlled form state (strings)
  const [newProduct, setNewProduct] = useState({
    name: "",
    category: "",
    description: "",
    material: "",
    code: "",
    length: "",
    washCare: "",
    collection: "",
    stockQty: "",
    regularPrice: "",
    discountedPrice: "",
  });

  // initialize form when product prop arrives / changes
  useEffect(() => {
    if (!updateProductDetails) {
      // reset to defaults for safety
      setNewProduct({
        name: "",
        category: "",
        description: "",
        material: "",
        code: "",
        length: "",
        washCare: "",
        collection: "",
        stockQty: "",
        regularPrice: "",
        discountedPrice: "",
      });
      setProductImages([]);
      return;
    }

    // map possible keys from server to form fields, always as strings
    setNewProduct({
      name: updateProductDetails.product ?? updateProductDetails.name ?? "",
      category: updateProductDetails.category ?? "",
      description: updateProductDetails.description ?? "",
      material: updateProductDetails.material ?? "",
      code: updateProductDetails.product_code ?? updateProductDetails.code ?? "",
      length: updateProductDetails.saree_length ?? updateProductDetails.length ?? "",
      washCare: updateProductDetails.product_wash_care ?? updateProductDetails.washCare ?? "",
      collection: updateProductDetails.collection ?? "",
      stockQty:
        updateProductDetails.stock_qty != null
          ? String(updateProductDetails.stock_qty)
          : updateProductDetails.stockQty != null
          ? String(updateProductDetails.stockQty)
          : "",
      regularPrice:
        updateProductDetails.regular_price != null
          ? String(updateProductDetails.regular_price)
          : updateProductDetails.regularPrice != null
          ? String(updateProductDetails.regularPrice)
          : updateProductDetails.price != null
          ? String(updateProductDetails.price)
          : "",
      discountedPrice:
        updateProductDetails.selling_price != null
          ? String(updateProductDetails.selling_price)
          : updateProductDetails.discountedPrice != null
          ? String(updateProductDetails.discountedPrice)
          : updateProductDetails.discount != null
          ? String(updateProductDetails.discount)
          : "",
    });

    // initialize images from multiple possible keys
    if (Array.isArray(updateProductDetails.images) && updateProductDetails.images.length > 0) {
      setProductImages(updateProductDetails.images.slice(0, 4));
    } else if (Array.isArray(updateProductDetails.image_url) && updateProductDetails.image_url.length > 0) {
      setProductImages(updateProductDetails.image_url.slice(0, 4));
    } else {
      setProductImages([]);
    }
  }, [updateProductDetails]);

  // --- image compression helper (kept)
  const compressAndConvert = (file, maxWidth = 1024, quality = 0.75) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const ratio = Math.min(1, maxWidth / img.width);
          const w = Math.round(img.width * ratio);
          const h = Math.round(img.height * ratio);
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, w, h);
          try {
            const dataUrl = canvas.toDataURL("image/jpeg", quality);
            resolve(dataUrl);
          } catch (err) {
            reject(err);
          }
        };
        img.onerror = reject;
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });

  const handleImageUpload = async (previewUrl) => {
    try {
      let finalUrl = previewUrl;
      if (previewUrl instanceof File) {
        finalUrl = await compressAndConvert(previewUrl, 800, 0.75);
      } else if (typeof previewUrl === "string" && previewUrl.startsWith("blob:")) {
        const resp = await fetch(previewUrl);
        const blob = await resp.blob();
        finalUrl = await compressAndConvert(blob, 800, 0.75);
      }
      setProductImages((prev) => {
        const updated = [...prev, finalUrl].slice(0, 4);
        return updated;
      });
    } catch (err) {
      console.error("handleImageUpload error:", err);
      alert("Failed to process image. Try a smaller file.");
    }
  };

  // Save (update) product
  const handleSaveProduct = async () => {
    if (!newProduct.name?.trim()) {
      alert("Please enter the product name");
      return false;
    }

    setLoading(true);
    const nowIso = new Date().toISOString();
    const catKey = newProduct.category?.trim() || categoryName?.trim() || "UNCATEGORIZED";

    // prefer newly uploaded images if any, otherwise keep existing ones
    const imagesToSend = productImages.length > 0 ? productImages : updateProductDetails?.images ?? updateProductDetails?.image_url ?? [];

    // parse stock
    const parsedStock = (() => {
      if (newProduct.stockQty === "" || newProduct.stockQty == null) return 0;
      const n = parseInt(newProduct.stockQty, 10);
      return Number.isFinite(n) ? n : 0;
    })();

    // build payload (adjust keys if your backend expects different names)
    const payload = {
      id: updateProductDetails?.id ?? updateProductDetails?.product_id ?? undefined, // include id if available
      name: newProduct.name,
      description: newProduct.description,
      category: catKey,
      collection: newProduct.collection,
      material: newProduct.material,
      product_code: newProduct.code,
      product_wash_care: newProduct.washCare,
      saree_length: newProduct.length,
      regular_price: Number(newProduct.regularPrice) || 0,
      selling_price: Number(newProduct.discountedPrice) || 0,
      stock_qty: parsedStock,
      image_url: imagesToSend,
      updated_at: nowIso,
    };

    try {
      // If your backend expects /api/products/:id, change the URL accordingly.
      // Example: fetch(`/api/products/${payload.id}`, { method: "PATCH", ... })
      const res = await fetch("https://pai-silks-website.onrender.com/api/update-product", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const text = await res.text().catch(() => "");
      let json = null;
      try { json = text ? JSON.parse(text) : null; } catch (e) { json = null; }

      if (!res.ok) {
        console.error("Update API error:", res.status, text);
        alert(`Server error ${res.status}: ${text || "Something went wrong"}`);
        setLoading(false);
        return false;
      }

      const returned = json ?? null;

      // Update parent UI if setter provided (replace the product)
      if (typeof setCategoryProducts === "function") {
        setCategoryProducts((prev = {}) => {
          const cat = catKey;
          const existing = prev[cat] || [];

          // determine canonical id
          const serverId = returned?.product_id ?? returned?.id ?? payload.id ?? updateProductDetails?.id;

          const updatedProductForUI = {
            ...(returned ?? payload),
            id: serverId ?? Date.now(),
            images: imagesToSend,
            product: newProduct.name,
            regularPrice: Number(newProduct.regularPrice) || 0,
            discountedPrice: Number(newProduct.discountedPrice) || 0,
            category: cat,
          };

          // Replace existing product with same id (search across categories too)
          const newPrev = { ...prev };
          let replaced = false;
          Object.keys(newPrev).forEach((k) => {
            newPrev[k] = newPrev[k].map((p) => {
              if (String(p.id) === String(updateProductDetails?.id) || String(p.id) === String(serverId)) {
                replaced = true;
                return updatedProductForUI;
              }
              return p;
            });
          });

          if (!replaced) {
            // add into current category
            newPrev[cat] = [...(newPrev[cat] || []), updatedProductForUI];
          }

          try {
            localStorage.setItem("categoryProducts", JSON.stringify(newPrev));
          } catch (err) {
            console.warn("Could not persist to localStorage:", err);
          }
          return newPrev;
        });
      }

      alert("Product updated successfully");
      setLoading(false);
      onBack && onBack();
      return true;
    } catch (err) {
      console.error("Network error while updating product:", err);
      alert("Network error while updating product");
      setLoading(false);
      return false;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    await handleSaveProduct();
  };

  return (
    <form onSubmit={handleSubmit} className="w-full p-5 flex flex-col gap-3">
      <div className="flex justify-between w-full">
        <div className="flex flex-col gap-3">
          <p className="text-3xl"> Update Product Details</p>
          <p>Products {" > "} Update Products</p>
        </div>
        <button type="button" onClick={onBack} disabled={loading} className="border-1 cursor-pointer bg-[#68232B] text-white h-fit px-10 py-3 rounded-xl">
          Back
        </button>
      </div>

      <div className="h-full bg-white rounded-2xl flex flex-row gap-10 p-5">
        {/* LEFT */}
        <div className="w-full p-2 flex flex-col gap-5">
          <label className="font-bold">Product Name</label>
          <Input value={newProduct.name ?? ""} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} required />

          <label className="font-bold">Category</label>
          <Input value={newProduct.category ?? ""} onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })} />

          <label className="font-bold">Collection</label>
          <Input value={newProduct.collection ?? ""} onChange={(e) => setNewProduct({ ...newProduct, collection: e.target.value })} />

          <label className="font-bold">Description</label>
          <Textarea value={newProduct.description ?? ""} onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })} className="h-40" />

          <label className="font-bold">Material</label>
          <Input value={newProduct.material ?? ""} onChange={(e) => setNewProduct({ ...newProduct, material: e.target.value })} />

          <label className="font-bold">Product Code</label>
          <Input value={newProduct.code ?? ""} onChange={(e) => setNewProduct({ ...newProduct, code: e.target.value })} />

          <label className="font-bold">Saree Length</label>
          <Input value={newProduct.length ?? ""} onChange={(e) => setNewProduct({ ...newProduct, length: e.target.value })} />

          <label className="font-bold">Wash Care</label>
          <Input value={newProduct.washCare ?? ""} onChange={(e) => setNewProduct({ ...newProduct, washCare: e.target.value })} />

          <label className="font-bold">Stock Quantity</label>
          <Input value={newProduct.stockQty ?? ""} onChange={(e) => setNewProduct({ ...newProduct, stockQty: e.target.value })} />

          <div className="w-full flex gap-5">
            <Input value={newProduct.regularPrice ?? ""} onChange={(e) => setNewProduct({ ...newProduct, regularPrice: e.target.value })} placeholder="Regular Price" />
            <Input value={newProduct.discountedPrice ?? ""} onChange={(e) => setNewProduct({ ...newProduct, discountedPrice: e.target.value })} placeholder="Discounted Price" />
          </div>
        </div>

        {/* RIGHT */}
        <div className="h-full w-full py-3 px-10 flex flex-col gap-5">
          <div className="w-full aspect-square gap-3 mt-3 bg-gray-300 p-5 rounded-xl flex justify-center items-center">
            {productImages.length === 0 ? <div>Add images here</div> : (
              <div className="w-full aspect-square grid grid-cols-2 grid-rows-2 gap-3 bg-gray-300 rounded-xl overflow-hidden">
                {productImages.map((src, idx) => (
                  <div key={idx} className="w-full h-full overflow-hidden rounded-lg border-1">
                    <img src={src} alt={`preview-${idx}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-5">
            <p className="font-semibold">Product Gallery</p>
            <div className="border-2 border-dashed border-gray-400 p-5 w-full rounded-2xl flex flex-col justify-center items-center gap-5">
              <ImageIcon height={50} />
              <div className="flex flex-col justify-center items-center">
                <p className="text-[#7a7a7a]">Drop your image here, or browse</p>
                <p className="text-[#7a7a7a]">Jpeg, png are allowed</p>
              </div>
            </div>

            {[...Array(4)].map((_, i) => (
              <ImageUpload key={i} onImageUpload={handleImageUpload} />
            ))}
          </div>

          <div className="flex gap-5 w-full">
            <button type="button" onClick={onBack} disabled={loading} className="border-1 rounded-xl p-3 flex justify-center items-center cursor-pointer w-full bg-red-300">Cancel</button>
            <button type="submit" disabled={loading} className="border-1 rounded-xl p-3 flex justify-center items-center cursor-pointer w-full bg-green-400 text-white">{loading ? "Updating..." : "Update"}</button>
          </div>
        </div>
      </div>
    </form>
  );
};

export default UpdateProduct;
