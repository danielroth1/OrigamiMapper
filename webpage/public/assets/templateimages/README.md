# Template Images

This directory contains template images that are displayed in the Template Images gallery on the website.

## Structure

- `images.json` - Configuration file that defines groups and images
- Template image files (PNG, JPG, etc.)

## Adding New Template Images

1. **Add your image files** to this directory (`/webpage/public/assets/templateimages/`)

2. **Update images.json** to include your new images:

```json
{
  "groups": [
    {
      "id": "unique-group-id",
      "name": "Display Name for Group",
      "images": [
        {
          "id": "unique-image-id",
          "filename": "your-image-file.png",
          "title": "Image Title",
          "description": "Brief description of the template"
        }
      ]
    }
  ]
}
```

## Example

```json
{
  "groups": [
    {
      "id": "boxes",
      "name": "Box Templates",
      "images": [
        {
          "id": "box1",
          "filename": "box-template-1.png",
          "title": "Simple Box Template",
          "description": "A basic cube box template"
        }
      ]
    }
  ]
}
```

## Features

- **Lazy Loading**: Images are loaded only when they come into view
- **Grouping**: Organize images by category for easy filtering
- **Download**: Each image has a download button
- **Mobile-First**: Responsive design optimized for mobile devices
- **Search/Filter**: Users can filter by group category

## Image Guidelines

- **Format**: PNG or JPG recommended
- **Resolution**: High resolution for print quality (300 DPI recommended)
- **Size**: Keep file sizes reasonable (< 5MB per image)
- **Naming**: Use descriptive, URL-friendly filenames (lowercase, hyphens instead of spaces)

## Group IDs

Choose meaningful group IDs like:
- `boxes` - Box templates
- `cards` - Card templates
- `origami` - Origami patterns
- `envelopes` - Envelope templates
- etc.
