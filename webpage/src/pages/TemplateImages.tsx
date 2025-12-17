import React, { useState, useEffect, useRef } from 'react';
import './TemplateImages.css';

interface ImageData {
  id: string;
  filename: string;
  title: string;
  description: string;
}

interface ImageGroup {
  id: string;
  name: string;
  images: ImageData[];
}

interface TemplateImagesData {
  groups: ImageGroup[];
}

const TemplateImages: React.FC = () => {
  const [data, setData] = useState<TemplateImagesData | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<{ group: ImageGroup; image: ImageData } | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const scrollYRef = useRef<number>(0);

  useEffect(() => {
    // Load the images.json file
    const loadImages = async () => {
      try {
        const base = (import.meta as any).env?.BASE_URL ?? '/';
        const response = await fetch(`${base}assets/templateimages/images.json`);
        if (!response.ok) {
          throw new Error('Failed to load template images data');
        }
        const jsonData: TemplateImagesData = await response.json();
        setData(jsonData);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        setLoading(false);
      }
    };

    loadImages();
  }, []);

  useEffect(() => {
    // Set up Intersection Observer for lazy loading
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement;
            const src = img.dataset.src;
            if (src) {
              img.src = src;
              img.classList.add('loaded');
              observerRef.current?.unobserve(img);
            }
          }
        });
      },
      {
        rootMargin: '50px',
      }
    );

    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  // Handle modal scroll lock
  useEffect(() => {
    if (selectedImage) {
      scrollYRef.current = window.scrollY;
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollYRef.current}px`;
      document.body.style.width = '100%';
    } else {
      document.body.style.overflow = 'unset';
      document.body.style.position = 'unset';
      document.body.style.top = 'unset';
      document.body.style.width = 'unset';
      window.scrollTo(0, scrollYRef.current);
    }

    return () => {
      document.body.style.overflow = 'unset';
      document.body.style.position = 'unset';
      document.body.style.top = 'unset';
      document.body.style.width = 'unset';
      window.scrollTo(0, scrollYRef.current);
    };
  }, [selectedImage]);

  const handleImageLoad = (element: HTMLImageElement | null) => {
    if (element && observerRef.current) {
      observerRef.current.observe(element);
    }
  };

  const handleDownload = (filename: string) => {
    const base = (import.meta as any).env?.BASE_URL ?? '/';
    const link = document.createElement('a');
    link.href = `${base}assets/templateimages/${filename}`;
    link.download = filename;
    link.click();
  };

  const getFilteredImages = (): { group: ImageGroup; image: ImageData }[] => {
    if (!data) return [];

    const allImages: { group: ImageGroup; image: ImageData }[] = [];
    
    data.groups.forEach((group) => {
      if (selectedGroup === 'all' || selectedGroup === group.id) {
        group.images.forEach((image) => {
          allImages.push({ group, image });
        });
      }
    });

    return allImages;
  };

  const closeModal = () => {
    setSelectedImage(null);
  };

  const handleBackgroundClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      closeModal();
    }
  };

  const navigateImage = (direction: 'prev' | 'next') => {
    const filteredImages = getFilteredImages();
    const currentIndex = filteredImages.findIndex(
      (item) => item.image.id === selectedImage?.image.id
    );

    if (currentIndex === -1) return;

    let nextIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;

    // Wrap around
    if (nextIndex < 0) nextIndex = filteredImages.length - 1;
    if (nextIndex >= filteredImages.length) nextIndex = 0;

    setSelectedImage(filteredImages[nextIndex]);
  };

  if (loading) {
    return (
      <div className="content-container template-images-page">
        <h1>Template Images</h1>
        <div className="loading-spinner">Loading template images...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="content-container template-images-page">
        <h1>Template Images</h1>
        <div className="error-message">
          <p>Error: {error}</p>
          <p>Please make sure the images.json file exists in /public/assets/templateimages/</p>
        </div>
      </div>
    );
  }

  const filteredImages = getFilteredImages();

  return (
    <>
      <div className="content-container template-images-page">
        <h1>Template Images</h1>
        <p className="page-description">
          Browse and download printable templates for origami projects, boxes, and card designs.
        </p>

        {/* Group Filter */}
        <div className="group-filter">
        <button
          className={`filter-btn ${selectedGroup === 'all' ? 'active' : ''}`}
          onClick={() => setSelectedGroup('all')}
        >
          All Templates
        </button>
        {data?.groups.map((group) => (
          <button
            key={group.id}
            className={`filter-btn ${selectedGroup === group.id ? 'active' : ''}`}
            onClick={() => setSelectedGroup(group.id)}
          >
            {group.name}
          </button>
        ))}
      </div>

      {/* Image Gallery */}
      <div className="image-gallery">
        {filteredImages.length === 0 ? (
          <div className="no-images">
            <p>No template images available in this category.</p>
          </div>
        ) : (
          filteredImages.map(({ group, image }) => (
            <div 
              key={`${group.id}-${image.id}`} 
              className="image-card"
              onClick={() => setSelectedImage({ group, image })}
            >
              <div className="image-wrapper">
                <img
                  ref={handleImageLoad}
                  data-src={`${(import.meta as any).env?.BASE_URL ?? '/'}assets/templateimages/${image.filename}`}
                  alt={image.title}
                  className="lazy-image"
                />
                <div className="image-overlay">
                  <button
                    className="download-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload(image.filename);
                    }}
                    aria-label={`Download ${image.title}`}
                  >
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Download
                  </button>
                </div>
              </div>
              <div className="image-info">
                <h3 className="image-title">{image.title}</h3>
                <p className="image-description">{image.description}</p>
                <span className="image-category">{group.name}</span>
              </div>
            </div>
          ))
        )}
      </div>
      </div>

      {/* Modal for zoomed image */}
      {selectedImage && (
        <div className="image-modal-backdrop" onClick={handleBackgroundClick}>
          {/* Close Button */}
          <button 
            className="modal-close-btn"
            onClick={closeModal}
            aria-label="Close image"
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          <div className="image-modal-content">
            {/* Left Slider Button */}
            <button
              className="modal-nav-btn modal-nav-btn--left"
              onClick={() => navigateImage('prev')}
              aria-label="Previous image"
            >
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            {/* Image */}
            <img
              src={`${(import.meta as any).env?.BASE_URL ?? '/'}assets/templateimages/${selectedImage.image.filename}`}
              alt={selectedImage.image.title}
              className="modal-image"
            />

            {/* Right Slider Button */}
            <button
              className="modal-nav-btn modal-nav-btn--right"
              onClick={() => navigateImage('next')}
              aria-label="Next image"
            >
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>

            {/* Info and Download */}
            <div className="modal-info">
              <h2>{selectedImage.image.title}</h2>
              <p>{selectedImage.image.description}</p>
              <div className="modal-download-link-wrapper">
                <a
                  href={`${(import.meta as any).env?.BASE_URL ?? '/'}assets/templateimages/${selectedImage.image.filename}`}
                  download={selectedImage.image.filename}
                  className="modal-download-link"
                  aria-label={`Download ${selectedImage.image.title}`}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Download Template
                </a>
                <div className="download-info-tooltip">Click to download this template image</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TemplateImages;
