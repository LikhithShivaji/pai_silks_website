import React, { useState, useEffect, useRef } from "react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import ImageUpload from "./ImageUpload";
import ImageIcon from "@/assets/svg/ImageIcon.svg?react";
import { ADMIN_API, CLIENT_API, apiFetch } from "@/config/api";
import { useToast } from "@/ToastContext";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const AddProduct = ({
  categoryName,
  onBack,
  categories,
}) => {
  const { showToast } = useToast();
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

  // Every blob URL this component created, tracked in a ref.
  //
  // The cleanup below used to be keyed on `[previewUrls]`, so it ran on EVERY
  // change to that array — revoking the PREVIOUS array's URLs, which were still
  // rendered on screen. Adding a second image therefore broke the first
  // thumbnail. See CLAUDE.md AF-12.
  //
  // A ref is used rather than state because the cleanup must not re-run when
  // the list changes; it should fire exactly once, on unmount, and revoke
  // everything this component ever created.
  const createdBlobUrls = useRef([]);

  useEffect(() => {
    const urls = createdBlobUrls.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  // The body scroll lock that stood here is gone. See CLAUDE.md AF-31.
  //
  // It froze the WHOLE PAGE while the collections dropdown loaded — and the
  // only sign anything was loading was the word "Loading..." inside that one
  // `<select>` (`:374`). So the admin opened Add Product, saw a complete form,
  // and could not scroll it, with nothing on screen explaining why.
  //
  // Two further problems with the approach itself: a child component writing to
  // `document.body` fights the app shell for control of scrolling, and the
  // cleanup reset to the hardcoded "auto" rather than restoring the previous
  // value, so it would clobber any other lock that happened to be active.
  //
  // Nothing replaces it: the dropdown already says "Loading...", and every
  // other field on the form is usable while it arrives.

  // .catch is required here, not optional.
  //
  // Without it, any network failure or non-JSON response — a 401 HTML page, a
  // Render cold-start error page — became an unhandled rejection. And
  // `data.success && setCollections(data.data)` could set `undefined` when the
  // response reported success but carried no data, after which
  // `collections.map(...)` threw during render and white-screened the whole Add
  // Product page. Defaulting to [] means the page still works, just with an
  // empty dropdown. See CLAUDE.md AF-13.
  useEffect(() => {
    apiFetch(`${CLIENT_API}/api/collections`)
      .then((res) => res.json())
      .then((data) => setCollections(Array.isArray(data?.data) ? data.data : []))
      .catch((err) => {
        console.error("Could not load collections:", err);
        setCollections([]);
      })
      .finally(() => setLoadingCollections(false));
  }, []);

  const handleImageUpload = (file) => {
    if (!file) return;

    setImageFiles((prev) => {
      const updated = [...prev, file].slice(0, 4); // Max 4
      return updated;
    });

    const objectUrl = URL.createObjectURL(file);
    // Remember it so the unmount cleanup can revoke it. Tracking here rather
    // than reading previewUrls means a URL dropped by the .slice(0, 4) below is
    // still released instead of leaking. See CLAUDE.md AF-12.
    createdBlobUrls.current.push(objectUrl);

    setPreviewUrls((prev) => {
      const updated = [...prev, objectUrl].slice(0, 4);
      return updated;
    });
  };

  /**
   * Validate before anything is sent.
   *
   * Only `name` was ever checked. The price fields were plain text inputs, so
   * `Number("abc") || 0` published a product at price ZERO on the live
   * storefront, and "-500" stored a negative price. selling_price was never
   * compared against regular_price. See CLAUDE.md AF-18.
   *
   * The server re-validates all of this independently (Phase 3 Slice 3) — this
   * is for immediate feedback, not the security boundary.
   *
   * @returns {string|null} first error message, or null when valid
   */
  const validateProduct = () => {
    if (!newProduct.name.trim()) return "Product name is required.";
    if (newProduct.name.length > 255) return "Product name must be 255 characters or fewer.";

    const regular = newProduct.regularPrice;
    const selling = newProduct.discountedPrice;

    // Both prices are REQUIRED and must be greater than zero.
    //
    // Previously the selling price was optional and 0 was accepted, which is
    // how product 49 came to exist with regular_price 4999 and selling_price
    // NULL. getCart aliases selling_price AS price, so such a product reaches
    // checkout unpriced: it used to be silently dropped from the order and the
    // whole cart cleared with it. Owner decision, 2026-08-29 — neither price may
    // be empty or 0. See CLAUDE.md CB-24b-data.
    //
    // The server enforces the same rule independently (validators.js); this is
    // immediate feedback, not the boundary.
    if (regular === "" || regular === null || regular === undefined)
      return "Regular price cannot be left empty.";
    if (!Number.isFinite(Number(regular)) || Number(regular) <= 0)
      return "Regular price cannot be 0 — enter a price greater than 0.";

    if (selling === "" || selling === null || selling === undefined)
      return "Selling price cannot be left empty.";
    if (!Number.isFinite(Number(selling)) || Number(selling) <= 0)
      return "Selling price cannot be 0 — enter a price greater than 0.";
    if (Number(selling) > Number(regular))
      return "Selling price cannot be higher than the regular price.";

    if (newProduct.stockQty !== "" && newProduct.stockQty !== null) {
      const stock = Number(newProduct.stockQty);
      if (!Number.isInteger(stock) || stock < 0)
        return "Stock quantity must be a whole number of 0 or more.";
    }

    return null;
  };

  const handleSaveProduct = async () => {
    const validationError = validateProduct();
    if (validationError) {
      // Toast rather than alert(): non-blocking, and several can stack.
      showToast(validationError);
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
      const res = await apiFetch(
        `${ADMIN_API}/api/create-product`,
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

      // `finalImagesForUI` was tracked here purely to hand to setCategoryProducts,
      // which is gone (AF-08). The upload below still runs and is still checked —
      // only the unread bookkeeping was removed.
      if (imageFiles.length > 0 && newProductId) {
        const formData = new FormData();

        formData.append("product_id", newProductId);

        // No `index` param — it was declared and never used. Every file goes
        // under the same "images" field name, which is what multer's
        // .array("images") expects.
        imageFiles.forEach((file) => {
          formData.append("images", file);
        });

        const imgRes = await apiFetch(
          `${ADMIN_API}/api/insert-image`,
          {
            method: "POST",
            body: formData,
          }
        );

        const imgData = await imgRes.json();

        // Inverted from `if (success) {...} else {warn}` — the success branch only
        // existed to populate finalImagesForUI. The warning behaviour is identical.
        if (!(imgData.success === "true" || imgData.success === true)) {
          console.warn("Image upload did not report success.");
          alert("Product created, but check image upload status.");
        }
      }

      alert(`Success! Product added successfully`);

      // The setCategoryProducts(...) call that stood here is gone, and so is the
      // `categoryProducts` state in AdminHomePage that it wrote into.
      //
      // AF-08 removed a write-only localStorage cache; this was the same
      // write-only pattern one level up. Two forms pushed the newly created
      // product into a state object that NOTHING read — not this component, not
      // AdminHomePage, not AllProducts. AllProducts refetches from the server,
      // which is why nobody ever noticed. Removing the state alone would have
      // left these callers referencing an undefined setter, so the prop, both
      // pass sites and both calls go together. See CLAUDE.md AF-08.

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
                type="number"
                min="0"
                step="0.01"
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
                type="number"
                min="0"
                step="0.01"
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

            {/* An "Update" button stood here whose entire behaviour was
                alert("Update logic not implemented yet"). See CLAUDE.md AF-30.
                Removed rather than implemented: this is the ADD Product form,
                and updating is already a separate, working screen
                (UpdateProduct.jsx, reached from the product list). The button
                was a leftover from before that screen existed, and its only
                effect was to show the shop owner a developer's note. */}

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
