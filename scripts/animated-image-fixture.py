"""Generate deterministic test frames, or sample an actual rendered PNG screenshot."""
import base64
import io
import json
import sys
from PIL import Image

if sys.argv[1] == "generate":
    frames = [Image.new("RGB", (120, 80), color) for color in [(230, 25, 25), (25, 230, 25), (25, 25, 230)]]
    result = {}
    for extension, image_format in [("gif", "GIF"), ("webp", "WEBP")]:
        output = io.BytesIO()
        frames[0].save(output, format=image_format, save_all=True, append_images=frames[1:], duration=300, loop=0, lossless=True)
        data = output.getvalue()
        with Image.open(io.BytesIO(data)) as check:
            assert check.n_frames == 3
            assert check.size == (120, 80)
        result[extension] = base64.b64encode(data).decode("ascii")
    print(json.dumps(result))
elif sys.argv[1] == "pixel":
    with Image.open(io.BytesIO(base64.b64decode(sys.stdin.read(), validate=True))) as screenshot:
        image = screenshot.convert("RGB")
        print(json.dumps(image.getpixel((image.width // 2, image.height // 2))))
else:
    raise ValueError("Unknown fixture operation")
