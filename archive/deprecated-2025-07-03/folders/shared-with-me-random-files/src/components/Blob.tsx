import React from 'react';

    interface BlobProps {
      size: number; // Diameter of the blob
      color: string;
      position: { x: number; y: number }; // Position relative to the center of the container
      onMouseDown: (event: React.MouseEvent) => void;
    }

    const Blob: React.FC<BlobProps> = ({ size, color, position, onMouseDown }) => {
      return (
        <div
          className="absolute rounded-full cursor-grab active:cursor-grabbing"
          style={{
            width: `${size}px`,
            height: `${size}px`,
            backgroundColor: color,
            transform: `translate(${position.x}px, ${position.y}px)`,
            filter: 'blur(10px)', // Make it look blob-like
            zIndex: 1, // Ensure blobs are above the background
            // Position the blob relative to the center of its container
            left: '50%',
            top: '50%',
            marginLeft: `-${size / 2}px`, // Adjust for the blob's size to center it
            marginTop: `-${size / 2}px`, // Adjust for the blob's size to center it
          }}
          onMouseDown={onMouseDown}
        ></div>
      );
    };

    export default Blob;
