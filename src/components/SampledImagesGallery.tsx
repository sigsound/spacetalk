"use client";

import { useState } from "react";
import { SampledImagesData, SampledImage } from "@/lib/types";

interface SampledImagesGalleryProps {
  data: SampledImagesData;
}

function ImageThumbnail({ 
  image, 
  onClick 
}: { 
  image: SampledImage; 
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="relative group aspect-square rounded-lg overflow-hidden bg-surface hover:ring-2 hover:ring-accent transition-all"
      title={`Image ${image.index}: ${image.filename}`}
    >
      <img
        src={image.url}
        alt={`Image ${image.index} from ${image.room}`}
        className="w-full h-full object-cover"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <span className="text-white text-xs font-medium">#{image.index}</span>
      </div>
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1">
        <span className="text-white text-[10px] truncate block">#{image.index}</span>
      </div>
    </button>
  );
}

function ImageModal({
  image,
  onClose,
  onPrev,
  onNext,
  hasPrev,
  hasNext
}: {
  image: SampledImage;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}) {
  return (
    <div 
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="relative max-w-5xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-2 text-white">
          <div>
            <span className="text-accent font-medium">Image {image.index}</span>
            <span className="text-muted mx-2">•</span>
            <span className="text-muted">{image.room}</span>
            <span className="text-muted mx-2">•</span>
            <span className="text-muted-fg text-sm">{image.filename}</span>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Image */}
        <div className="relative flex-1 min-h-0">
          <img
            src={image.url}
            alt={`Image ${image.index} from ${image.room}`}
            className="max-w-full max-h-[80vh] object-contain mx-auto rounded-lg"
          />
          
          {/* Navigation arrows */}
          {hasPrev && (
            <button
              onClick={onPrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 rounded-full transition-colors"
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          {hasNext && (
            <button
              onClick={onNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 rounded-full transition-colors"
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function RoomSection({
  roomName,
  images,
  onImageClick
}: {
  roomName: string;
  images: SampledImage[];
  onImageClick: (image: SampledImage) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 bg-card hover:bg-card-hover transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-foreground font-medium">{roomName}</span>
          <span className="text-muted-fg text-sm">({images.length} images)</span>
        </div>
        <svg 
          className={`w-5 h-5 text-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {isExpanded && (
        <div className="p-3 grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 bg-background">
          {images.map(image => (
            <ImageThumbnail
              key={image.index}
              image={image}
              onClick={() => onImageClick(image)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function SampledImagesGallery({ data }: SampledImagesGalleryProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedImage, setSelectedImage] = useState<SampledImage | null>(null);

  // Flatten all images for navigation
  const allImages = data.spaces.flatMap(s => s.sampledImages);

  const handlePrevImage = () => {
    if (!selectedImage) return;
    const currentIdx = allImages.findIndex(img => img.index === selectedImage.index);
    if (currentIdx > 0) {
      setSelectedImage(allImages[currentIdx - 1]);
    }
  };

  const handleNextImage = () => {
    if (!selectedImage) return;
    const currentIdx = allImages.findIndex(img => img.index === selectedImage.index);
    if (currentIdx < allImages.length - 1) {
      setSelectedImage(allImages[currentIdx + 1]);
    }
  };

  const currentImageIdx = selectedImage 
    ? allImages.findIndex(img => img.index === selectedImage.index)
    : -1;

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card mb-4">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-card-hover transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="text-left">
            <h3 className="text-foreground font-medium">Reference Images</h3>
            <p className="text-muted-fg text-sm">
              {data.totalSampled} images sampled from {data.spaces.length} space{data.spaces.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted text-sm">
            {isExpanded ? 'Hide' : 'Show'} gallery
          </span>
          <svg 
            className={`w-5 h-5 text-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="border-t border-border p-4 space-y-4 max-h-[500px] overflow-y-auto">
          {data.spaces.map(space => (
            <div key={space.spaceId} className="space-y-3">
              {data.spaces.length > 1 && (
                <h4 className="text-muted font-medium flex items-center gap-2">
                  <span>{space.spaceName}</span>
                  <span className="text-muted-fg text-sm font-normal">
                    ({space.sampledImages.length} of {space.totalImages} images)
                  </span>
                </h4>
              )}
              
              {Object.entries(space.byRoom)
                .sort(([, a], [, b]) => b.length - a.length)
                .map(([roomName, images]) => (
                  <RoomSection
                    key={`${space.spaceId}-${roomName}`}
                    roomName={roomName}
                    images={images}
                    onImageClick={setSelectedImage}
                  />
                ))
              }
            </div>
          ))}
        </div>
      )}

      {/* Image Modal */}
      {selectedImage && (
        <ImageModal
          image={selectedImage}
          onClose={() => setSelectedImage(null)}
          onPrev={handlePrevImage}
          onNext={handleNextImage}
          hasPrev={currentImageIdx > 0}
          hasNext={currentImageIdx < allImages.length - 1}
        />
      )}
    </div>
  );
}
