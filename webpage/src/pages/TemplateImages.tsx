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
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    // Load the images.json file
    const loadImages = async () => {
      try {
        const response = await fetch('/origami-mapper/assets/templateimages/images.json');
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

  const handleImageLoad = (element: HTMLImageElement | null) => {
    if (element && observerRef.current) {
      observerRef.current.observe(element);
    }
  };

  const handleDownload = (filename: string) => {
    const link = document.createElement('a');
    link.href = `/origami-mapper/assets/templateimages/${filename}`;
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
            <div key={`${group.id}-${image.id}`} className="image-card">
              <div className="image-wrapper">
                <img
                  ref={handleImageLoad}
                  data-src={`/origami-mapper/assets/templateimages/${image.filename}`}
                  alt={image.title}
                  className="lazy-image"
                />
                <div className="image-overlay">
                  <button
                    className="download-btn"
                    onClick={() => handleDownload(image.filename)}
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
  );
};

export default TemplateImages;
