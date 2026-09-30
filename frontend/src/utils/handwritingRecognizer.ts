import { createWorker } from 'tesseract.js';

// Convert handwritten drawings on canvas to text using Tesseract.js client-side OCR
export const recognizeHandwriting = async (
  canvasElement: HTMLCanvasElement,
  cropArea?: { x: number; y: number; width: number; height: number }
): Promise<string> => {
  let imageSource: string | HTMLCanvasElement = canvasElement;

  // If a specific selection area is cropped, extract that region to process
  if (cropArea && cropArea.width > 0 && cropArea.height > 0) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = cropArea.width;
    tempCanvas.height = cropArea.height;
    const tempCtx = tempCanvas.getContext('2d');
    
    if (tempCtx) {
      tempCtx.drawImage(
        canvasElement,
        cropArea.x,
        cropArea.y,
        cropArea.width,
        cropArea.height,
        0,
        0,
        cropArea.width,
        cropArea.height
      );
      imageSource = tempCanvas;
    }
  }

  try {
    // Create OCR worker (client-side, dynamic loading from unpkg CDN)
    const worker = await createWorker('eng');
    
    // Perform recognition
    const { data: { text } } = await worker.recognize(imageSource);
    
    // Terminate worker
    await worker.terminate();
    
    return text.trim();
  } catch (error) {
    console.error('Handwriting Recognition Error:', error);
    throw new Error('OCR failed to identify text.');
  }
};
