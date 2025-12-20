import React, { useState } from "react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import ImageUpload from "./ImageUpload";
import ImageIcon from "@/assets/svg/ImageIcon.svg?react";

const AddProduct = ({ setCategoryProducts, categoryName, onBack }) => {
  const [productImages, setProductImages] = useState([]);

  const [newProduct, setNewProduct] = useState({
    name: "",
    category: "",
    description: "",
    material: "",
    code: "",
    length: "",
    washCare: "",
    regularPrice: "",
    discountedPrice: "",
    collection: "",
    stockQty: "",
  });

  // Compress and convert to base64
  const compressAndConvert = (file, maxWidth = 1024, quality = 0.7) =>
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

  // Called by ImageUpload when each image is done
  const handleImageUpload = async (previewUrl) => {
    try {
      let finalUrl = previewUrl;

      if (previewUrl instanceof File) {
        finalUrl = await compressAndConvert(previewUrl, 800, 0.75);
      } else if (
        typeof previewUrl === "string" &&
        previewUrl.startsWith("blob:")
      ) {
        const resp = await fetch(previewUrl);
        const blob = await resp.blob();
        finalUrl = await compressAndConvert(blob, 800, 0.75);
      }

      setProductImages((prev) => {
        const updated = [...prev, finalUrl].slice(0, 4); // max 4
        return updated;
      });
    } catch (err) {
      console.error("handleImageUpload error:", err);
      alert("Failed to process image. Try a smaller file.");
    }
  };

  const handleSaveProduct = async () => {
    if (!newProduct.name.trim()) {
      alert("Please enter the required field");
      return false;
    }

    const nowIso = new Date().toISOString();
    const catKey =
      newProduct.category?.trim() || categoryName?.trim() || "UNCATEGORIZED";

    // Build API payload exactly how backend expects
    const payload = {
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
      stock_qty: Number(newProduct.stockQty) || 0,
      image_url: productImages, // base64 array
      created_at: nowIso,
      updated_at: nowIso,
    };

    try {
      const res = await fetch("https://pai-silks-website.onrender.com/api/create-product", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        // const errorText = await res.text().catch(() => "");
        console.log("Status is :", res.status);
        alert(`Success! ${res.status}: ${"Product added successfully"}`);
        onBack();
        return false;
      }
      
      if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        console.error("API Error:", res.status, errorText);
        alert(`Server Error ${res.status}: ${errorText || "Something went wrong on server"}`);
        return false;
      }
      const created = await res.json(); 

      // Update UI immediately so AllProducts shows it
      setCategoryProducts((prev = {}) => {
        const newProdForUI = {
          ...(created || payload),
          id: created?.product_id || Date.now(),
          images: productImages,
        };

        const updated = {
          ...prev,
          [catKey]: [...(prev[catKey] || []), newProdForUI],
        };

        localStorage.setItem("categoryProducts", JSON.stringify(updated));
        return updated;
      });

      // Reset form state
      setProductImages([]);
      setNewProduct({
        name: "",
        category: "",
        description: "",
        material: "",
        code: "",
        length: "",
        washCare: "",
        regularPrice: "",
        discountedPrice: "",
        collection: "",
        stockQty: "",
      });

      return true;
    } catch (err) {
      console.error("Network/JSON Error:", err);
      alert("Something went wrong while saving the product.");
      return false;
    }
  };

  // form submit handler — validates, hits API, updates UI, then navigates back
  const handleSubmit = async (e) => {
    e.preventDefault();
    const ok = await handleSaveProduct();
    if (ok) onBack();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="border-1 border-red-500 w-full p-5 flex flex-col gap-3"
    >
      <div className="flex justify-between w-full">
        <div className="flex flex-col gap-3">
          <p className="text-3xl">Product Details</p>
          <p>Home {" > "} Add Products</p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="border-1 cursor-pointer bg-[#68232B] text-white h-fit px-10 py-3 rounded-xl"
        >
          Back
        </button>
      </div>

      <div className="h-full bg-white rounded-2xl flex flex-row gap-10 p-5">
        {/* LEFT: product inputs */}
        <div className="w-full p-2 flex flex-col gap-5">
          <label className="font-bold">Product Name</label>
          <Input
            name="name"
            required
            placeholder="Product Name"
            className="border-1 border-black resize-none"
            value={newProduct.name}
            onChange={(e) =>
              setNewProduct({ ...newProduct, name: e.target.value })
            }
          />

          <label className="font-bold">Category</label>
          <Input
            name="category"
            placeholder="Category"
            className="border-1 border-black resize-none"
            value={newProduct.category}
            onChange={(e) =>
              setNewProduct({ ...newProduct, category: e.target.value })
            }
          />

          <label className="font-bold">Collection</label>
          <Input
            name="collection"
            placeholder="Party Wear"
            className="border-1 border-black resize-none"
            value={newProduct.collection}
            onChange={(e) =>
              setNewProduct({ ...newProduct, collection: e.target.value })
            }
          />

          <label className="font-bold">Description</label>
          <Textarea
            name="description"
            placeholder="Description"
            className="border-1 border-black h-40 resize-none"
            value={newProduct.description}
            onChange={(e) =>
              setNewProduct({ ...newProduct, description: e.target.value })
            }
          />

          <label className="font-bold">Material</label>
          <Input
            name="material"
            placeholder="Material"
            className="border-1 border-black resize-none"
            value={newProduct.material}
            onChange={(e) =>
              setNewProduct({ ...newProduct, material: e.target.value })
            }
          />

          <label className="font-bold">Product Code</label>
          <Input
            name="code"
            placeholder="Product Code"
            className="border-1 border-black resize-none"
            value={newProduct.code}
            onChange={(e) =>
              setNewProduct({ ...newProduct, code: e.target.value })
            }
          />

          <label className="font-bold">Saree Length</label>
          <Input
            name="length"
            placeholder="6.2 meter"
            className="border-1 border-black resize-none"
            value={newProduct.length}
            onChange={(e) =>
              setNewProduct({ ...newProduct, length: e.target.value })
            }
          />

          <label className="font-bold">Wash Care</label>
          <Input
            name="care"
            placeholder="Dry clean"
            className="border-1 border-black resize-none"
            value={newProduct.washCare}
            onChange={(e) =>
              setNewProduct({ ...newProduct, washCare: e.target.value })
            }
          />

          <label className="font-bold">Stock Quantity</label>
          <Input
            name="quantity"
            placeholder="Stock Quantity"
            className="border-1 border-black resize-none"
            value={newProduct.stockQty}
            onChange={(e) =>
              setNewProduct({ ...newProduct, stockQty: e.target.value })
            }
          />

          <div className="w-full flex gap-5">
            <div className="w-full flex flex-col gap-3">
              <p>Regular Price</p>
              <Input
                name="regularPrice"
                placeholder="Regular Price"
                className="border-1 border-black resize-none"
                value={newProduct.regularPrice}
                onChange={(e) =>
                  setNewProduct({
                    ...newProduct,
                    regularPrice: e.target.value,
                  })
                }
              />
            </div>
            <div className="w-full flex flex-col gap-3">
              <p>Discounted Price</p>
              <Input
                name="discountedPrice"
                placeholder="Discounted Price"
                className="border-1 border-black resize-none"
                value={newProduct.discountedPrice}
                onChange={(e) =>
                  setNewProduct({
                    ...newProduct,
                    discountedPrice: e.target.value,
                  })
                }
              />
            </div>
          </div>
        </div>

        {/* RIGHT: images & actions */}
        <div className="h-full w-full py-3 px-10 flex flex-col gap-5">
          <div className="w-full aspect-square gap-3 mt-3 bg-gray-300 p-5 rounded-xl flex justify-center items-center">
            {productImages.length === 0 ? (
              <div>Add images here</div>
            ) : (
              <div className="w-full aspect-square grid grid-cols-2 grid-rows-2 gap-3 bg-gray-300 rounded-xl overflow-hidden">
                {productImages.map((src, idx) => (
                  <div
                    key={idx}
                    className="w-full h-full overflow-hidden rounded-lg border-1"
                  >
                    <img
                      src={src}
                      alt={`preview-${idx}`}
                      className="w-full h-full object-cover"
                    />
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

            {/* 4 upload slots */}
            {[...Array(4)].map((_, i) => (
              <ImageUpload key={i} onImageUpload={handleImageUpload} />
            ))}
          </div>

          <div className="flex gap-5 w-full">
            <button
              type="button"
              onClick={onBack}
              className="border-1 rounded-xl p-3 flex justify-center items-center cursor-pointer w-full bg-red-300"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() => alert("Update logic not implemented yet")}
              className="border-1 rounded-xl p-3 flex justify-center items-center cursor-pointer w-full bg-gray-400 text-white"
            >
              Update
            </button>

            <button
              type="submit"
              className="border-1 rounded-xl p-3 flex justify-center items-center cursor-pointer w-full bg-green-300"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </form>
  );
};

export default AddProduct;
