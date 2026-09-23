import React, { useEffect, useState } from "react";
import { Trash } from "lucide-react";
import { ADMIN_API, apiFetch } from "@/config/api";

import CategoryImageUpload from "./CategoryImageUpload";

const AllProducts = ({
  categoryName,
  categoryId,
  categoryImageUrl,
  onCategoryImageUploaded,
  onBack,
  onAddProductClick,
  onUpdateProduct,
}) => {
  const [products, setProducts] = useState([]);
  // `loading` starts FALSE, not true.
  //
  // It used to start true while the fetch below was gated on `if (categoryName)`.
  // Rendered without a category — which AdminHomePage does, its initial state
  // being "" — no fetch ever started, nothing ever set loading false, and the
  // page showed "Loading..." permanently with no data, no error and no way
  // back. Loading is now set only when a fetch actually begins.
  // See CLAUDE.md AF-23.
  const [loading, setLoading] = useState(false);
  // `debugLog` removed — it fed a panel headed "⚠️ Tips for Exact Matching"
  // that dumped every category name in the database onto the admin's screen.
  // Debug scaffolding shipped to production. See CLAUDE.md AF-21.

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        // `signal` is what makes the abort above take effect — apiFetch passes
        // its options through to fetch.
        const res = await apiFetch(`${ADMIN_API}/api/get-all-product-details`, {
          signal: controller.signal,
        });
        const apiResponse = await res.json();
        
        const productList = apiResponse.data || [];
        
        const filtered = productList.filter((p) => {
            if (!p.category || !categoryName) return false;
            const dbCat = p.category.toString().toLowerCase().trim();
            const sideCat = categoryName.toString().toLowerCase().trim();
            return dbCat === sideCat;
        });

        const mapped = filtered.map((p) => {
          let rawImages = p.image_url || p.images || [];
          let cleanImages = [];

          if (Array.isArray(rawImages)) {
             cleanImages = rawImages.map(img => typeof img === 'object' ? (img.image_url || img.url) : img);
          } else if (typeof rawImages === 'string') {
             cleanImages = rawImages.includes(',') ? rawImages.split(',') : [rawImages];
          }

          return {
            id: p.product_id || p.id,
            name: p.name,
            category: p.category,
            collection: p.collection,
            description: p.description,
            material: p.material,
            code: p.product_code,
            washCare: p.product_wash_care,
            length: p.saree_length,
            regularPrice: p.regular_price,
            discountedPrice: p.selling_price,
            stockQty: p.stock_qty,
            images: cleanImages,
            isNewRelease: p.is_new_release
          };
        });

        setProducts(mapped);
      } catch (err) {
        // An aborted request is not a failure — it means the admin switched
        // category before this one finished, and its result is now unwanted.
        if (err.name === "AbortError") return;
        console.error("Fetch Error:", err);
      } finally {
        // Guarded: without this, a superseded request's `finally` would clear
        // the loading state belonging to the request that replaced it.
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    // AbortController — without it, switching category A → B quickly let A's
    // slower response land AFTER B's and overwrite it, leaving the admin
    // looking at category B with category A's products. See CLAUDE.md AF-22.
    const controller = new AbortController();

    if (categoryName) {
      setLoading(true);
      fetchProducts();
    } else {
      // No category selected: no fetch starts, so nothing would ever clear a
      // `loading` that began as true. This is the other half of AF-23.
      setProducts([]);
      setLoading(false);
    }

    return () => controller.abort();
  }, [categoryName]);

  const handleDeleteProduct = async (productId) => {
    const isConfirmed = window.confirm("Are you sure you want to delete this product?");
    if (!isConfirmed) return;

    try {
      // ✅ FIX: Add the ID to the URL using template literals `${productId}`
      const res = await apiFetch(`${ADMIN_API}/api/delete-product/${productId}`, {
        method: "DELETE", // Usually route parameters use DELETE, but if this fails, try "POST"
        headers: {
          "Content-Type": "application/json",
        },
        // ❌ No body needed anymore, because the ID is in the URL
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setProducts((prev) => prev.filter((p) => p.id !== productId));
        alert("Product deleted successfully!");
      } else {
        alert("Failed to delete: " + (data.message || "Unknown error"));
      }
    } catch (err) {
      console.error("Delete Error:", err);
      alert("Something went wrong.");
    }
  };

  if (loading) return <div className="p-10 text-center">Loading...</div>;

  return (
    <div className="w-full flex flex-col gap-4 h-full rounded-xl">
      {/* Stacks on a phone. Side by side, a long category name ("Art Silk
          Sarees") wrapped and pushed the count onto its own line while the
          thumbnail and both buttons were squeezed against the right edge. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center py-4 sm:py-5 px-2 sm:px-0 border-b-1 border-b-white">
        <h2 className="text-lg sm:text-xl font-semibold min-w-0">
          {categoryName} <span className="text-sm text-gray-500">({products.length})</span>
        </h2>
        <div className="flex gap-2 items-center shrink-0">
          {/* Category tile image (CF-35). Placed with the action buttons rather
              than in a settings screen, because it belongs to the category the
              admin is already looking at. */}
          {categoryId && (
            <CategoryImageUpload
              categoryId={categoryId}
              categoryName={categoryName}
              imageUrl={categoryImageUrl}
              onUploaded={onCategoryImageUploaded}
            />
          )}
          <button onClick={onBack} className="flex-1 sm:flex-none whitespace-nowrap bg-gray-200 px-3 py-2 sm:py-1 rounded hover:bg-gray-300 transition-colors">← Back</button>
          <button onClick={onAddProductClick} className="flex-1 sm:flex-none whitespace-nowrap bg-[#68232B] text-white px-3 py-2 sm:py-1 rounded hover:bg-[#8B2E39] transition-colors">+ Add</button>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          {/* The debug panel that used to sit here — headed "⚠️ Tips for Exact
              Matching", explaining strict category matching and listing every
              category name in the database — has been removed. It was developer
              scaffolding shipped to production, shown to the shop owner.
              See CLAUDE.md AF-21. */}
          <p className="text-gray-500">
            {categoryName
              ? `No products in "${categoryName}" yet.`
              : "Select a category to see its products."}
          </p>
        </div>
      ) : (
        // Two per row on a phone, auto-fill from 640px up.
        //
        // Every breakpoint used to specify `minmax(300px,1fr)`, including the
        // two that exist to handle SMALL screens — so on a 390px phone exactly
        // one 300px column ever fit and the three media queries were
        // decorative. An explicit 2-column grid below `sm` is what actually
        // produces two cards per row.
        <div className="grid grid-cols-2 gap-3 p-2
              sm:gap-[1.7rem] sm:p-6
              sm:grid-cols-[repeat(auto-fill,minmax(300px,1fr))]">
          {products.map((product) => (
            <div key={product.id} className="p-3 sm:p-5 bg-[#F5F5F5] rounded-2xl cursor-pointer flex flex-col gap-3 sm:gap-5 hover:shadow-lg transition-all" onClick={() => onUpdateProduct(product)}>
              {/* Image ABOVE the text on a phone, beside it from `sm`.
                  Two cards across a 390px screen leaves ~175px per card; a
                  96px image beside the text would leave ~70px for a saree name
                  and a price, which is unreadable. Stacked, the image gets the
                  full card width and the text gets a real line length. */}
              <div className="w-full flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <div className="w-full h-28 sm:w-24 sm:h-24 flex-shrink-0 border bg-white rounded-xl overflow-hidden">
                    <img src={product.images[0] || "https://placehold.co/100"} alt="" className="w-full h-full object-cover object-center"/>
                </div>
                <div className="flex flex-col gap-1 min-w-0">
                  {/* Two lines on a phone: a saree name rarely fits one line at
                      this width, and a single clamped line turns most of the
                      catalogue into indistinguishable truncations. */}
                  <p className="font-semibold text-sm sm:text-base line-clamp-2 sm:line-clamp-1">{product.name}</p>
                  <p className="text-xs text-gray-500 truncate">{product.category}</p>
                  <p className="font-bold text-sm sm:text-base text-[#68232B]">₹{product.discountedPrice}</p>

                  {/* Stock. The admin card showed name, category, price and
                      description and NOTHING about stock — so the one person
                      who can actually restock a saree had to open the edit form
                      to discover it had sold out. Zero is called out in red
                      because it is the state that needs action; a low count is
                      amber as an early warning; anything healthy is quiet, so
                      the colour means something.
                      `stockQty` may legitimately be 0, so `??` not `||` — the
                      latter would turn a real 0 into "—". */}
                  {(() => {
                    const qty = Number(product.stockQty ?? NaN);
                    if (!Number.isFinite(qty)) {
                      return <p className="text-xs text-gray-400">Stock unknown</p>;
                    }
                    if (qty === 0) {
                      return (
                        <span className="w-fit rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-red-700">
                          Sold Out
                        </span>
                      );
                    }
                    if (qty <= 3) {
                      return (
                        <span className="w-fit rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                          Only {qty} left
                        </span>
                      );
                    }
                    return <p className="text-xs text-gray-500">In stock: {qty}</p>;
                  })()}
                </div>
              </div>
              <div className="flex justify-between items-center gap-2 pt-2 border-t mt-auto">
                  {/* Hidden below `sm`: at ~175px wide the description was
                      truncated to three or four words, which carried no
                      information and only stole room from the delete control. */}
                  <p className="hidden sm:block text-xs text-gray-500 truncate w-3/4">{product.description}</p>
                  {/* ml-auto: with the description hidden on a phone this is
                      the row's only child, so justify-between leaves it pinned
                      left where it reads as an orphan. */}
                  <button className="ml-auto text-red-400 hover:text-red-600" onClick={(e) => { e.stopPropagation(); handleDeleteProduct(product.id); }}>
                    <Trash size={18} />
                  </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AllProducts;