# Little Readers UG Plugin Configuration Examples

## Plugin Settings

### Basic Configuration
```
Backend URL: https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
API Key: LRU_WebApp_Key_2025
```

### Example Google Apps Script URL Format
```
https://script.google.com/macros/s/1CTFpUaGqxKUICPzbDSnkdBiAbS2n5ZNZqjxCwI7xRbs/exec
```

## Shortcode Usage Examples

### Basic Usage
```html
[little_readers_store]
```

### With Custom Settings
```html
[little_readers_store backend_url="https://your-custom-script.com" api_key="custom_key"]
```

### In Page Content
```html
<h2>Welcome to Our Bookstore</h2>
<p>Discover amazing pre-loved children's books!</p>

[little_readers_store]

<h3>Contact Us</h3>
<p>Have questions? Contact us on WhatsApp!</p>
```

## CSS Customization Examples

### Color Scheme Customization
```css
/* Add to your theme's style.css or custom CSS */
:root {
  --green: #2d5a27;        /* Darker green */
  --yellow: #ffb300;       /* Different yellow */
  --offwhite: #ffffff;     /* Pure white background */
}
```

### Font Customization
```css
:root {
  --font-head: 'Georgia', serif;
  --font-body: 'Arial', sans-serif;
}
```

### Layout Adjustments
```css
/* Wider book grid */
.lrp-books-grid {
  max-width: 1300px;
}

/* Different book card styling */
.lrp-book-card {
  border-radius: 20px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
}
```

## WordPress Theme Integration

### Adding to Theme Template
```php
<?php
// In your theme's template file (e.g., page-bookstore.php)
get_header();
?>

<div class="bookstore-page">
    <div class="container">
        <h1>Little Readers UG Bookstore</h1>
        <?php echo do_shortcode('[little_readers_store]'); ?>
    </div>
</div>

<?php get_footer(); ?>
```

### Menu Integration
```php
// Add to functions.php to create a bookstore menu item
function add_bookstore_menu() {
    wp_nav_menu_items .= '<li><a href="/bookstore">Bookstore</a></li>';
}
add_action('wp_nav_menu_items', 'add_bookstore_menu');
```

## Google Apps Script Configuration

### Required Endpoints
Your Google Apps Script should handle these actions:

```javascript
function handleApiRequest(e) {
  const action = e.parameter.action;
  switch (action) {
    case "getBooks": 
      return jsonResponse(getAvailableBooks());
    case "checkAvailability": 
      return jsonResponse(checkBooksAvailability(e.parameter.codes.split(",")));
    case "deliveryPrice": 
      return jsonResponse(getDeliveryPrice(e.parameter.area));
    case "deliveryAreas": 
      return jsonResponse(getAllDeliveryAreas());
    case "validatePromo": 
      return jsonResponse(validatePromo(e.parameter.code));
    default: 
      return jsonResponse({ error: "Invalid action" });
  }
}
```

### CORS Configuration
Ensure your Google Apps Script allows requests from your WordPress site:

```javascript
function doGet(e) {
  // Handle CORS
  if (e && e.parameter && e.parameter.action) {
    return handleApiRequest(e);
  }
  // Return HTML for direct access
  return HtmlService.createHtmlOutputFromFile('index')
    .addMetaTag('viewport','width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
```

## Caching Configuration

### WordPress Caching
The plugin uses WordPress transients for caching:

```php
// Delivery areas cached for 3 hours
set_transient('lrp_delivery_areas', $data, 3 * HOUR_IN_SECONDS);

// Promo codes cached for 1 hour
set_transient('lrp_promo_' . md5($code), $data, HOUR_IN_SECONDS);
```

### Manual Cache Management
```php
// Clear delivery areas cache
delete_transient('lrp_delivery_areas');

// Clear all promo caches (requires database query)
global $wpdb;
$wpdb->query("DELETE FROM {$wpdb->options} WHERE option_name LIKE '_transient_lrp_promo_%'");
```

## Performance Optimization

### Image Optimization
Add to your theme's functions.php:

```php
// Optimize book cover images
function optimize_book_images($html) {
    return str_replace('<img', '<img loading="lazy"', $html);
}
add_filter('the_content', 'optimize_book_images');
```

### Script Loading Optimization
```php
// Only load scripts when needed
function conditional_script_loading() {
    global $post;
    if (is_a($post, 'WP_Post') && has_shortcode($post->post_content, 'little_readers_store')) {
        // Scripts are automatically loaded by the plugin
    }
}
```

## Security Configuration

### API Key Management
Store sensitive configuration in wp-config.php:

```php
// In wp-config.php
define('LRP_API_KEY', 'your_secure_api_key_here');
define('LRP_BACKEND_URL', 'https://your-script-url.com');

// In plugin or theme
$api_key = defined('LRP_API_KEY') ? LRP_API_KEY : get_option('lrp_api_key');
```

### Content Security Policy
Add CSP headers for enhanced security:

```apache
# In .htaccess
Header set Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' script.google.com; style-src 'self' 'unsafe-inline' fonts.googleapis.com; font-src 'self' fonts.gstatic.com;"
```

## Troubleshooting Common Issues

### Issue: "Backend URL not configured"
```
Solution: Go to Settings > Little Readers and add your Google Apps Script URL
```

### Issue: Orders not submitting
```
Solution: Verify API key matches your Google Apps Script configuration
```

### Issue: Books not loading
```
Solution: Check Google Apps Script deployment and permissions
```

### Issue: Styling conflicts
```
Solution: Add CSS specificity or use !important declarations
```

This configuration guide should help you set up and customize the Little Readers UG plugin for your specific needs.