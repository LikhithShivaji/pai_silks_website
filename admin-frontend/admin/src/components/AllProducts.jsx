import React, { useEffect, useMemo, useState } from "react";
import { Trash, Search, X } from "lucide-react";
import { ADMIN_API, apiFetch } from "@/config/api";

import CategoryImageUpload from "./CategoryImageUpload";

/**
 * Does this product match the admin's search box?
 *
 * Filtered IN THE BROWSER, not on the server — and that is the right call here
 * specifically because the whole category is already in memory. The admin has
 * just waited for that fetch; making them wait again per keystroke to narrow a
 * list they can already see would be slower and no more correct.
 *
 * (The storefront search is server-side for the opposite reason: it searches
 * the whole catalogue, which the browser does not hold.)
 *
 * Per WORD, like the storefront, so "green silk" finds a green silk saree
 * rather than needing that exact phrase. Every word must match SOMETHING —
 * AND, not OR — because this is a filter over a list the admin is looking at,
 * where each extra word should narrow the result. That is the opposite of the
 * storefront, where OR keeps a partial match useful when a customer is
 * guessing.
 *
 * `code` is included and matters most: it is how the shop identifies a saree
 * off a physical label, and it is the one field an admin is most likely to type
 * in full.
 */
const matchesSearch = (product, query) => {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;

  const haystack = [
    product.name,
    product.code,
    product.collection,
    product.material,
    product.description,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return words.every((w) => haystack.includes(w));
};

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

  const [search, setSearch] = useState("");

  // Cleared whenever the category changes. Without this, switching from a
  // category where "silk" was typed into one with no silk shows an empty grid
  // and a search box the admin has already forgotten about — it reads as "this
  // category is empty" rather than "your filter matched nothing".
  useEffect(() => {
    setSearch("");
  }, [categoryName]);

  // useMemo so typing does not re-filter on every unrelated re-render. The list
  // is small, but this also gives the grid a stable array identity between
  // keystrokes that change nothing.
  const visibleProducts = useMemo(
    () => products.filter((p) => matchesSearch(p, search)),
    [products, search]
  );

  const isSearching = search.trim().length > 0;

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
          {categoryName}{" "}
          {/* While filtering, show "3 of 12" rather than a bare count. A single
              shrinking number looks like products have been deleted. */}
          <span className="text-sm text-gray-500">
            ({isSearching
              ? `${visibleProducts.length} of ${products.length}`
              : products.length})
          </span>
        </h2>
        {/* Search within THIS category.
            Placed before the actions rather than beside the heading: it is a
            control over the list below it, and grouping it with Back/Add keeps
            the row to two blocks on a phone instead of three. */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 shrink-0">
          <div className="relative w-full sm:w-56">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search in this category…"
              aria-label={`Search products in ${categoryName || "this category"}`}
              className="w-full pl-9 pr-9 py-2 rounded-lg border border-gray-300 bg-white text-sm placeholder:text-gray-400 focus:outline-none focus:border-[#68232B] focus:ring-2 focus:ring-[#68232B]/10 transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#68232B]"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className="flex gap-2 items-center">
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
      ) : visibleProducts.length === 0 ? (
        // A DIFFERENT empty state from the one above, deliberately. "This
        // category is empty" and "your search matched nothing" are not the same
        // situation, and showing the first message while a filter is active
        // would send the admin looking for products that are sitting right
        // there behind the search box.
        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16">
          <p className="text-gray-600 font-medium">
            No products match &ldquo;{search.trim()}&rdquo;
          </p>
          <p className="text-sm text-gray-400">
            Searches name, product code, collection, material and description.
          </p>
          <button
            type="button"
            onClick={() => setSearch("")}
            className="mt-1 px-4 py-2 rounded-lg bg-[#68232B] text-white text-sm hover:bg-[#8B2E39] transition-colors"
          >
            Clear search
          </button>
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
          {visibleProducts.map((product) => (
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