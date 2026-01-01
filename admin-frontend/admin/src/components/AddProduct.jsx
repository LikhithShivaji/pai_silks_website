import React, { useState, useEffect } from "react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import ImageUpload from "./ImageUpload";
import ImageIcon from "@/assets/svg/ImageIcon.svg?react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const AddProduct = ({
  setCategoryProducts,
  categoryName,
  onBack,
  categories,
}) => {
  const [imageFiles, setImageFiles] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [collections, setCollections] = useState([]);
  const [loadingCollections, setLoadingCollections] = useState(true);

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
    isNewRelease: false, 
  });

  useEffect(() => {
    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previewUrls]);

  useEffect(() => {
    if (loadingCollections) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [loadingCollections]);

  useEffect(() => {
    fetch("https://pai-silks-website-1.onrender.com/api/collections")
      .then((res) => res.json())
      .then((data) => data.success && setCollections(data.data))
      .finally(() => setLoadingCollections(false));
  }, []);

  const handleImageUpload = (file) => {
    if (!file) return;

    setImageFiles((prev) => {
      const updated = [...prev, file].slice(0, 4); // Max 4
      return updated;
    });

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrls((prev) => {
      const updated = [...prev, objectUrl].slice(0, 4);
      return updated;
    });
  };

  const handleSaveProduct = async () => {
    if (!newProduct.name.trim()) {
      alert("Please enter the required field (Product Name)");
      return false;
    }

    const nowIso = new Date().toISOString();
    const catKey =
      newProduct.category?.trim() || categoryName?.trim() || "UNCATEGORIZED";

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
      is_new_release: newProduct.isNewRelease ? 1 : 0,
      created_at: nowIso,
      updated_at: nowIso,
    };

    try {
      console.log("Step 1: Creating Product...", payload);
      const res = await fetch(
        "https://pai-silks-website.onrender.com/api/create-product",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        alert(`Server Error: ${errorText || "Could not create product"}`);
        return false;
      }

      const created = await res.json();

      // ✅ ROBUST ID EXTRACTION
      const newProductId =
        created.product_id ||
        created.id ||
        created.insertId ||
        (created.data && created.data.insertId) ||
        (created.data && created.data.product_id);

      console.log(
        `Product Created (ID: ${newProductId}). Step 2: Uploading Images...`
      );
      console.log(
        `Product Created new release is set to: ${newProduct.isNewRelease}). Step 2: Uploading Images...`
      );

      let finalImagesForUI = previewUrls; 

      if (imageFiles.length > 0 && newProductId) {
        const formData = new FormData();

        formData.append("product_id", newProductId);

        imageFiles.forEach((file, index) => {
          formData.append("images", file);
        });

        const imgRes = await fetch(
          "https://pai-silks-website.onrender.com/api/insert-image",
          {
            method: "POST",
            body: formData,
          }
        );

        const imgData = await imgRes.json();

        if (imgData.success === "true" || imgData.success === true) {
          console.log("✅ Images Uploaded!", imgData);

          if (imgData.images && Array.isArray(imgData.images)) {
            finalImagesForUI = imgData.images.map((img) => img.image_url);
          }
        } else {
          console.warn("Image upload warning:", imgData);
          alert("Product created, but check image upload status.");
        }
      }

      alert(`Success! Product added successfully`);

      setCategoryProducts((prev = {}) => {
        const newProdForUI = {
          ...(created || payload),
          id: newProductId || Date.now(),
          images: finalImagesForUI,
        };

        const updated = {
          ...prev,
          [catKey]: [...(prev[catKey] || []), newProdForUI],
        };

        localStorage.setItem("categoryProducts", JSON.stringify(updated));
        return updated;
      });

      // Reset Form
      setImageFiles([]);
      setPreviewUrls([]);
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
        isNewRelease: false,
      });

      return true;
    } catch (err) {
      console.error("Error:", err);
      alert("Something went wrong.");
      return false;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const ok = await handleSaveProduct();
    if (ok) onBack();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full flex flex-col gap-3"
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

      <div className="h-full bg-white rounded-2xl flex flex-col xl:flex-row gap-10 p-5">
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

          <Select
            value={newProduct.category}
            onValueChange={(value) =>
              setNewProduct({ ...newProduct, category: value })
            }
          >
            <SelectTrigger className="w-full border border-black">
              <SelectValue placeholder="Select a Category" />
            </SelectTrigger>

            <SelectContent>
              {categories && categories.length > 0 ? (
                categories.map((cat, idx) => {
                  const categoryValue = cat.name || cat;

                  return (
                    <SelectItem key={idx} value={categoryValue}>
                      {categoryValue}
                    </SelectItem>
                  );
                })
              ) : (
                <SelectItem value="none" disabled>
                  No Categories Available
                </SelectItem>
              )}
            </SelectContent>
          </Select>

          <label className="font-bold">Collection</label>
          <Select
            onValueChange={(value) =>
              setNewProduct({ ...newProduct, collection: value })
            }
            value={newProduct.collection}
          >
            <SelectTrigger className="border-1 border-black w-full">
              <SelectValue
                placeholder={
                  loadingCollections ? "Loading..." : "Select Collection"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {collections.map((item, idx) => (
                // API returns object with "collection" key
                <SelectItem key={item.id || idx} value={item.collection}>
                  {item.collection}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

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

          <div className="flex flex-col justify-between gap-10">
            <div className="flex-1">
              <label className="font-bold block mb-2">Stock Quantity</label>
              <Input
                name="quantity"
                placeholder="Stock Quantity"
                className="border-1 border-black resize-none"
                value={newProduct.stockQty}
                onChange={(e) =>
                  setNewProduct({ ...newProduct, stockQty: e.target.value })
                }
              />
            </div>

            {/* --- NEW RELEASE TOGGLE --- */}
            <div className="flex flex-col gap-2 items-start">
              <label className="font-bold">Is New Release?</label>
              <div
                onClick={() =>
                  setNewProduct({
                    ...newProduct,
                    isNewRelease: !newProduct.isNewRelease,
                  })
                }
                className={`
                  w-14 h-7 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300
                  ${newProduct.isNewRelease ? "bg-green-500" : "bg-gray-300"}
                `}
              >
                <div
                  className={`
                    bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-300
                    ${
                      newProduct.isNewRelease
                        ? "translate-x-7"
                        : "translate-x-0"
                    }
                  `}
                />
              </div>
              <span className="text-xs text-gray-500">
                {newProduct.isNewRelease
                  ? "Yes, Mark as New"
                  : "No, Standard Product"}
              </span>
            </div>
          </div>

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
            {previewUrls.length === 0 ? (
              <div>Add images here</div>
            ) : (
              <div className="w-full aspect-square grid grid-cols-2 grid-rows-2 gap-3 bg-gray-300 rounded-xl overflow-hidden">
                {previewUrls.map((src, idx) => (
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
