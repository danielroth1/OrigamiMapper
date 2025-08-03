import io
import base64
from PIL import Image
import json
import math
import numpy as np
from PIL import ImageDraw, ImageFont
from skimage.draw import polygon as sk_polygon

A4_SIZE_PX = (1654, 2339)  # 210x297mm at 200 DPI

class Polygon2D:
    def __init__(self, poly_id, vertices, image_idx=0, rotation=0):
        self.id = poly_id
        self.vertices = vertices  # List of (x, y) tuples, relative (0-1)
        self.image_idx = image_idx  # 0 or 1
        self.rotation = rotation    # degrees

    def absolute(self, width, height):
        return [(x * width, y * height) for x, y in self.vertices]

def load_json(data):
    offset = tuple(data['offset'])
    input_polys = [Polygon2D(p['id'], p['vertices'], p.get('input_image', 0)) for p in data['input_polygons']]
    output_polys = [
        Polygon2D(
            p['id'],
            p['vertices'],
            p.get('output_image', 0),
            p.get('rotation', 0)
        ) for p in data['output_polygons']
    ]
    return offset, input_polys, output_polys

def rotate_points(points, angle_deg, origin):
    """Rotate a list of (x, y) points by angle_deg around origin (x0, y0)."""
    angle_rad = math.radians(angle_deg)
    cos_a = math.cos(angle_rad)
    sin_a = math.sin(angle_rad)
    ox, oy = origin
    rotated = []
    for x, y in points:
        tx, ty = x - ox, y - oy
        rx = tx * cos_a - ty * sin_a + ox
        ry = tx * sin_a + ty * cos_a + oy
        rotated.append((rx, ry))
    return rotated

def draw_polygons(image, polygons, color=(255,0,0,255), fill=None, width=4, offset=(0,0), fill_alpha=0.2, show_id=True):
    w, h = image.size
    # Try to load a scalable font, fallback to default
    font = None
    for font_name in ["Arial.ttf", "LiberationSans-Regular.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]:
        try:
            font = ImageFont.truetype(font_name, int(10 * 6))
            break
        except Exception:
            continue
    if font is None:
        font = ImageFont.load_default()
        print("Warning: Could not load a scalable font, using default font. Text rendering may not scale well.")

    # Set font color based on outline color (red or blue)
    font_color = (255, 0, 0, 255) if color[:3] == (255, 0, 0) else (0, 0, 255, 255)

    for poly in polygons:
        abs_pts = poly.absolute(w, h)
        abs_pts = [(x + offset[0], y + offset[1]) for x, y in abs_pts]
        # Fill polygon with specified alpha if requested
        if fill is not None:
            overlay = Image.new('RGBA', image.size, (0,0,0,0))
            overlay_draw = ImageDraw.Draw(overlay, 'RGBA')
            fill_color = fill if isinstance(fill, tuple) else (color[0], color[1], color[2], int(255 * fill_alpha))
            overlay_draw.polygon(abs_pts, fill=fill_color)
            image.alpha_composite(overlay)
        draw = ImageDraw.Draw(image, 'RGBA')
        draw.line(abs_pts + [abs_pts[0]], fill=color, width=width, joint="curve")
        # Render the id at the centroid
        if show_id:
            xs, ys = zip(*abs_pts)
            centroid = (sum(xs) / len(xs), sum(ys) / len(ys))
            draw.text(centroid, str(poly.id), fill=font_color, font=font)

def triangulate_polygon(vertices):
    """
    Simple ear clipping triangulation for convex polygons.
    Returns a list of triangles, each as a list of 3 points.
    Assumes vertices is a list of (x, y) tuples.
    """
    if len(vertices) < 3:
        return []
    if len(vertices) == 3:
        return [vertices]
    triangles = []
    idxs = list(range(len(vertices)))
    while len(idxs) > 3:
        found = False
        for i in range(len(idxs)):
            i0 = idxs[i % len(idxs)]
            i1 = idxs[(i + 1) % len(idxs)]
            i2 = idxs[(i + 2) % len(idxs)]
            v0, v1, v2 = vertices[i0], vertices[i1], vertices[i2]
            # Check if ear is convex
            ax, ay = v1[0] - v0[0], v1[1] - v0[1]
            bx, by = v2[0] - v1[0], v2[1] - v1[1]
            cross = ax * by - ay * bx
            if cross <= 0:
                continue  # Not convex
            # Check if any other point is inside the triangle
            ear = True
            for j in idxs:
                if j in (i0, i1, i2):
                    continue
                if point_in_triangle(vertices[j], v0, v1, v2):
                    ear = False
                    break
            if ear:
                triangles.append([v0, v1, v2])
                del idxs[(i + 1) % len(idxs)]
                found = True
                break
        if not found:
            # Fallback: just split sequentially (works for convex)
            for i in range(1, len(idxs) - 1):
                triangles.append([vertices[idxs[0]], vertices[idxs[i]], vertices[idxs[i + 1]]])
            break
    if len(idxs) == 3:
        triangles.append([vertices[idxs[0]], vertices[idxs[1]], vertices[idxs[2]]])
    return triangles

def point_in_triangle(p, a, b, c):
    # Barycentric technique
    px, py = p
    ax, ay = a
    bx, by = b
    cx, cy = c
    v0 = (cx - ax, cy - ay)
    v1 = (bx - ax, by - ay)
    v2 = (px - ax, py - ay)
    dot00 = v0[0]*v0[0] + v0[1]*v0[1]
    dot01 = v0[0]*v1[0] + v0[1]*v1[1]
    dot02 = v0[0]*v2[0] + v0[1]*v2[1]
    dot11 = v1[0]*v1[0] + v1[1]*v1[1]
    dot12 = v1[0]*v2[0] + v1[1]*v2[1]
    denom = dot00 * dot11 - dot01 * dot01
    if denom == 0:
        return False
    inv_denom = 1 / denom
    u = (dot11 * dot02 - dot01 * dot12) * inv_denom
    v = (dot00 * dot12 - dot01 * dot02) * inv_denom
    return (u >= 0) and (v >= 0) and (u + v < 1)

def map_polygon_pixels(src_img, src_poly, dst_img, dst_poly, offset=(0, 0)):
    src_w, src_h = src_img.size
    dst_w, dst_h = dst_img.size

    offset_x = int(offset[0] * src_w)
    offset_y = int(offset[1] * src_h)
    src_abs = np.array(src_poly.absolute(src_w, src_h), dtype=np.float32) + np.array([offset_x, offset_y], dtype=np.float32)
    dst_abs = np.array(dst_poly.absolute(dst_w, dst_h), dtype=np.float32)
    
    if len(src_abs) < 3 or len(dst_abs) < 3:
        return dst_img

    src_pixels = np.array(src_img)
    dst_img_np = np.array(dst_img)

    src_tris = triangulate_polygon(src_abs.tolist())
    dst_tris = triangulate_polygon(dst_abs.tolist())

    for src_tri, dst_tri in zip(src_tris, dst_tris):
        dst_tri_np = np.array(dst_tri)
        rr, cc = sk_polygon(dst_tri_np[:, 1], dst_tri_np[:, 0], dst_img_np.shape[:2])

        # Compute bounding box center of the destination triangle
        min_x, min_y = np.min(dst_tri_np, axis=0)
        max_x, max_y = np.max(dst_tri_np, axis=0)
        cx, cy = (min_x + max_x) / 2, (min_y + max_y) / 2

        # If rotation is set, rotate each (cc, rr) around (cx, cy) by -rotation degrees
        if getattr(dst_poly, "rotation", 0):
            angle_rad = -math.radians(dst_poly.rotation)
            cos_a = math.cos(angle_rad)
            sin_a = math.sin(angle_rad)
            x_shifted = cc - cx
            y_shifted = rr - cy
            cc_rot = cos_a * x_shifted - sin_a * y_shifted + cx
            rr_rot = sin_a * x_shifted + cos_a * y_shifted + cy
        else:
            cc_rot = cc
            rr_rot = rr

        # Compute barycentric coordinates for all (cc_rot, rr_rot) at once (vectorized)
        A = np.array([
            [dst_tri_np[0][0] - dst_tri_np[2][0], dst_tri_np[1][0] - dst_tri_np[2][0]],
            [dst_tri_np[0][1] - dst_tri_np[2][1], dst_tri_np[1][1] - dst_tri_np[2][1]]
        ])
        b = np.stack([cc_rot - dst_tri_np[2][0], rr_rot - dst_tri_np[2][1]], axis=1)  # shape (N, 2)
        try:
            invA = np.linalg.inv(A)
        except np.linalg.LinAlgError:
            continue  # skip degenerate triangles

        lambdas = b @ invA.T  # shape (N, 2)
        l1 = lambdas[:, 0]
        l2 = lambdas[:, 1]
        l3 = 1 - l1 - l2

        mask = (l1 >= 0) & (l1 <= 1) & (l2 >= 0) & (l2 <= 1) & (l3 >= 0) & (l3 <= 1)

        cc_masked = cc[mask]
        rr_masked = rr[mask]
        l1_masked = l1[mask]
        l2_masked = l2[mask]
        l3_masked = l3[mask]

        src_x = l1_masked * src_tri[0][0] + l2_masked * src_tri[1][0] + l3_masked * src_tri[2][0]
        src_y = l1_masked * src_tri[0][1] + l2_masked * src_tri[1][1] + l3_masked * src_tri[2][1]
        src_x_int = np.clip(np.round(src_x).astype(int), 0, src_w - 1)
        src_y_int = np.clip(np.round(src_y).astype(int), 0, src_h - 1)

        dst_img_np[rr_masked.astype(int), cc_masked.astype(int)] = src_pixels[src_y_int, src_x_int]
    return Image.fromarray(dst_img_np)

def main(input_img_path1, input_img_path2, output_img_path1, output_img_path2, interm_img_path1, interm_img_path2, json_path):
    offset, input_polys, output_polys = load_json(json_path)
    input_imgs = [
        Image.open(input_img_path1).convert('RGBA'),
        Image.open(input_img_path2).convert('RGBA')
    ]
    w = max(img.size[0] for img in input_imgs)
    h = max(img.size[1] for img in input_imgs)

    # Keep A4 aspect ratio, but ensure width and height are at least that of the input images
    a4_w, a4_h = A4_SIZE_PX
    aspect = a4_w / a4_h
    canvas_w, canvas_h = a4_w, a4_h
    if w > a4_w or h > a4_h:
        scale_w = w / a4_w
        scale_h = h / a4_h
        if scale_w > scale_h:
            canvas_w = w
            canvas_h = int(round(w / aspect))
            if canvas_h < h:
                canvas_h = h
        else:
            canvas_h = h
            canvas_w = int(round(h * aspect))
            if canvas_w < w:
                canvas_w = w

    # Uniformly scale input images to fit canvas, then extend to canvas size
    scaled_imgs = []
    for img in input_imgs:
        img_w, img_h = img.size
        scale = min(canvas_w / img_w, canvas_h / img_h)
        new_w = int(round(img_w * scale))
        new_h = int(round(img_h * scale))
        scaled_img = img.resize((new_w, new_h), Image.LANCZOS)
        # Create a new blank canvas and paste the scaled image centered
        extended_img = Image.new('RGBA', (canvas_w, canvas_h), (255,255,255,255))
        offset_x = 0
        offset_y = 0
        extended_img.paste(scaled_img, (offset_x, offset_y), scaled_img)
        scaled_imgs.append(extended_img)
    input_imgs = scaled_imgs

    # Create two intermediate images, one for each input image
    for idx, (img, interm_img_path, color) in enumerate([
        (input_imgs[0], interm_img_path1, (255,0,0,255)),
        (input_imgs[1], interm_img_path2, (0,0,255,255))
    ]):
        interm_img = Image.new('RGBA', (canvas_w, canvas_h), (255,255,255,255))
        interm_offset = (0, 0)
        interm_img.paste(img, interm_offset, img)
        draw_polygons(
            interm_img,
            [p for p in input_polys if p.image_idx == idx],
            color=color,
            fill=color[:3] + (int(255*0.2),),
            width=4,
            offset=(0,0),
            fill_alpha=0.2,
            show_id=True
        )
        if interm_img_path.lower().endswith(('.jpg', '.jpeg')):
            interm_img.convert('RGB').save(interm_img_path)
        else:
            interm_img.save(interm_img_path)

    # Output images
    output_imgs = [
        Image.new('RGBA', (canvas_w, canvas_h), (255,255,255,255)),
        Image.new('RGBA', (canvas_w, canvas_h), (255,255,255,255))
    ]
    input_poly_dict = {p.id: p for p in input_polys}
    output_poly_dict = {p.id: p for p in output_polys}
    for poly_id in input_poly_dict:
        if poly_id in output_poly_dict:
            src_poly = input_poly_dict[poly_id]
            dst_poly = output_poly_dict[poly_id]
            src_img = input_imgs[src_poly.image_idx]
            dst_img = output_imgs[dst_poly.image_idx]
            output_imgs[dst_poly.image_idx] = map_polygon_pixels(
                src_img, src_poly, dst_img, dst_poly, offset
            )
    # Save output images
    for idx, out_path in enumerate([output_img_path1, output_img_path2]):
        if out_path.lower().endswith(('.jpg', '.jpeg')):
            output_imgs[idx].convert('RGB').save(out_path)
        else:
            output_imgs[idx].save(out_path)

def run_mapping_from_data(outside_image_data, inside_image_data, template_json):
    outside_img = Image.open(io.BytesIO(base64.b64decode(outside_image_data.split(',')[1])))
    inside_img = Image.open(io.BytesIO(base64.b64decode(inside_image_data.split(',')[1])))
    data = json.loads(template_json)
    offset, input_polys, output_polys = load_json(data)
    input_imgs = [outside_img.convert('RGBA'), inside_img.convert('RGBA')]
    w = max(img.size[0] for img in input_imgs)
    h = max(img.size[1] for img in input_imgs)

    # Keep A4 aspect ratio, but ensure width and height are at least that of the input images
    a4_w, a4_h = A4_SIZE_PX
    aspect = a4_w / a4_h
    canvas_w, canvas_h = a4_w, a4_h
    if w > a4_w or h > a4_h:
        scale_w = w / a4_w
        scale_h = h / a4_h
        if scale_w > scale_h:
            canvas_w = w
            canvas_h = int(round(w / aspect))
            if canvas_h < h:
                canvas_h = h
        else:
            canvas_h = h
            canvas_w = int(round(h * aspect))
            if canvas_w < w:
                canvas_w = w

    # Uniformly scale input images to fit canvas, then extend to canvas size
    scaled_imgs = []
    for img in input_imgs:
        img_w, img_h = img.size
        scale = min(canvas_w / img_w, canvas_h / img_h)
        new_w = int(round(img_w * scale))
        new_h = int(round(img_h * scale))
        scaled_img = img.resize((new_w, new_h), Image.LANCZOS)
        # Create a new blank canvas and paste the scaled image centered
        extended_img = Image.new('RGBA', (canvas_w, canvas_h), (255,255,255,0))
        offset_x = 0
        offset_y = 0
        extended_img.paste(scaled_img, (offset_x, offset_y), scaled_img)
        scaled_imgs.append(extended_img)
    input_imgs = scaled_imgs

    # Create two intermediate images, one for each input image
    interm_imgs = [
        Image.new('RGBA', (canvas_w, canvas_h), (255,255,255,255)),
        Image.new('RGBA', (canvas_w, canvas_h), (255,255,255,255))
    ]
    for idx, (img, color) in enumerate([
        (input_imgs[0], (255,0,0,255)),
        (input_imgs[1], (0,0,255,255))
    ]):
        interm_img = Image.new('RGBA', (canvas_w, canvas_h), (255,255,255,0))
        interm_offset = (0, 0)
        interm_img.paste(img, interm_offset, img)
        draw_polygons(
            interm_img,
            [p for p in input_polys if p.image_idx == idx],
            color=color,
            fill=color[:3] + (int(255*0.2),),
            width=4,
            offset=(0,0),
            fill_alpha=0.2,
            show_id=True
        )
        interm_imgs[idx] = interm_img

    # Output images
    output_imgs = [
        Image.new('RGBA', (canvas_w, canvas_h), (255,255,255,255)),
        Image.new('RGBA', (canvas_w, canvas_h), (255,255,255,255))
    ]
    input_poly_dict = {p.id: p for p in input_polys}
    output_poly_dict = {p.id: p for p in output_polys}
    for poly_id in input_poly_dict:
        if poly_id in output_poly_dict:
            src_poly = input_poly_dict[poly_id]
            dst_poly = output_poly_dict[poly_id]
            src_img = input_imgs[src_poly.image_idx]
            dst_img = output_imgs[dst_poly.image_idx]
            output_imgs[dst_poly.image_idx] = map_polygon_pixels(
                src_img, src_poly, dst_img, dst_poly, offset
            )

    # Convert output images to base64
    def img_to_b64(img):
        buf = io.BytesIO()
        img.save(buf, format='PNG')
        return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()

    results = {
        'output_page1': img_to_b64(output_imgs[0]),
        'output_page2': img_to_b64(output_imgs[1]),
        'output_outside_mapping': img_to_b64(interm_imgs[0]),
        'output_inside_mapping': img_to_b64(interm_imgs[1]),
    }
    return results