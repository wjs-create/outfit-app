#!/usr/bin/env python3
"""Simple backend: serve static files + proxy for parsing shopping product pages."""
import http.server
import json
import re
import urllib.request
import urllib.parse
import ssl
import os
from html.parser import HTMLParser

PORT = 4567
STATIC_DIR = os.path.dirname(os.path.abspath(__file__))


class MetaParser(HTMLParser):
    """Extract meta tags, title, JSON-LD from product pages."""
    def __init__(self):
        super().__init__()
        self.title = ""
        self.title_done = False
        self.meta = {}
        self.json_ld = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "meta":
            name = attrs.get("name") or attrs.get("property") or ""
            content = attrs.get("content", "")
            if name and content:
                self.meta[name] = content

    def handle_data(self, data):
        if not self.title_done and data.strip():
            self.title = data.strip()
            self.title_done = True

    def handle_startendtag(self, tag, attrs):
        pass  # self-closing tags


def extract_product_info(html: str, url: str) -> dict:
    """Parse product page HTML and return structured info."""
    parser = MetaParser()
    try:
        parser.feed(html)
    except Exception:
        pass

    # title priority: og:title > product:name > html title
    title = (
        parser.meta.get("og:title") or
        parser.meta.get("twitter:title") or
        parser.meta.get("product:name") or
        parser.title or
        ""
    )
    # clean title: remove site name suffixes
    title = re.sub(r'\s*[-–—|]\s*(天猫|淘宝|京东|拼多多|淘宝网|Tmall|JD\.com).*$', '', title).strip()

    # image priority: og:image with product aspect > first og:image > img_url
    image = (
        parser.meta.get("og:image") or
        parser.meta.get("twitter:image") or
        ""
    )
    if image.startswith("//"):
        image = "https:" + image

    # description
    description = (
        parser.meta.get("og:description") or
        parser.meta.get("description") or
        ""
    ).strip()

    # price: look for product:price or price meta
    price = parser.meta.get("product:price:amount") or parser.meta.get("product:price") or ""

    # try to determine category from title/description keywords
    category = guess_category(title + " " + description)

    # color guess
    color = guess_color(title)

    return {
        "title": title,
        "image": image,
        "description": description,
        "price": price,
        "category": category,
        "color": color,
        "source_url": url,
    }


def guess_category(text: str) -> str:
    """Guess clothing category from text."""
    t = text.lower()
    if any(w in t for w in ["连衣裙", "裙装", "长裙", "短裙"]):
        return "dress"
    if any(w in t for w in ["外套", "大衣", "夹克", "风衣", "西装", "棉服", "羽绒", "开衫", "卫衣外套"]):
        return "outer"
    if any(w in t for w in ["裤", "牛仔裤", "西裤", "短裤", "阔腿裤", "直筒裤"]):
        return "bottom"
    if any(w in t for w in ["衬衫", "t恤", "T恤", "卫衣", "毛衣", "针织", "打底", "背心", "吊带", "polo", "Polo"]):
        return "top"
    if any(w in t for w in ["鞋", "靴", "凉鞋", "运动鞋", "乐福鞋", "帆布鞋", "皮鞋"]):
        return "shoes"
    if any(w in t for w in ["包", "背包", "挎包", "手提包", "手袋", "钱包"]):
        return "bag"
    return "top"  # default


def guess_color(text: str) -> str:
    """Try to extract color from title."""
    colors = ["黑色", "白色", "红色", "蓝色", "绿色", "黄色", "粉色", "灰色",
              "卡其", "棕色", "紫色", "米色", "驼色", "藏蓝", "深蓝", "浅蓝",
              "条纹", "格子", "碎花", "牛仔"]
    for c in colors:
        if c in text:
            return c
    return ""


def fetch_url(url: str, timeout: int = 15) -> bytes:
    """Fetch a URL with browser-like headers."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "Referer": "https://www.google.com/",
    }
    req = urllib.request.Request(url, headers=headers)
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
            return resp.read()
    except Exception as e:
        raise RuntimeError(f"无法抓取该页面: {e}")


class APIHandler(http.server.SimpleHTTPRequestHandler):
    """Static file server + /api/fetch-product endpoint."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=STATIC_DIR, **kwargs)

    def end_headers(self):
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "credentialless")
        super().end_headers()

    def do_GET(self):
        if self.path.startswith("/api/proxy-image"):
            self.handle_proxy_image()
        elif self.path.startswith("/api/fetch-product"):
            self.handle_fetch_product()
        elif self.path.startswith("/api/ping"):
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": True}).encode())
        else:
            super().do_GET()

    def handle_proxy_image(self):
        """Proxy an image to avoid CORS canvas tainting."""
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)
        url = params.get("url", [""])[0]
        if not url:
            self.send_json({"error": "missing url"}, 400)
            return
        try:
            data = fetch_url(url, timeout=10)
            self.send_response(200)
            self.send_header("Content-Type", "image/jpeg")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "max-age=86400")
            self.end_headers()
            self.wfile.write(data)
        except Exception as e:
            self.send_json({"error": str(e)}, 502)

    def handle_fetch_product(self):
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)
        url = params.get("url", [""])[0]

        if not url:
            self.send_json({"error": "缺少 url 参数"}, 400)
            return

        try:
            html_bytes = fetch_url(url)
            html = html_bytes.decode("utf-8", errors="replace")
            info = extract_product_info(html, url)
            self.send_json(info)
        except RuntimeError as e:
            self.send_json({"error": str(e)}, 502)
        except Exception as e:
            self.send_json({"error": f"解析失败: {e}"}, 500)

    def send_json(self, data, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode())

    def log_message(self, format, *args):
        # suppress default logs for cleaner output
        if "/api/" not in (args[0] if args else ""):
            pass


if __name__ == "__main__":
    print(f" Wardrobe API Server → http://127.0.0.1:{PORT}")
    print(f"   静态文件: {STATIC_DIR}")
    print(f"   商品解析: /api/fetch-product?url=<链接>")
    httpd = http.server.HTTPServer(("0.0.0.0", PORT), APIHandler)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n关闭服务器")
        httpd.shutdown()
