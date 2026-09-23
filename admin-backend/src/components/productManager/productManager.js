const dbCmds = require('../../dbOps/adminDbOps');
// `cloudinary` is no longer imported here. This module used to call
// uploader.upload() directly, re-uploading files multer had already uploaded.
// Uploads now happen once, in the multer storage layer; deletions go through
// utils/cloudinaryAssets. See CLAUDE.md AB-10.
const { sanitizeError } = require('../../utils/safeError');
const { withTransaction } = require('../../dbOps/withTransaction');
const { destroyImagesByUrl } = require('../../utils/cloudinaryAssets');





const createProduct = async (productData) => {

    if (!productData.name || !productData.regular_price) {
        throw new Error("Product name and regular price are required");
    }

    // Product row and stock row are ONE unit.
    //
    // These were two independent queries. When the second failed the first
    // stayed, producing a product with no product_stock row — getStock returns
    // 0 for a missing row, so the product sat on the storefront looking normal
    // and every checkout hit "Insufficient stock" after the customer had filled
    // in their address. It happened to 29 of 35 products. See CLAUDE.md AB-14a.
    return withTransaction(async (conn) => {
        const productId = await dbCmds.createProduct(productData, conn);

        const stockQty = productData.stock_qty ?? 0;
        await dbCmds.insertProductStock(productId, stockQty, conn);

        return productId;
    });
};


const updateProduct = async (productData, files = []) => {
  if (!productData.id) {
    throw new Error("Product ID is required");
  }

  // 🔥 Normalize is_new_release
  productData.is_new_release =
    productData.is_new_release !== undefined
      ? Number(productData.is_new_release)
      : 0;

  // The files are ALREADY uploaded by the time this runs.
  //
  // `upload.array('images', 10)` runs multer with CloudinaryStorage, which
  // uploads each file and then sets `file.path = resp.secure_url` (verified in
  // multer-storage-cloudinary/lib/index.js:108). So `file.path` is not a local
  // temp path — it is the URL of an asset that already exists in Cloudinary.
  //
  // This code then called `cloudinary.uploader.upload(files[i].path, ...)`,
  // which makes Cloudinary FETCH that URL and store a SECOND copy. Only the
  // second URL was saved, so the first was orphaned immediately — on every
  // image, on every product edit, permanently, in a paid account. That is
  // CLAUDE.md AB-10.
  //
  // Using file.path directly removes the duplicate upload entirely.
  const uploadedImages = (files || []).map((file, i) => ({
    image_url: file.path,
    is_primary_image: i === 0 ? 1 : 0
  }));

  // The URLs being replaced, captured BEFORE the transaction deletes their
  // rows. Needed to delete the remote assets afterwards — once the rows are
  // gone there is no record of what those files were.
  let replacedUrls = [];
  if (uploadedImages.length > 0) {
    try {
      const existing = await dbCmds.getImagesByProductId(productData.id);
      replacedUrls = (existing || []).map((row) => row.image_url).filter(Boolean);
    } catch (err) {
      // Not fatal: failing to LIST the old images must not block the update.
      // The consequence is orphans, which is exactly the status quo ante.
      console.error("Could not list existing images for cleanup:", sanitizeError(err));
    }
  }

  // Details, stock and images are ONE unit.
  //
  // The image swap is delete-then-insert. Without a transaction, a failure on
  // the insert left the product with NO images at all and nothing to restore —
  // the old rows were already gone from the database, and the original assets
  // were orphaned remotely with no way to find them again. Genuinely
  // unrecoverable. See CLAUDE.md AB-14b.
  await withTransaction(async (conn) => {
    // 0 rows means the product does not exist, or has been soft-deleted. The
    // query carries `AND is_deleted = 0` so editing a deleted product can no
    // longer silently resurrect it. Fail loudly rather than reporting a success
    // that never happened. See CLAUDE.md AB-12s.
    const updated = await dbCmds.updateProduct(productData, conn);
    if (updated === 0) {
      const err = new Error('Product not found, or it has been deleted.');
      err.statusCode = 404;
      throw err;
    }

    // Stock uses compare-and-swap so a concurrent admin edit cannot be silently
    // discarded. expected_stock_qty is what the form showed when it loaded.
    // See CLAUDE.md AB-15b.
    if (productData.stock_qty !== undefined) {
      if (productData.expected_stock_qty === undefined) {
        // Fail loudly rather than falling back to a blind overwrite — a silent
        // fallback would reintroduce exactly the bug this replaces.
        const err = new Error('expected_stock_qty is required when changing stock.');
        err.statusCode = 400;
        throw err;
      }

      const applied = await dbCmds.updateProductStockCAS(
        productData.id,
        productData.stock_qty,
        productData.expected_stock_qty,
        conn
      );

      if (applied === 0) {
        const err = new Error(
          'Stock was changed by someone else while you were editing. Reload and try again.'
        );
        err.statusCode = 409;
        throw err;
      }
    }

    if (uploadedImages.length > 0) {
      await dbCmds.deleteImagesByProductId(productData.id, conn);
      await dbCmds.insertImages(productData.id, uploadedImages, conn);
    }
  });

  // Remote cleanup runs AFTER the transaction commits, deliberately.
  //
  // Inside the transaction, a later rollback would leave the database pointing
  // at images that had already been destroyed — unrecoverable. Running it after
  // means the worst case is an orphaned file, which is merely wasteful.
  // destroyImagesByUrl never throws for the same reason: a Cloudinary outage
  // must not fail an update the admin has already been told succeeded.
  // See CLAUDE.md AB-10.
  if (replacedUrls.length > 0) {
    const cleanup = await destroyImagesByUrl(replacedUrls);
    if (cleanup.failed > 0) {
      console.error(
        `Image cleanup for product ${productData.id}: ${cleanup.deleted} deleted, ${cleanup.failed} orphaned`
      );
    }
  }

  return true;
};

const getCategoryWiseCount = async () => {
    return await dbCmds.getCategoryWiseCount();
};

const getAllProductDetails = async () => {
  const rows = await dbCmds.getAllProductDetails();

  const productMap = {};

  rows.forEach(row => {
    // Create product once
    if (!productMap[row.product_id]) {
      productMap[row.product_id] = {
        product_id: row.product_id,
        name: row.name,
        description: row.description,
        category: row.category,
        collection: row.collection,
        material: row.material,
        product_code: row.product_code,
        product_wash_care: row.product_wash_care,
        regular_price: row.regular_price,
        selling_price: row.selling_price,
        saree_length: row.saree_length,
        is_new_release: row.is_new_release,
        stock_qty: row.stock_qty,
        created_at: row.created_at,
        updated_at: row.updated_at,
        images: []
      };
    }

    if (row.image_url) {
      productMap[row.product_id].images.push({
        image_id: row.image_id,
        image_url: row.image_url,
        is_primary_image: row.is_primary_image
      });
    }
  });

  return Object.values(productMap);
};


// REMOVED: updateImages.
//
// It was dead — its only caller was adminController.updateProductImages, whose
// route is commented out in adminRoutes.js — and it carried the SAME double
// upload as updateProduct: cloudinary.uploader.upload(files[i].path) where
// file.path is already a Cloudinary URL. It also deleted the old image rows
// with no attempt to delete the remote assets.
//
// Deleted rather than fixed. Leaving a working-looking image-replacement
// helper in place is precisely how the bug comes back: someone uncomments that
// route line, and every edit starts orphaning two assets again. Image
// replacement lives in updateProduct, which uploads once and cleans up after
// itself. See CLAUDE.md AB-10, AB-30.

const insertImages = async (product_id, images) => {
  if (!product_id) {
    throw new Error("Product ID is required");
  }

  if (!Array.isArray(images) || images.length === 0) {
    throw new Error("Images array is required");
  }

  return await dbCmds.insertImages(product_id, images);
};

const deleteProduct = async (productId) => {
    // Check if product exists or perform other logic if needed
    const result = await dbCmds.deleteProduct(productId);
    
    if (result.affectedRows === 0) {
        throw new Error("Product not found or already deleted");
    }

    return result;
};


const getAllCategories = async () => {
  try {
    // Call the database command
    const categories = await dbCmds.getAllCategories();
    
    // Return the result to the controller
    return categories; 
  } catch (err) {
    console.error("Error in productManager.getAllCategories:", sanitizeError(err));
    throw err;
  }
};

const addCategory = async (name) => {
  try {
    return await dbCmds.addCategory(name);
  } catch (err) {
    throw err;
  }
};

const deleteCategoryById = async (categoryId) => {
  try {
    return await dbCmds.deleteCategoryById(categoryId);
  } catch (err) {
    throw err;
  }
};

// --- Category deletion cascade (AB-31 / DB-06) ---------------------------

const getCategoryNameById = async (categoryId) =>
  dbCmds.getCategoryNameById(categoryId);

const countProductsInCategory = async (categoryName) =>
  dbCmds.countProductsInCategory(categoryName);

/** Category + its products, soft-deleted together in one transaction. */
const deleteCategoryWithProducts = async (categoryId, categoryName) =>
  dbCmds.deleteCategoryWithProducts(categoryId, categoryName);

/** Set a category's tile image; returns { affectedRows, previousUrl }. CF-35. */
const updateCategoryImage = async (categoryId, imageUrl) =>
  dbCmds.updateCategoryImage(categoryId, imageUrl);

module.exports = {
    getCategoryNameById,
    countProductsInCategory,
    deleteCategoryWithProducts,
    updateCategoryImage,
    createProduct,
    getCategoryWiseCount,
    getAllProductDetails,
    updateProduct,
    insertImages,
    deleteProduct, 
    addCategory,
    deleteCategoryById,
    getAllCategories
};
