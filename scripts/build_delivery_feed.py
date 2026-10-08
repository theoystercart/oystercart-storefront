"""Build Google listings from live Wix product pages; Ecwid supplies stock only.

No credentials, customer data, or changes to either commerce system are involved.
Fail closed on missing/mismatched products rather than publishing guessed prices.
"""
import concurrent.futures
import html
import json
import re
import urllib.request
import xml.etree.ElementTree as ET
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = 'https://www.theoystercart.com'
SOURCE = 'https://d2hku29108hzuu.cloudfront.net/product_feed/24990767/google_shopping/FZuQcUVg51d4BkKk.xml'
G = 'http://base.google.com/ns/1.0'
ET.register_namespace('g', G)

def download(url):
    request = urllib.request.Request(url, headers={'User-Agent': 'OysterCartProductFeed/1.0'})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read().decode('utf-8')

def attribute(page, name):
    match = re.search(r'\b' + re.escape(name) + r'="([^"]+)"', page)
    if not match:
        raise ValueError(f'Missing {name}')
    return json.loads(html.unescape(match.group(1)))

def default_selection(product):
    selected = {}
    choices = {}
    for option in product.get('options', {}).get('list', []):
        if option['type'] not in ('SELECT', 'RADIO', 'SIZE', 'SWATCHES'):
            continue
        values = option.get('choices', [])
        if not values:
            continue
        index = option.get('defaultChoice', 0)
        if not isinstance(index, int) or not 0 <= index < len(values):
            index = 0
        choices[option['name']] = values[index]
        selected[option['name']] = values[index]['text']
    variation = next((v for v in product.get('combinations', {}).get('list', [])
        if v.get('options') and all(selected.get(o['name']) == o['value'] for o in v['options'])), None)
    price = Decimal(str(product.get('price', 0)))
    variation_names = set()
    if variation:
        for key in ('defaultDisplayedPrice', 'price'):
            if variation.get(key) is not None:
                price = Decimal(str(variation[key]))
                break
        variation_names = {o['name'] for o in variation['options']}
    for name, choice in choices.items():
        if name in variation_names:
            continue
        modifier = Decimal(str(choice.get('priceModifier', 0)))
        price += price * modifier / 100 if choice.get('priceModifierType') == 'PERCENT' else modifier
    if not price.is_finite() or price <= 0:
        raise ValueError(f'Invalid purchasable price: {product["name"]}')
    return price.quantize(Decimal('.01')), selected, variation

def build():
    catalogue = attribute(download(SITE + '/delivery'), 'catalogue-data')['products']
    if not 10 <= len(catalogue) <= 100:
        raise ValueError('Unexpected delivery catalogue size')
    raw = ET.fromstring(download(SOURCE))
    inventory = {}
    for item in raw.findall('.//item'):
        fields = {c.tag.split('}')[-1]: c.text for c in item}
        match = re.search(r'-p(\d+)(?:[/?#]|$)', fields.get('link', ''))
        if match:
            inventory[match.group(1)] = fields

    def read_product(card):
        href = card['href']
        if not re.fullmatch(r'/products/[a-z0-9-]+', href):
            raise ValueError('Unexpected product URL')
        page = download(SITE + href)
        product = attribute(page, 'product-data')
        product_id = str(product['ecwidId'])
        stock = inventory.get(product_id)
        if not stock:
            raise ValueError(f'No current inventory: {href}')
        # Ecwid exports the default variant price, or zero for option-priced items.
        source_price = Decimal(stock['price'].split()[0])
        price, selected, variation = default_selection(product)
        if source_price > 0 and source_price not in (price, Decimal(str(product['price']))):
            raise ValueError(f'Wix/Ecwid default price mismatch: {href}: {price} vs {source_price}')
        availability = stock['availability'].replace(' ', '_')
        if availability not in ('in_stock', 'out_of_stock'):
            raise ValueError('Unrecognized availability')
        if variation and (variation.get('outOfStock') is True or
                (variation.get('unlimited') is False and variation.get('quantity') == 0)):
            availability = 'out_of_stock'
        return card, product, stock, price, selected, availability

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        products = list(pool.map(read_product, catalogue))
    rss = ET.Element('rss', version='2.0')
    channel = ET.SubElement(rss, 'channel')
    for key, value in [('title', 'The Oyster Cart — Delivery Products'), ('link', SITE + '/delivery'),
                       ('description', 'Delivery catalogue with Wix product-page links and current default selections.')]:
        ET.SubElement(channel, key).text = value
    audit = []
    seen = set()
    for card, product, stock, price, selected, availability in products:
        pid = str(product['ecwidId'])
        if pid in seen:
            raise ValueError('Duplicate product ID')
        seen.add(pid)
        item = ET.SubElement(channel, 'item')
        fields = {
            'id': pid,
            'title': product['name'],
            'description': card['description'] + (' Default selection: ' + '; '.join(f'{k}: {v}' for k,v in selected.items()) + '.' if selected else ''),
            'link': SITE + card['href'],
            'image_link': product['image'],
            'price': f'{price} SGD',
            'availability': availability,
            'condition': 'new',
            'google_product_category': 'Food, Beverages & Tobacco > Food Items',
            'product_type': 'Delivery > ' + card['category'],
        }
        for key in ('brand', 'gtin', 'mpn', 'identifier_exists'):
            if stock.get(key):
                fields[key] = stock[key].lower() if key == 'identifier_exists' else stock[key]
        for key,value in fields.items():
            ET.SubElement(item, f'{{{G}}}{key}').text = str(value)
        audit.append({'id':pid,'name':product['name'],'link':fields['link'],'price':fields['price'],'availability':availability,'selection':selected})
    ET.indent(rss)
    output = ROOT / 'feeds/delivery-products.xml'
    output.parent.mkdir(exist_ok=True)
    output.write_bytes(ET.tostring(rss, encoding='utf-8', xml_declaration=True))
    (ROOT / 'feeds/delivery-products-audit.json').write_text(json.dumps(audit, indent=2) + '\n')
    print(f'Validated {len(products)} products; all links use {SITE}/products/.')

if __name__ == '__main__':
    build()
