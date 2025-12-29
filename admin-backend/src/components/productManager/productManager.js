const dbCmds = require('../../dbOps/adminDbOps');
const cloudinary = require('../../config/cloudinary');





const createProduct = async (productData) => {
    
    if (!productData.name || !productData.regular_price) {
        throw new Error("Product name and regular price are required");
    }

    const productId = await dbCmds.createProduct(productData);

    

    // 2️⃣ Insert stock
    const stockQty = productData.stock_qty ?? 0;
    await dbCmds.insertProductStock(productId, stockQty);

    return productId;
};


const updateProduct = async (productData, files = []) => {
  if (!productData.id) {
    throw new Error("Product ID is required");
  }

  // 1️⃣ Update product basic details
  await dbCmds.updateProduct(productData);

  // 2️⃣ Update stock_qty (if provided) — always, not just when images exist
  if (productData.stock_qty !== undefined) {
    await dbCmds.updateProductStock(productData.id, productData.stock_qty);
  }

  // 2️⃣ If images are provided → update images
  if (files && files.length > 0) {
    const uploadedImages = [];

    for (let i = 0; i < files.length; i++) {
      const uploaded = await cloudinary.uploader.upload(files[i].path, {
        folder: `products/${productData.id}`,
      });

      uploadedImages.push({
        image_url: uploaded.secure_url,
        is_primary_image: i === 0 ? 1 : 0
      });
    }

    // Delete old images
    await dbCmds.deleteImagesByProductId(productData.id);

    // Insert new images
    await dbCmds.insertImages(productData.id, uploadedImages);
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






module.exports = {
    createProduct,
    getCategoryWiseCount,
    getAllProductDetails,
    updateProduct,
    updateImages,
    insertImages,
    
};
