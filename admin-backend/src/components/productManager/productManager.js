const dbCmds = require('../../dbOps/adminDbOps');

const createProduct = async (productData) => {
    
    if (!productData.name || !productData.regular_price) {
        throw new Error("Product name and regular price are required");
    }

    const productId = await dbCmds.createProduct(productData);

    return productId;
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


const updateProduct = async (productData) => {
    // validate mandatory fields
    if (!productData.id || !productData.name || !productData.regular_price) {
        throw new Error("Product id, name and regular price are required");
    }
    return await dbCmds.updateProduct(productData);
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

const updateProductImage = async ({ image_id, image_url, is_primary_image }) => {
  if (!image_id) {
    throw new Error("image_id is required");
  }

  if (is_primary_image === 1) {
    await dbCmds.resetPrimaryImageByImageId(image_id);
  }

  return await dbCmds.updateProductImage(
    image_id,
    image_url,
    is_primary_image
  );
};

module.exports = {
    createProduct,
    getCategoryWiseCount,
    getAllProductDetails,
    updateProduct,
    insertImages,
    updateProductImage
};
