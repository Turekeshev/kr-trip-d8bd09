"""Ставит в sw.js версию кэша по хэшу файлов приложения: после любой правки телефон подтянет новую версию."""
import hashlib, pathlib, re

ROOT = pathlib.Path(__file__).parent
ASSETS = ['index.html', 'styles.css', 'app.js', 'manifest.webmanifest', 'data/trip.enc.json',
          'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png']


def build():
    h = hashlib.sha256()
    for a in ASSETS:
        h.update((ROOT / a).read_bytes())
    ver = h.hexdigest()[:12]
    sw = ROOT / 'sw.js'
    sw.write_text(re.sub(r"const VERSION = '[^']*';", f"const VERSION = '{ver}';", sw.read_text(encoding='utf-8'), count=1), encoding='utf-8')
    return ver


if __name__ == '__main__':
    print('sw version', build())
