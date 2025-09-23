# Little Readers UG WordPress Plugin

A WordPress plugin that integrates with the Google Apps Script backend for Little Readers UG bookstore. This plugin maintains all functionality and design from the original web app to ensure a seamless migration.

## Features

- **Complete Bookstore Integration**: Displays books with filtering by category, age group, and price
- **Shopping Cart**: Full cart functionality with add/remove items
- **Checkout System**: Complete order processing with customer details and delivery information
- **Delivery Areas**: Dynamic delivery area selection with pricing
- **Promo Codes**: Support for promotional codes with discount calculation
- **Caching**: Optimized performance with 3-hour caching for delivery areas and 1-hour caching for promo codes
- **Responsive Design**: Mobile-friendly interface that matches the original design
- **WhatsApp Integration**: Direct contact links for customer support

## Installation

1. Download the plugin files
2. Upload the `little-readers-plugin` folder to your WordPress `/wp-content/plugins/` directory
3. Activate the plugin through the 'Plugins' menu in WordPress
4. Configure the plugin settings

## Configuration

### Plugin Settings

1. Go to **Settings > Little Readers** in your WordPress admin
2. Configure the following options:
   - **Backend URL**: Enter your Google Apps Script web app URL
   - **API Key**: Enter your API key (default: `LRU_WebApp_Key_2025`)

### Google Apps Script Setup

Your Google Apps Script should be deployed as a web app with the following endpoints:
- `getBooks` - Get available books
- `checkAvailability` - Check book availability
- `deliveryPrice` - Get delivery pricing for an area
- `deliveryAreas` - Get all delivery areas
- `validatePromo` - Validate promo codes
- `processOrder` - Process customer orders

## Usage

### Display the Bookstore

Use the shortcode `[little_readers_store]` to display the bookstore on any page or post:

```php
[little_readers_store]
```

You can also override the backend URL and API key for specific instances:

```php
[little_readers_store backend_url="https://your-script-url.com" api_key="your-api-key"]
```

### Example Page Setup

Create a new page in WordPress and add the shortcode:

```
## Welcome to Little Readers UG

Discover amazing pre-loved children's books!

[little_readers_store]
```

## Caching

The plugin implements intelligent caching to reduce API calls:

- **Delivery Areas**: Cached for 3 hours
- **Promo Codes**: Cached for 1 hour
- **Cache Keys**: 
  - `lrp_delivery_areas` - Delivery areas cache
  - `lrp_promo_{hash}` - Promo code cache (hashed by code)

### Manual Cache Clearing

Caches are automatically cleared when the plugin is deactivated. To manually clear specific caches:

```php
delete_transient('lrp_delivery_areas');
// For promo codes, you'll need to know the specific hash
```

## API Integration

The plugin acts as a proxy between WordPress and your Google Apps Script backend, handling:

- Authentication with API keys
- Data sanitization and validation
- Error handling and user feedback
- Caching for performance optimization

## Customization

### Styling

The plugin uses CSS custom properties (variables) for easy customization:

```css
:root {
  --green: #647e46;
  --offwhite: #f8f8f5;
  --yellow: #f9b233;
  --accent: #e5e5e5;
  --text: #233018;
  --font-head: 'Lora', serif;
  --font-body: 'Montserrat', sans-serif;
  --error: #ad3333;
  --focus: #e09e1b;
}
```

### JavaScript Hooks

The plugin provides global JavaScript functions that can be customized:

- `lrpAddToCart(bookCode, event)` - Add item to cart
- `lrpOpenCheckout()` - Open checkout modal
- `lrpCloseCheckout()` - Close checkout modal
- `lrpResetFilters()` - Reset all filters

## Troubleshooting

### Common Issues

1. **Books not loading**: Check that the backend URL is correct and the Google Apps Script is deployed
2. **Orders not submitting**: Verify the API key matches your Google Apps Script configuration
3. **Delivery areas not loading**: Check if the `deliveryAreas` endpoint is working
4. **Styling issues**: Ensure no theme CSS is conflicting with plugin styles

### Debug Mode

To enable debug mode, add this to your `wp-config.php`:

```php
define('WP_DEBUG', true);
define('WP_DEBUG_LOG', true);
```

Check `/wp-content/debug.log` for any error messages.

## Security

- All user inputs are sanitized and validated
- AJAX requests use WordPress nonces for security
- API communications are secured with configurable API keys
- XSS protection through proper HTML escaping

## Performance

- Optimized AJAX calls with intelligent caching
- Conditional script loading (only loads when shortcode is present)
- Minified assets for faster loading
- Efficient database queries with WordPress transients

## Browser Support

- Chrome 70+
- Firefox 65+
- Safari 12+
- Edge 79+
- Mobile browsers (iOS Safari, Chrome Mobile)

## License

GPL v2 or later

## Support

For support and customization requests, contact the development team or visit the WhatsApp link provided in the plugin interface.

## Changelog

### Version 1.0.0
- Initial release
- Full bookstore functionality
- Caching implementation
- Responsive design
- WordPress integration complete