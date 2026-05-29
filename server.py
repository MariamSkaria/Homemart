import http.server
import json
import os
import socket
import sys
import time
import urllib.parse
import urllib.request

PORT = 8000
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PUBLIC_DIR = os.path.join(CURRENT_DIR, 'public')
DB_FILE = os.path.join(CURRENT_DIR, 'database.json')
CATALOG_FILE = os.path.join(CURRENT_DIR, 'catalog.json')

SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_KEY')

if SUPABASE_URL and SUPABASE_KEY:
    print(f"Cloud mode enabled: database synced with Supabase at {SUPABASE_URL}")
else:
    print("Local mode enabled: database saved to local JSON files.")

# Ensure public directory exists
os.makedirs(PUBLIC_DIR, exist_ok=True)

# Supabase Helper Functions
def supabase_get(key):
    url = f"{SUPABASE_URL}/rest/v1/store?key=eq.{key}&select=value"
    headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json'
    }
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=8) as response:
            data = json.loads(response.read().decode('utf-8'))
            if data and len(data) > 0:
                return data[0].get('value', [])
            return []
    except Exception as e:
        print(f"Error fetching {key} from Supabase: {e}", file=sys.stderr)
        return None

def supabase_set(key, value):
    url = f"{SUPABASE_URL}/rest/v1/store"
    headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
    }
    payload = json.dumps([{"key": key, "value": value}]).encode('utf-8')
    req = urllib.request.Request(url, data=payload, headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=8) as response:
            return True
    except Exception as e:
        print(f"Error saving {key} to Supabase: {e}", file=sys.stderr)
        return False

# Helper functions for Database
def read_db():
    if SUPABASE_URL and SUPABASE_KEY:
        data = supabase_get('cart')
        if data is not None:
            return data
        print("Falling back to local database.json due to Supabase fetch error.", file=sys.stderr)

    if not os.path.exists(DB_FILE):
        return []
    try:
        with open(DB_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error reading database: {e}", file=sys.stderr)
        return []

def write_db(data):
    if SUPABASE_URL and SUPABASE_KEY:
        success = supabase_set('cart', data)
        if success:
            return True
        print("Falling back to local database.json due to Supabase save error.", file=sys.stderr)

    try:
        with open(DB_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"Error writing database: {e}", file=sys.stderr)
        return False

def read_catalog():
    if SUPABASE_URL and SUPABASE_KEY:
        data = supabase_get('catalog')
        if data is not None:
            return data
        print("Falling back to local catalog.json due to Supabase fetch error.", file=sys.stderr)

    if not os.path.exists(CATALOG_FILE):
        return []
    try:
        with open(CATALOG_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error reading catalog: {e}", file=sys.stderr)
        return []

def write_catalog(data):
    if SUPABASE_URL and SUPABASE_KEY:
        success = supabase_set('catalog', data)
        if success:
            return True
        print("Falling back to local catalog.json due to Supabase save error.", file=sys.stderr)

    try:
        with open(CATALOG_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"Error writing catalog: {e}", file=sys.stderr)
        return False

class HomemartRequestHandler(http.server.BaseHTTPRequestHandler):
    def send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PATCH, DELETE')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_cors_headers()
        self.end_headers()

    def do_GET(self):
        try:
            # Parse URL
            parsed_url = urllib.parse.urlparse(self.path)
            path = parsed_url.path

            # Route: API Catalog
            if path == '/api/catalog':
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_cors_headers()
                self.end_headers()
                catalog = read_catalog()
                self.wfile.write(json.dumps(catalog).encode('utf-8'))
                return

            # Route: API Cart
            elif path == '/api/cart':
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_cors_headers()
                self.end_headers()
                cart = read_db()
                self.wfile.write(json.dumps(cart).encode('utf-8'))
                return

            # Serve static frontend files
            else:
                # Map default root path to index.html
                if path == '/' or path == '':
                    filename = 'index.html'
                else:
                    # Remove leading slash
                    filename = path.lstrip('/')

                filepath = os.path.join(PUBLIC_DIR, filename)

                # Prevent Directory Traversal Vulnerability
                resolved_path = os.path.abspath(filepath)
                if not resolved_path.startswith(PUBLIC_DIR):
                    self.send_error(403, "Forbidden")
                    return

                if os.path.exists(filepath) and os.path.isfile(filepath):
                    # Guess content type
                    ext = os.path.splitext(filepath)[1].lower()
                    content_type = 'text/plain'
                    if ext == '.html':
                        content_type = 'text/html; charset=utf-8'
                    elif ext == '.css':
                        content_type = 'text/css; charset=utf-8'
                    elif ext == '.js':
                        content_type = 'application/javascript; charset=utf-8'
                    elif ext == '.json':
                        content_type = 'application/json; charset=utf-8'
                    elif ext == '.png':
                        content_type = 'image/png'
                    elif ext == '.jpg' or ext == '.jpeg':
                        content_type = 'image/jpeg'
                    elif ext == '.svg':
                        content_type = 'image/svg+xml'

                    self.send_response(200)
                    self.send_header('Content-Type', content_type)
                    self.send_cors_headers()
                    self.end_headers()
                    
                    with open(filepath, 'rb') as f:
                        self.wfile.write(f.read())
                else:
                    self.send_error(404, f"File Not Found: {filename}")
        except ConnectionError as e:
            # Catch WinError 10053/10054 and other socket drops gracefully
            print(f"Client connection closed/aborted during GET: {e}", file=sys.stderr)

    def do_POST(self):
        try:
            parsed_url = urllib.parse.urlparse(self.path)
            path = parsed_url.path

            # Read JSON body
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length).decode('utf-8')
            
            try:
                body = json.loads(post_data) if post_data else {}
            except json.JSONDecodeError:
                self.send_error(400, "Invalid JSON Body")
                return

            # Route: Add item to Catalog (Custom Product Registration)
            if path == '/api/catalog/add':
                required = ['name', 'category', 'price', 'unit', 'emoji', 'bgGradient']
                if not all(k in body for k in required):
                    self.send_error(400, f"Missing required fields. Needs: {required}")
                    return

                catalog = read_catalog()
                
                # Normalize and generate ID
                new_prod = {
                    'id': body.get('id') or f"prod-{int(time.time() * 1000)}",
                    'name': body['name'],
                    'category': body['category'],
                    'price': float(body['price']),
                    'unit': body['unit'],
                    'emoji': body['emoji'],
                    'bgGradient': body['bgGradient'],
                    'description': body.get('description', 'Custom item added to catalog.')
                }
                
                # Check if product name already exists
                exists = False
                for prod in catalog:
                    if prod['name'].lower() == new_prod['name'].lower() and prod['category'] == new_prod['category']:
                        new_prod = prod # Use existing product
                        exists = True
                        break
                
                if not exists:
                    catalog.append(new_prod)
                    write_catalog(catalog)
                    
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({'success': True, 'product': new_prod, 'catalog': catalog}).encode('utf-8'))
                return

            # Route: Update Catalog Item
            elif path == '/api/catalog/update':
                required = ['id', 'name', 'category', 'price', 'unit', 'emoji', 'bgGradient']
                if not all(k in body for k in required):
                    self.send_error(400, f"Missing required fields. Needs: {required}")
                    return

                prod_id = body['id']
                catalog = read_catalog()
                
                # Find and update the catalog item
                updated_prod = None
                for prod in catalog:
                    if prod['id'] == prod_id:
                        prod['name'] = body['name']
                        prod['category'] = body['category']
                        prod['price'] = float(body['price'])
                        prod['unit'] = body['unit']
                        prod['emoji'] = body['emoji']
                        prod['bgGradient'] = body['bgGradient']
                        prod['description'] = body.get('description', prod.get('description', ''))
                        updated_prod = prod
                        break
                
                if not updated_prod:
                    self.send_error(404, f"Product not found in catalog: {prod_id}")
                    return
                    
                write_catalog(catalog)
                
                # Also update items in active cart if present
                cart = read_db()
                cart_updated = False
                for item in cart:
                    if item['id'] == prod_id:
                        item['name'] = updated_prod['name']
                        item['category'] = updated_prod['category']
                        item['price'] = updated_prod['price']
                        item['unit'] = updated_prod['unit']
                        item['emoji'] = updated_prod['emoji']
                        item['bgGradient'] = updated_prod['bgGradient']
                        item['description'] = updated_prod['description']
                        cart_updated = True
                
                if cart_updated:
                    write_db(cart)

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({'success': True, 'product': updated_prod, 'catalog': catalog}).encode('utf-8'))
                return

            # Route: Delete Catalog Item
            elif path == '/api/catalog/delete':
                required = ['id']
                if not all(k in body for k in required):
                    self.send_error(400, "Missing product id")
                    return

                prod_id = body['id']
                catalog = read_catalog()
                
                # Filter out the item
                new_catalog = [prod for prod in catalog if prod['id'] != prod_id]
                
                if len(new_catalog) == len(catalog):
                    self.send_error(404, f"Product not found in catalog: {prod_id}")
                    return
                    
                write_catalog(new_catalog)

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({'success': True, 'catalog': new_catalog}).encode('utf-8'))
                return

            # Route: Add to Cart
            elif path == '/api/cart/add':
                required = ['id', 'name', 'category', 'price', 'unit', 'emoji', 'bgGradient', 'addedBy']
                if not all(k in body for k in required):
                    self.send_error(400, f"Missing required fields. Needs: {required}")
                    return

                cart = read_db()
                
                # Check if item exists in active cart (not bought yet)
                existing_item = None
                for item in cart:
                    if item['id'] == body['id'] and not item.get('bought', False):
                        existing_item = item
                        break

                if existing_item:
                    existing_item['quantity'] += 1
                    existing_item['lastUpdatedBy'] = body['addedBy']
                    existing_item['lastUpdatedAt'] = time.time()
                else:
                    # Add new item
                    new_item = {
                        'id': body['id'],
                        'name': body['name'],
                        'category': body['category'],
                        'price': float(body['price']),
                        'unit': body['unit'],
                        'emoji': body['emoji'],
                        'bgGradient': body['bgGradient'],
                        'addedBy': body['addedBy'],
                        'quantity': 1,
                        'bought': False,
                        'boughtBy': None,
                        'addedAt': time.time(),
                        'lastUpdatedBy': body['addedBy'],
                        'lastUpdatedAt': time.time()
                    }
                    cart.append(new_item)

                write_db(cart)
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({'success': True, 'cart': cart}).encode('utf-8'))

            # Route: Update Cart Item Quantity/Status
            elif path == '/api/cart/update':
                required = ['id']
                if not all(k in body for k in required):
                    self.send_error(400, "Missing item id")
                    return

                item_id = body['id']
                cart = read_db()
                
                # Find item (either active or bought)
                found = False
                for item in cart:
                    # If we're updating a specific instance, or matching on id
                    # For simplicity, match the item that is active, or if none, the latest matching id
                    # To support toggling bought state:
                    if item['id'] == item_id:
                        if 'quantity' in body:
                            item['quantity'] = int(body['quantity'])
                            if item['quantity'] <= 0:
                                cart.remove(item)
                                found = True
                                break
                        if 'bought' in body:
                            item['bought'] = bool(body['bought'])
                            item['boughtBy'] = body.get('boughtBy') if item['bought'] else None
                        
                        item['lastUpdatedBy'] = body.get('updatedBy', 'System')
                        item['lastUpdatedAt'] = time.time()
                        found = True
                        break

                if not found:
                    self.send_error(404, f"Item not found in cart: {item_id}")
                    return

                write_db(cart)

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({'success': True, 'cart': cart}).encode('utf-8'))

            # Route: Delete Item from Cart
            elif path == '/api/cart/remove':
                required = ['id']
                if not all(k in body for k in required):
                    self.send_error(400, "Missing item id")
                    return

                item_id = body['id']
                cart = read_db()
                
                new_cart = [item for item in cart if item['id'] != item_id]
                write_db(new_cart)

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({'success': True, 'cart': new_cart}).encode('utf-8'))

            # Route: Clear Cart
            elif path == '/api/cart/clear':
                clear_type = body.get('type', 'all')
                cart = read_db()

                if clear_type == 'bought':
                    # Remove only items marked as bought
                    cart = [item for item in cart if not item.get('bought', False)]
                else:
                    # Remove everything
                    cart = []

                write_db(cart)

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({'success': True, 'cart': cart}).encode('utf-8'))

            else:
                self.send_error(404, "Endpoint Not Found")
        except ConnectionError as e:
            print(f"Client connection closed/aborted during POST: {e}", file=sys.stderr)

def get_local_ip():
    try:
        # Create a dummy connection to get local IP
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

def run_server():
    server_address = ('', PORT)
    httpd = http.server.HTTPServer(server_address, HomemartRequestHandler)
    local_ip = get_local_ip()
    
    print("\n" + "="*60)
    print(" HOMEMART GROCERY SERVER IS RUNNING!")
    print("="*60)
    print(f" * Localhost access:  http://localhost:{PORT}/")
    print(f" * Home network access: http://{local_ip}:{PORT}/")
    print("\n Share the home network link with other family members on their")
    print(" phones or tablets to start shopping and syncing in real-time!")
    print("="*60 + "\n")
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping Homemart server...")
        httpd.server_close()

if __name__ == '__main__':
    run_server()
