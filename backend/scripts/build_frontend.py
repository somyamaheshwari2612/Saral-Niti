#!/usr/bin/env python3
"""
backend/scripts/build_frontend.py
---------------------------------
Assembles the standalone frontend/ distribution from backend/templates,
backend/static/css, backend/static/js, and backend/static/icons so that the
frontend can be deployed completely independently (e.g. to Vercel, Netlify, Cloudflare Pages)
with full PWA Offline Mode and Service Worker capabilities.
"""

import os
import re
import shutil

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
TEMPLATES_DIR = os.path.join(ROOT_DIR, 'backend', 'templates')
STATIC_DIR = os.path.join(ROOT_DIR, 'backend', 'static')
FRONTEND_DIR = os.path.join(ROOT_DIR, 'frontend')


def build():
    print("Building standalone frontend distribution...")

    # 1. Sync CSS, JS, and Icons assets
    os.makedirs(os.path.join(FRONTEND_DIR, 'css'), exist_ok=True)
    os.makedirs(os.path.join(FRONTEND_DIR, 'js'), exist_ok=True)
    os.makedirs(os.path.join(FRONTEND_DIR, 'icons'), exist_ok=True)

    for item in os.listdir(os.path.join(STATIC_DIR, 'css')):
        src = os.path.join(STATIC_DIR, 'css', item)
        dst = os.path.join(FRONTEND_DIR, 'css', item)
        if os.path.isfile(src):
            shutil.copyfile(src, dst)

    for item in os.listdir(os.path.join(STATIC_DIR, 'js')):
        src = os.path.join(STATIC_DIR, 'js', item)
        dst = os.path.join(FRONTEND_DIR, 'js', item)
        if os.path.isfile(src):
            shutil.copyfile(src, dst)

    icons_dir = os.path.join(STATIC_DIR, 'icons')
    if os.path.exists(icons_dir):
        for item in os.listdir(icons_dir):
            src = os.path.join(icons_dir, item)
            dst = os.path.join(FRONTEND_DIR, 'icons', item)
            if os.path.isfile(src):
                shutil.copyfile(src, dst)

    # 2. Sync PWA Service Worker & Manifest
    sw_src = os.path.join(STATIC_DIR, 'sw.js')
    if os.path.exists(sw_src):
        shutil.copyfile(sw_src, os.path.join(FRONTEND_DIR, 'sw.js'))

    manifest_src = os.path.join(STATIC_DIR, 'manifest.json')
    if os.path.exists(manifest_src):
        with open(manifest_src, 'r', encoding='utf-8') as f:
            manifest_content = f.read()
        # Adjust static paths in manifest for standalone frontend if needed
        manifest_content = manifest_content.replace('/static/icons/', './icons/')
        with open(os.path.join(FRONTEND_DIR, 'manifest.json'), 'w', encoding='utf-8') as f:
            f.write(manifest_content)

    print("Synced CSS, JS, Icons, Service Worker, and PWA Manifest.")

    # 3. Assemble index.html from templates
    with open(os.path.join(TEMPLATES_DIR, 'base.html'), 'r', encoding='utf-8') as f:
        html = f.read()

    includes = [
        'navbar.html',
        'hero.html',
        'schemes.html',
        'footer.html',
        'scheme_modal.html',
        'detector_modal.html',
        'eligibility_modal.html'
    ]

    for inc in includes:
        inc_path = os.path.join(TEMPLATES_DIR, inc)
        if os.path.exists(inc_path):
            with open(inc_path, 'r', encoding='utf-8') as f:
                content = f.read()
            pattern = re.compile(r'\{%\s*include\s+[\'\"]' + re.escape(inc) + r'[\'\"]\s*%\}')
            html = pattern.sub(lambda m: content, html)

    # Clean up Jinja block syntax
    html = re.sub(r'\{%\s*block\s+\w+\s*%\}', '', html)
    html = re.sub(r'\{%\s*endblock\s*%\}', '', html)

    # Replace Flask url_for and root manifest with relative paths
    html = re.sub(r"\{\{\s*url_for\('static',\s*filename='css/main\.css'\)\s*\}\}", './css/main.css', html)
    html = re.sub(r"\{\{\s*url_for\('static',\s*filename='js/i18n\.js'\)\s*\}\}", './js/i18n.js', html)
    html = re.sub(r"\{\{\s*url_for\('static',\s*filename='js/family_vault\.js'\)\s*\}\}", './js/family_vault.js', html)
    html = re.sub(r"\{\{\s*url_for\('static',\s*filename='js/main\.js'\)\s*\}\}", './js/main.js', html)
    html = re.sub(r"\{\{\s*url_for\('static',\s*filename='js/chatbot\.js'\)\s*\}\}", './js/chatbot.js', html)
    html = re.sub(r"\{\{\s*url_for\('static',\s*filename='icons/favicon\.svg'\)\s*\}\}", './icons/favicon.svg', html)
    html = re.sub(r"\{\{\s*url_for\('static',\s*filename='icons/favicon\.ico'\)\s*\}\}", './icons/favicon.ico', html)
    html = re.sub(r"\{\{\s*url_for\('static',\s*filename='icons/icon-192\.png'\)\s*\}\}", './icons/icon-192.png', html)
    html = html.replace('href="/manifest.json"', 'href="./manifest.json"')

    out_path = os.path.join(FRONTEND_DIR, 'index.html')
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(html)

    print(f"Generated {out_path} ({len(html)} bytes). Frontend build successful!")


if __name__ == '__main__':
    build()
