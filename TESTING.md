# Little Readers UG Plugin Testing Guide

## Pre-Installation Testing

### 1. File Structure Validation
```bash
# Check if all required files exist
ls -la little-readers-plugin/
# Should show:
# - little-readers-plugin.php (main plugin file)
# - assets/css/style.css
# - assets/js/script.js
# - templates/store.php
# - readme.txt
```

### 2. PHP Syntax Check
```bash
# Test PHP syntax
php -l little-readers-plugin/little-readers-plugin.php
# Should return: "No syntax errors detected"
```

## Post-Installation Testing

### 1. Plugin Activation
1. Upload plugin to `/wp-content/plugins/`
2. Activate through WordPress admin
3. Check for any activation errors

### 2. Settings Configuration
1. Go to Settings > Little Readers
2. Add your Google Apps Script URL
3. Verify API key setting
4. Save settings

### 3. Shortcode Testing
1. Create a new page
2. Add `[little_readers_store]` shortcode
3. Preview/publish page
4. Check for proper display

### 4. Functionality Testing

#### Books Display
- [ ] Books grid loads properly
- [ ] Book images display correctly
- [ ] Book information shows (title, author, price, etc.)
- [ ] Loading spinner appears during fetch

#### Filtering System
- [ ] Category filter works
- [ ] Age group filter works
- [ ] Price range filter works
- [ ] Search box functions
- [ ] Reset filters button works

#### Shopping Cart
- [ ] Add to cart button works
- [ ] Cart count updates
- [ ] Cart icon shows correct count
- [ ] Cart persists on page reload

#### Checkout Process
- [ ] Cart modal opens correctly
- [ ] Customer form validation works
- [ ] Phone number format validation
- [ ] Delivery area selection works
- [ ] Order summary calculates correctly

#### Promo Codes
- [ ] Promo code input accepts codes
- [ ] Valid codes apply discounts
- [ ] Invalid codes show error messages
- [ ] Discount calculation is correct

#### Delivery System
- [ ] Delivery areas load from cache/API
- [ ] Area selection updates pricing
- [ ] Free delivery threshold works
- [ ] Invalid areas show error messages

### 5. Mobile Responsiveness
- [ ] Layout works on mobile devices
- [ ] Touch interactions work properly
- [ ] Text is readable on small screens
- [ ] Buttons are appropriately sized

### 6. Performance Testing
- [ ] Caching works (check network tab)
- [ ] Page load time is reasonable
- [ ] No console errors
- [ ] API calls are minimal

## Common Issues and Solutions

### Plugin Doesn't Activate
- Check PHP version (requires 7.4+)
- Verify file permissions
- Check for conflicting plugins

### Books Don't Load
- Verify Google Apps Script URL is correct
- Check API key configuration
- Ensure CORS is properly configured
- Check browser console for errors

### Styles Don't Apply
- Check for theme CSS conflicts
- Verify CSS file is loading
- Clear any caching plugins

### Cart Issues
- Check if localStorage is available
- Verify JavaScript is enabled
- Check for JavaScript errors

### Checkout Problems
- Verify Google Apps Script POST endpoint
- Check API key in headers
- Ensure proper JSON formatting

## Debug Mode

Enable WordPress debug mode by adding to `wp-config.php`:
```php
define('WP_DEBUG', true);
define('WP_DEBUG_LOG', true);
define('WP_DEBUG_DISPLAY', false);
```

Check `/wp-content/debug.log` for any errors.

## Testing Checklist Summary

- [ ] Plugin installs without errors
- [ ] Settings page accessible and functional
- [ ] Shortcode renders correctly
- [ ] Books load and display properly
- [ ] All filters work as expected
- [ ] Shopping cart functions correctly
- [ ] Checkout process completes
- [ ] Mobile experience is optimized
- [ ] No console errors present
- [ ] Caching improves performance

## Support

If you encounter issues:
1. Check this testing guide
2. Review browser console for errors
3. Check WordPress error logs
4. Verify Google Apps Script configuration
5. Contact support with specific error details