# Script to generate clean-cut, transparent-corner icons for both Web and Expo Mobile
from PIL import Image, ImageDraw
import subprocess
import os

def generate_all_icons():
    # Load original source logo from git HEAD if needed to avoid cumulative artifacts
    try:
        git_head = subprocess.check_output(['git', 'show', 'HEAD:public/logo.png'])
        with open('scripts/orig_logo.png', 'wb') as f:
            f.write(git_head)
        src = Image.open('scripts/orig_logo.png').convert('RGBA')
    except Exception:
        src = Image.open('public/logo.png').convert('RGBA')

    w, h = src.size

    # Exact true squircle: x0=50, y0=36, x1=460, y1=446 -> 410x410 square
    # Corner radius: 82px
    SCALE = 8
    mask = Image.new('L', (w * SCALE, h * SCALE), 0)
    draw = ImageDraw.Draw(mask)

    x0 = 50 * SCALE
    y0 = 36 * SCALE
    x1 = 460 * SCALE
    y1 = 446 * SCALE
    r = 82 * SCALE

    draw.rounded_rectangle([x0, y0, x1, y1], radius=r, fill=255)
    mask = mask.resize((w, h), Image.Resampling.LANCZOS)
    src.putalpha(mask)

    # Crop tight to the exact 410x410 squircle
    cropped = src.crop((50, 36, 460, 446))
    cw, ch = cropped.size

    def make_icon(size, target_content_size):
        canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        scale = target_content_size / cw
        sw, sh = int(cw * scale), int(ch * scale)
        scaled = cropped.resize((sw, sw), Image.Resampling.LANCZOS)
        ox = (size - sw) // 2
        oy = (size - sh) // 2
        canvas.paste(scaled, (ox, oy), scaled)
        return canvas

    # Ensure output directories exist
    os.makedirs('public', exist_ok=True)
    os.makedirs('src/app', exist_ok=True)
    os.makedirs('mobile/assets/images', exist_ok=True)

    # 1. Web Favicon & Brand Icons (Clean cut transparent corners)
    print("Generating web icons...")
    make_icon(512, 480).save('public/logo.png', format='PNG')
    make_icon(256, 240).save('src/app/icon.png', format='PNG')
    make_icon(180, 170).save('public/apple-icon.png', format='PNG')

    # 2. Mobile assets
    print("Generating mobile icons...")
    # In-app Logo
    make_icon(512, 480).save('mobile/assets/images/logo.png', format='PNG')
    # Mobile Favicon
    make_icon(48, 44).save('mobile/assets/images/favicon.png', format='PNG')
    # Main Launcher Icon
    make_icon(1024, 940).save('mobile/assets/images/icon.png', format='PNG')
    # Splash Icon (Android 12 splash screen)
    make_icon(1024, 520).save('mobile/assets/images/splash-icon.png', format='PNG')
    # Android Adaptive Foreground (Safe zone diameter 675px -> fits 520px squircle perfectly)
    make_icon(1024, 520).save('mobile/assets/images/adaptive-foreground.png', format='PNG')

    # Android Adaptive Background (Theme Cream #FDF9F2)
    bg = Image.new('RGBA', (1024, 1024), (253, 249, 242, 255))
    bg.save('mobile/assets/images/adaptive-background.png', format='PNG')

    # Android Adaptive Monochrome (White stencil of 520px squircle)
    afg = Image.open('mobile/assets/images/adaptive-foreground.png')
    mono = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
    alpha = afg.split()[3]
    white = Image.new('RGB', (1024, 1024), (255, 255, 255))
    mono.paste(white, (0, 0), alpha)
    mono.save('mobile/assets/images/adaptive-monochrome.png', format='PNG')

    # Clean up temp test files if any
    for tmp in ['scripts/orig_logo.png']:
        if os.path.exists(tmp):
            os.remove(tmp)

    print("All 10 web and mobile icon assets successfully generated with clean cut transparent corners!")

if __name__ == '__main__':
    generate_all_icons()
