import React, { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import ImageUpload from "./ImageUpload";
import ImageIcon from "@/assets/svg/ImageIcon.svg?react";

const UpdateProduct = ({ setCategoryProducts, categoryName, onBack, updateProductDetails }) => {
  
  // 1. STATE
  const [imageFiles, setImageFiles] = useState([]); 
  const [previewUrls, setPreviewUrls] = useState([]);
  const [loading, setLoading] = useState(false);

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
    isNewRelease: false,
  });

  // 2. INITIALIZE
  useEffect(() => {
    if (!updateProductDetails) return;

    setNewProduct({
      name: updateProductDetails.product ?? updateProductDetails.name ?? "",
      category: updateProductDetails.category ?? "",
      description: updateProductDetails.description ?? "",
      material: updateProductDetails.material ?? "",
      code: updateProductDetails.product_code ?? updateProductDetails.code ?? "",
      length: updateProductDetails.saree_length ?? updateProductDetails.length ?? "",
      washCare: updateProductDetails.product_wash_care ?? updateProductDetails.washCare ?? "",
      collection: updateProductDetails.collection ?? "",
      stockQty: updateProductDetails.stock_qty ?? updateProductDetails.stockQty ?? "",
      regularPrice: updateProductDetails.regular_price ?? updateProductDetails.regularPrice ?? "",
      discountedPrice: updateProductDetails.selling_price ?? updateProductDetails.discountedPrice ?? "",
      isNewRelease: Number(updateProductDetails.isNewRelease) === 1 || updateProductDetails.isNewRelease === true,
    });

    // Handle Existing Images
    let existingImages = [];
    if (Array.isArray(updateProductDetails.images)) {
       existingImages = updateProductDetails.images;
    } else if (updateProductDetails.image_url) {
       existingImages = Array.isArray(updateProductDetails.image_url) 
          ? updateProductDetails.image_url 
          : [updateProductDetails.image_url];
    }
    
    const cleanUrls = existingImages.map(img => 
       typeof img === 'object' ? (img.image_url || img.url) : img
    );
    
    setPreviewUrls(cleanUrls);
    setImageFiles([]); 

    console.log("🔥 DEBUG DATA CHECK:", updateProductDetails);

  }, [updateProductDetails]);


  // 3. LOGIC: Handle Image Selection
  const handleImageUpload = (file) => {
    if (!file) return;

    setImageFiles((prev) => {
      const updated = [...prev, file].slice(0, 4); 
      return updated;
    });

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrls((prev) => {
      const updated = [...prev, objectUrl].slice(0, 4);
      return updated;
    });
  };


  // 4. LOGIC: Save (Update) Product - SINGLE STEP
  const handleSaveProduct = async () => {
    if (!newProduct.name?.trim()) {
      alert("Please enter the product name");
      return false;
    }

    const targetId = updateProductDetails?.id || updateProductDetails?.product_id;
    if (!targetId) {
        alert("Error: Missing Product ID. Cannot update.");
        return false;
    }

    setLoading(true);

    // MySQL Friendly Date
    const formatDateForMySQL = (date) => {
        return date.toISOString().slice(0, 19).replace('T', ' ');
    };
    const nowForDb = formatDateForMySQL(new Date());
    const catKey = newProduct.category?.trim() || categoryName?.trim() || "UNCATEGORIZED";

    // --- STEP A: Create FormData (Text + Images) ---
    const formData = new FormData();

    // 1. Append Text Fields
    formData.append("product_id", targetId);
    formData.append("id", targetId); // Send both just in case
    
    formData.append("name", newProduct.name);
    formData.append("description", newProduct.description);
    formData.append("category", catKey);
    formData.append("collection", newProduct.collection);
    formData.append("material", newProduct.material);
    formData.append("product_code", newProduct.code);
    formData.append("product_wash_care", newProduct.washCare);
    formData.append("saree_length", newProduct.length);
    formData.append("regular_price", Number(newProduct.regularPrice) || 0);
    formData.append("selling_price", Number(newProduct.discountedPrice) || 0);
    formData.append("stock_qty", Number(newProduct.stockQty) || 0);
    formData.append("is_new_release", newProduct.isNewRelease ? 1 : 0);
    formData.append("updated_at", nowForDb);

    // 2. Append Images (if any new ones)
    if (imageFiles.length > 0) {
        imageFiles.forEach((file) => {
            formData.append("images", file);
        });
    }

    console.log("--- DEBUGGING FORM DATA ---");
    for (var pair of formData.entries()) {
        console.log(pair[0] + ', ' + pair[1]); 
    }

    try {
      console.log("🚀 Sending Unified Update Request (Text + Images)...");
      
      // ✅ SINGLE CALL: PUT to /api/update-product with FormData
      const res = await fetch("https://pai-silks-website.onrender.com/api/update-product", {
        method: "PUT",
        body: formData, // No "Content-Type" header allowed for FormData!
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Server Error (${res.status}): ${errText}`);
      }

      const responseData = await res.json();
      console.log("✅ Success:", responseData);

      // --- STEP B: Update UI ---
      // We grab new image URLs if the backend sends them back
      let finalImages = previewUrls.filter(url => !url.startsWith('blob:')); // Keep old real URLs
      
      if (responseData.images && Array.isArray(responseData.images)) {
         // If backend returns the new list of images, use that!
         const newUrls = responseData.images.map(img => img.image_url || img);
         finalImages = [...finalImages, ...newUrls];
      } else if (responseData.data && responseData.data.images) {
         // Check inside 'data' object if structure differs
         finalImages = responseData.data.images;
      }

      if (typeof setCategoryProducts === "function") {
        setCategoryProducts((prev = {}) => {
          const cat = catKey;
          const updatedProductForUI = {
            ...updateProductDetails,
            id: targetId,
            name: newProduct.name,
            description: newProduct.description,
            category: catKey,
            collection: newProduct.collection,
            material: newProduct.material,
            product_code: newProduct.code,
            product_wash_care: newProduct.washCare,
            saree_length: newProduct.length,
            regular_price: Number(newProduct.regularPrice),
            selling_price: Number(newProduct.discountedPrice),
            stock_qty: Number(newProduct.stockQty),
            is_new_release: newProduct.isNewRelease ? 1 : 0,
            images: finalImages,
          };

          const newPrev = { ...prev };
          if(newPrev[cat]) {
              newPrev[cat] = newPrev[cat].map((p) => 
                (String(p.id) === String(targetId) || String(p.product_id) === String(targetId) ? updatedProductForUI : p)
              );
          }
          localStorage.setItem("categoryProducts", JSON.stringify(newPrev));
          return newPrev;
        });
      }

      alert("Product updated successfully!");
      onBack && onBack();
      return true;

    } catch (err) {
      console.error("Update Error:", err);
      alert(`Update Failed: ${err.message}`);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    await handleSaveProduct();
  };

  return (
    <form onSubmit={handleSubmit} className="w-full p-5 flex flex-col gap-3">
      {/* Header */}
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
        {/* LEFT FORM */}
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

          <div className="flex items-center justify-between gap-5">
            <div className="flex-1">
              <label className="font-bold block mb-2">Stock Quantity</label>
              <Input
                name="quantity"
                value={newProduct.stockQty ?? ""}
                onChange={(e) => setNewProduct({ ...newProduct, stockQty: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-2 items-start">
              <label className="font-bold">Is New Release?</label>
              <div 
                onClick={() => setNewProduct({ ...newProduct, isNewRelease: !newProduct.isNewRelease })}
                className={`w-14 h-7 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300 ${newProduct.isNewRelease ? "bg-green-500" : "bg-gray-300"}`}
              >
                <div className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-300 ${newProduct.isNewRelease ? "translate-x-7" : "translate-x-0"}`} />
              </div>
              <span className="text-xs text-gray-500">{newProduct.isNewRelease ? "Yes" : "No"}</span>
            </div>
          </div>

          <div className="w-full flex gap-5">
            <div className="w-full flex flex-col gap-3">
                 <p>Regular Price</p>
                 <Input value={newProduct.regularPrice ?? ""} onChange={(e) => setNewProduct({ ...newProduct, regularPrice: e.target.value })} placeholder="Regular Price" />
            </div>
            <div className="w-full flex flex-col gap-3">
                 <p>Discounted Price</p>
                 <Input value={newProduct.discountedPrice ?? ""} onChange={(e) => setNewProduct({ ...newProduct, discountedPrice: e.target.value })} placeholder="Discounted Price" />
            </div>
          </div>
        </div>

        {/* RIGHT IMAGE SECTION */}
        <div className="h-full w-full py-3 px-10 flex flex-col gap-5">
          <div className="w-full aspect-square gap-3 mt-3 bg-gray-300 p-5 rounded-xl flex justify-center items-center">
            {previewUrls.length === 0 ? <div>No images</div> : (
              <div className="w-full aspect-square grid grid-cols-2 grid-rows-2 gap-3 bg-gray-300 rounded-xl overflow-hidden">
                {previewUrls.slice(0, 4).map((src, idx) => (
                  <div key={idx} className="w-full h-full overflow-hidden rounded-lg border-1">
                    <img src={src} alt={`preview-${idx}`} className="w-full h-full object-cover object-center" />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-5">
            <p className="font-semibold">Add More Images</p>
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