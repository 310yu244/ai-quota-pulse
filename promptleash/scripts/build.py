from pathlib import Path
import zipfile

root = Path(__file__).resolve().parent.parent
files = ['manifest.json', 'extract.js', 'adapters.js', 'content.js', 'popup.html', 'popup.css', 'popup.js', 'LICENSE', 'README.md']
output = root / 'dist' / 'promptleash-v1.0.2.zip'
output.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
    for name in files:
        archive.write(root / name, name)
    for icon in sorted((root / 'icons').glob('*.png')):
        archive.write(icon, str(icon.relative_to(root)))
print(output)
