const cloudinary = require('cloudinary').v2;

const isConfigured = 
  process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_CLOUD_NAME !== 'mock_cloud' &&
  process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_KEY !== 'mock_key' &&
  process.env.CLOUDINARY_API_SECRET && process.env.CLOUDINARY_API_SECRET !== 'mock_secret';

if (isConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
} else {
  console.log('Cloudinary not fully configured. Using mock local asset upload fallback.');
}

const uploadToCloudinary = async (base64Data, filename) => {
  if (!isConfigured) {
    // Mock save: return the base64Data or a simulated URL
    return {
      secure_url: base64Data.startsWith('data:') ? base64Data : `data:image/png;base64,${base64Data}`,
      public_id: `mock_${Date.now()}_${filename}`
    };
  }

  try {
    // base64Data can be a data URI: data:image/png;base64,iVBOR...
    const uploadResponse = await cloudinary.uploader.upload(base64Data, {
      folder: 'aircanvas',
      public_id: filename,
      resource_type: 'image'
    });
    return uploadResponse;
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw error;
  }
};

module.exports = {
  cloudinary,
  uploadToCloudinary
};
