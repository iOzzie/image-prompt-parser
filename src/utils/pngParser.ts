export interface ParsedMetadata {
  [key: string]: any;
}

export const extractPngMetadata = async (file: File): Promise<ParsedMetadata> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      if (!buffer) return reject(new Error("Failed to read file"));
      
      const view = new DataView(buffer);
      // Check PNG signature: 89 50 4E 47 0D 0A 1A 0A
      if (
        view.getUint32(0) !== 0x89504E47 ||
        view.getUint32(4) !== 0x0D0A1A0A
      ) {
        return reject(new Error("Not a valid PNG file. Please upload a PNG image."));
      }

      let offset = 8;
      const metadata: ParsedMetadata = {};
      const decoder = new TextDecoder('utf-8');

      while (offset < view.byteLength) {
        const length = view.getUint32(offset);
        const type = String.fromCharCode(
          view.getUint8(offset + 4),
          view.getUint8(offset + 5),
          view.getUint8(offset + 6),
          view.getUint8(offset + 7)
        );

        if (type === 'IEND') break;

        const dataOffset = offset + 8;
        
        if (type === 'tEXt') {
          const chunkData = new Uint8Array(buffer, dataOffset, length);
          const nullIndex = chunkData.indexOf(0);
          if (nullIndex !== -1) {
            const keyword = decoder.decode(chunkData.slice(0, nullIndex));
            const text = decoder.decode(chunkData.slice(nullIndex + 1));
            try {
              metadata[keyword] = JSON.parse(text);
            } catch (err) {
              metadata[keyword] = text;
            }
          }
        } else if (type === 'iTXt') {
          const chunkData = new Uint8Array(buffer, dataOffset, length);
          let nullIndex = chunkData.indexOf(0);
          if (nullIndex !== -1) {
            const keyword = decoder.decode(chunkData.slice(0, nullIndex));
            const compressionFlag = chunkData[nullIndex + 1];
            
            let textOffset = nullIndex + 3;
            while(chunkData[textOffset] !== 0 && textOffset < chunkData.length) textOffset++;
            textOffset++;
            while(chunkData[textOffset] !== 0 && textOffset < chunkData.length) textOffset++;
            textOffset++;

            if (textOffset < chunkData.length) {
              if (compressionFlag === 0) {
                 const text = decoder.decode(chunkData.slice(textOffset));
                 try {
                   metadata[keyword] = JSON.parse(text);
                 } catch (err) {
                   metadata[keyword] = text;
                 }
              } else {
                 metadata[keyword] = "[Compressed iTXt text - currently unsupported]";
              }
            }
          }
        }
        
        // length(4) + type(4) + data(length) + crc(4)
        offset += 8 + length + 4;
      }

      resolve(metadata);
    };
    reader.onerror = () => reject(new Error("Error reading file"));
    reader.readAsArrayBuffer(file);
  });
};
