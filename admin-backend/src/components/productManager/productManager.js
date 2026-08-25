const dbCmds = require('../../dbOps/adminDbOps');
const cloudinary = require('../../config/cloudinary');
const { sanitizeError } = require('../../utils/safeError');
const { withTransaction } = require('../../dbOps/withTransaction');





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

  // Uploads happen BEFORE the transaction opens, deliberately.
  //
  // A rollback undoes database work only — an uploaded asset cannot be
  // un-uploaded, and nothing in this codebase ever deletes a remote one
  // (AB-10, and the same will be true of S3). Doing the slow network work
  // outside the transaction also keeps it short: a long transaction holds one
  // of only 10 pool connections and locks the rows it has touched.
  const uploadedImages = [];
  if (files && files.length > 0) {
    for (let i = 0; i < files.length; i++) {
      const uploaded = await cloudinary.uploader.upload(files[i].path, {
        folder: `products/${productData.id}`,
      });

      uploadedImages.push({
        image_url: uploaded.secure_url,
        is_primary_image: i === 0 ? 1 : 0
      });
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


const updateImages = async (product_id, files, insertImagesFn) => {
    if (!product_id) throw new Error("Product ID is required");
    if (!files || files.length === 0) return [];

    const uploadedImages = [];

    // Upload each file to Cloudinary
    for (let i = 0; i < files.length; i++) {
        const uploaded = await cloudinary.uploader.upload(files[i].path, {
            folder: `products/${product_id}`,
        });
        uploadedImages.push({
            image_url: uploaded.secure_url,
            is_primary_image: i === 0 ? 1 : 0
        });
    }

    // Delete old images
    await dbCmds.deleteImagesByProductId(product_id);

    // Insert new images using your existing insertImages API
    await insertImagesFn(product_id, uploadedImages);

    return uploadedImages;
};



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

module.exports = {
    createProduct,
    getCategoryWiseCount,
    getAllProductDetails,
    updateProduct,
    updateImages,
    insertImages,
    deleteProduct, 
    addCategory,
    deleteCategoryById,
    getAllCategories
};
