/**
 * Compress an image file client-side using HTML5 Canvas.
 * Resizes the image to fit within maxWidth/maxHeight and compresses it to JPEG format.
 * 
 * @param {File} file - The uploaded image file.
 * @param {number} maxWidth - Maximum width of the compressed image.
 * @param {number} maxHeight - Maximum height of the compressed image.
 * @param {number} quality - Compression quality (0.0 to 1.0).
 * @returns {Promise<string>} - Resolves to the compressed base64 Data URL.
 */
export const compressImage = (file, maxWidth = 800, maxHeight = 800, quality = 0.7) => {
  return new Promise((resolve, reject) => {
    // Verify it is an image
    if (!file.type.startsWith('image/')) {
      reject(new Error('El archivo seleccionado no es una imagen válida.'));
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions keeping aspect ratio
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('No se pudo obtener el contexto del Canvas.'));
          return;
        }

        // Draw image on canvas (performs resizing)
        ctx.drawImage(img, 0, 0, width, height);

        // Export to JPEG with quality compression
        try {
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedDataUrl);
        } catch (err) {
          reject(err);
        }
      };
      
      img.onerror = (err) => reject(new Error('Error al cargar la imagen en memoria.'));
    };
    
    reader.onerror = (err) => reject(new Error('Error al leer el archivo.'));
  });
};
