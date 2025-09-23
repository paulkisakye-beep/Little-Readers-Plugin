=== Little Readers UG Bookstore ===
Contributors: paulkisakye
Tags: bookstore, ecommerce, google-apps-script, children-books, shopping-cart
Requires at least: 5.0
Tested up to: 6.4
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

WordPress plugin for Little Readers UG bookstore that integrates with Google Apps Script backend.

== Description ==

Little Readers UG Bookstore is a WordPress plugin that provides a complete online bookstore experience for pre-loved children's books. It integrates seamlessly with a Google Apps Script backend to maintain inventory, process orders, and handle customer communications.

**Key Features:**

* Complete bookstore with book grid, filtering, and search
* Shopping cart functionality with persistent storage
* Checkout system with customer information and delivery options
* Delivery area selection with dynamic pricing
* Promo code system with discount calculation
* Responsive design optimized for all devices
* Caching for optimal performance (3 hours for delivery areas, 1 hour for promo codes)
* WhatsApp integration for customer support
* Admin settings panel for easy configuration

**Perfect for:**

* Independent bookstores transitioning from Google Apps Script
* Children's book retailers
* Non-profit organizations selling books
* Educational institutions with book sales

== Installation ==

1. Upload the plugin files to the `/wp-content/plugins/little-readers-plugin` directory, or install the plugin through the WordPress plugins screen directly.
2. Activate the plugin through the 'Plugins' screen in WordPress.
3. Use the Settings > Little Readers screen to configure the plugin.
4. Add the `[little_readers_store]` shortcode to any page or post where you want the bookstore to appear.

== Frequently Asked Questions ==

= How do I set up the Google Apps Script backend? =

You'll need to deploy your Google Apps Script as a web app and provide the URL in the plugin settings. The script should handle the following API endpoints: getBooks, checkAvailability, deliveryPrice, deliveryAreas, validatePromo, and processOrder.

= Can I customize the appearance? =

Yes! The plugin uses CSS custom properties that make it easy to customize colors, fonts, and spacing. You can override the default styles in your theme's CSS.

= How does caching work? =

The plugin automatically caches delivery areas for 3 hours and promo codes for 1 hour to reduce API calls and improve performance. Caches are cleared when the plugin is deactivated.

= Is the plugin mobile-friendly? =

Absolutely! The plugin is fully responsive and provides an excellent experience on all devices, from mobile phones to desktop computers.

== Screenshots ==

1. Main bookstore display with filtering options
2. Book grid showing available books
3. Shopping cart modal with order summary
4. Checkout form with delivery options
5. Admin settings panel

== Changelog ==

= 1.0.0 =
* Initial release
* Complete bookstore functionality
* Google Apps Script integration
* Caching implementation
* Responsive design
* Admin configuration panel

== Upgrade Notice ==

= 1.0.0 =
Initial release of the Little Readers UG Bookstore plugin.