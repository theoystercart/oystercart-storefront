"""Build Merchant Center listings from the current Wix-backed storefront.

Read public product snapshots only. Preserve established listing IDs and abort
without replacing the published feed if any price/stock source cannot be verified.
"""
import concurrent.futures
import html
import json
import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = 'https://www.theoystercart.com'
SHOP = 'https://shop.theoystercart.com'
G = 'http://base.google.com/ns/1.0'
ET.register_namespace('g', G)


def download(url):
    request = urllib.request.Request(url, headers={'User-Agent': 'OysterCartProductFeed/2.0'})
    with urllib.request.urlopen(request, timeout=60) as response:
        if urllib.parse.urlsplit(response.url).hostname not in ('www.theoystercart.com', 'shop.theoystercart.com'):
            raise ValueError('Unexpected redirect destination')
        return response.read().decode('utf-8')


def attribute(page, name):
    match = re.search(r'\b' + re.escape(name) + r'="([^"]+)"', page)
    if not match:
        raise ValueError(f'Missing {name}')
    return json.loads(html.unescape(match.group(1)))


def product_url(href):
    url = urllib.parse.urljoin(SITE, href)
    parsed = urllib.parse.urlsplit(url)
    if (parsed.scheme != 'https' or parsed.netloc not in ('www.theoystercart.com', 'shop.theoystercart.com')
            or parsed.query or parsed.fragment or not re.fullmatch(r'/products/[a-z0-9-]+/?', parsed.path)):
        raise ValueError(f'Unexpected product URL: {href}')
    return url


def product_snapshot(page):
    match = re.search(r'<script\b[^>]*\bid="product"[^>]*>(.*?)</script>', page, re.S)
    product = json.loads(match.group(1)) if match else attribute(page, 'product-data')
    if product.get('catalogueSource') != 'WIX':
        raise ValueError('Product does not have a verified Wix catalogue snapshot')
    return product


def advertised_selection(product):
    price = Decimal(str(product['price']))
    if not price.is_finite() or price <= 0 or price != price.quantize(Decimal('.01')):
        raise ValueError(f'Invalid product price: {product.get("name")}')
    variants = product.get('combinations', {}).get('list', [])
    # Use an actual purchasable combination at the displayed base price. Required
    # sauce selection must not silently add a paid bundle to the advertised price.
    base = [v for v in variants if Decimal(str(v.get('price'))) == price]
    if not base or any(type(v.get('inStock')) is not bool for v in base):
        raise ValueError(f'Missing verified base-price stock: {product.get("name")}')
    available = [v for v in base if v['inStock']]
    selected = {o['name']: o['value'] for o in (available or base)[0].get('options', [])}
    return price.quantize(Decimal('.01')), selected, 'in_stock' if available else 'out_of_stock'


def read_product(card):
    url = product_url(card['href'])
    product = product_snapshot(download(url))
    if not re.fullmatch(r'\d+', str(product.get('ecwidId', ''))):
        raise ValueError(f'Missing stable listing ID: {url}')
    price, selected, availability = advertised_selection(product)
    if not str(product.get('image', '')).startswith('https://') or not product.get('name'):
        raise ValueError(f'Missing product name/image: {url}')
    return card, product, url, price, selected, availability


def build():
    catalogue = attribute(download(SITE + '/delivery'), 'catalogue-data')['products']
    if not 10 <= len(catalogue) <= 100:
        raise ValueError('Unexpected delivery catalogue size')
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        products = list(pool.map(read_product, catalogue))
    rss = ET.Element('rss', version='2.0')
    channel = ET.SubElement(rss, 'channel')
    for key, value in [('title', 'The Oyster Cart — Delivery Products'), ('link', SITE + '/delivery'),
                       ('description', 'Delivery catalogue with current Wix-backed storefront prices and availability.')]:
        ET.SubElement(channel, key).text = value
    audit, seen = [], set()
    for card, product, url, price, selected, availability in products:
        pid = str(product['ecwidId'])
        if pid in seen:
            raise ValueError('Duplicate product ID')
        seen.add(pid)
        item = ET.SubElement(channel, 'item')
        description = card.get('description') or product.get('shortDescription') or product['name']
        description = html.unescape(re.sub(r'<[^>]*>', ' ', description))
        fields = {
            'id': pid,
            'title': product['name'],
            'description': description + (' Selection at this price: ' + '; '.join(f'{k}: {v}' for k,v in selected.items()) + '.' if selected else ''),
            'link': url,
            'image_link': product['image'],
            'price': f'{price} SGD',
            'availability': availability,
            'condition': 'new',
            'identifier_exists': 'false',
            'google_product_category': 'Food, Beverages & Tobacco > Food Items',
            'product_type': 'Delivery > ' + card['category'],
        }
        for key, value in fields.items():
            ET.SubElement(item, f'{{{G}}}{key}').text = str(value)
        audit.append({'id': pid, 'name': product['name'], 'link': url, 'price': fields['price'],
                      'availability': availability, 'selection': selected, 'source': 'WIX'})
    ET.indent(rss)
    # Validate every source before touching either generated output.
    output = ROOT / 'feeds/delivery-products.xml'
    output.parent.mkdir(exist_ok=True)
    output.write_bytes(ET.tostring(rss, encoding='utf-8', xml_declaration=True))
    (ROOT / 'feeds/delivery-products-audit.json').write_text(json.dumps(audit, indent=2) + '\n')
    print(f'Validated {len(products)} Wix-backed delivery products; no Ecwid requests.')


if __name__ == '__main__':
    build()
