<?php
/**
 * Plugin Name: Little Readers UG Bookstore
 * Plugin URI: https://github.com/paulkisakye-beep/Little-Readers-Plugin
 * Description: WordPress plugin for Little Readers UG bookstore that integrates with Google Apps Script backend. Maintains all functionality and design from the original web app.
 * Version: 1.0.0
 * Author: Paul Kisakye
 * Author URI: https://github.com/paulkisakye-beep
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: little-readers-plugin
 * Domain Path: /languages
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Define plugin constants
define('LRP_PLUGIN_URL', plugin_dir_url(__FILE__));
define('LRP_PLUGIN_PATH', plugin_dir_path(__FILE__));
define('LRP_VERSION', '1.0.0');

class LittleReadersPlugin {
    
    public function __construct() {
        add_action('init', array($this, 'init'));
        add_action('wp_enqueue_scripts', array($this, 'enqueue_scripts'));
        add_shortcode('little_readers_store', array($this, 'render_store_shortcode'));
        add_action('wp_ajax_lrp_api_proxy', array($this, 'handle_api_proxy'));
        add_action('wp_ajax_nopriv_lrp_api_proxy', array($this, 'handle_api_proxy'));
        add_action('admin_menu', array($this, 'add_admin_menu'));
        
        // Activation and deactivation hooks
        register_activation_hook(__FILE__, array($this, 'activate'));
        register_deactivation_hook(__FILE__, array($this, 'deactivate'));
    }
    
    public function init() {
        // Initialize plugin
        load_plugin_textdomain('little-readers-plugin', false, dirname(plugin_basename(__FILE__)) . '/languages');
    }
    
    public function enqueue_scripts() {
        // Enqueue CSS and JS only when shortcode is present
        global $post;
        if (is_a($post, 'WP_Post') && has_shortcode($post->post_content, 'little_readers_store')) {
            wp_enqueue_style('little-readers-style', LRP_PLUGIN_URL . 'assets/css/style.css', array(), LRP_VERSION);
            wp_enqueue_script('little-readers-script', LRP_PLUGIN_URL . 'assets/js/script.js', array('jquery'), LRP_VERSION, true);
            
            // Localize script for AJAX
            wp_localize_script('little-readers-script', 'lrp_ajax', array(
                'ajax_url' => admin_url('admin-ajax.php'),
                'nonce' => wp_create_nonce('lrp_nonce')
            ));
        }
    }
    
    public function render_store_shortcode($atts) {
        $atts = shortcode_atts(array(
            'backend_url' => get_option('lrp_backend_url', ''),
            'api_key' => get_option('lrp_api_key', 'LRU_WebApp_Key_2025')
        ), $atts, 'little_readers_store');
        
        if (empty($atts['backend_url'])) {
            return '<div class="lrp-error">Please configure the backend URL in the plugin settings.</div>';
        }
        
        ob_start();
        include LRP_PLUGIN_PATH . 'templates/store.php';
        return ob_get_clean();
    }
    
    public function handle_api_proxy() {
        // Verify nonce
        if (!wp_verify_nonce($_POST['nonce'], 'lrp_nonce')) {
            wp_die('Security check failed');
        }
        
        $action = sanitize_text_field($_POST['api_action']);
        $backend_url = get_option('lrp_backend_url', '');
        $api_key = get_option('lrp_api_key', 'LRU_WebApp_Key_2025');
        
        if (empty($backend_url)) {
            wp_send_json_error('Backend URL not configured');
        }
        
        // Handle different API actions
        switch ($action) {
            case 'getBooks':
                $this->proxy_get_books($backend_url);
                break;
            case 'checkAvailability':
                $this->proxy_check_availability($backend_url, $_POST);
                break;
            case 'deliveryPrice':
                $this->proxy_delivery_price($backend_url, $_POST);
                break;
            case 'deliveryAreas':
                $this->proxy_delivery_areas($backend_url);
                break;
            case 'validatePromo':
                $this->proxy_validate_promo($backend_url, $_POST);
                break;
            case 'processOrder':
                $this->proxy_process_order($backend_url, $api_key, $_POST);
                break;
            default:
                wp_send_json_error('Invalid action');
        }
    }
    
    private function proxy_get_books($backend_url) {
        $url = $backend_url . '?action=getBooks';
        $response = wp_remote_get($url, array('timeout' => 30));
        
        if (is_wp_error($response)) {
            error_log('LRP: Failed to fetch books - ' . $response->get_error_message());
            wp_send_json_error('Failed to fetch books: ' . $response->get_error_message());
        }
        
        $response_code = wp_remote_retrieve_response_code($response);
        if ($response_code !== 200) {
            error_log('LRP: Books API returned status ' . $response_code);
            wp_send_json_error('Backend returned status ' . $response_code);
        }
        
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            error_log('LRP: Invalid JSON response from books API: ' . $body);
            wp_send_json_error('Invalid response from backend');
        }
        
        // Check if the Google Apps Script response is successful and extract books
        if (isset($data['success']) && $data['success'] && isset($data['books'])) {
            wp_send_json_success($data['books']);
        } else {
            $error_msg = 'Failed to load books from backend';
            if (isset($data['error'])) {
                $error_msg .= ': ' . $data['error'];
            } elseif (!isset($data['success'])) {
                $error_msg .= ': No success field in response';
            } elseif (!$data['success']) {
                $error_msg .= ': Backend returned success=false';
            } elseif (!isset($data['books'])) {
                $error_msg .= ': No books field in response';
            }
            error_log('LRP: ' . $error_msg . ' - Response: ' . $body);
            wp_send_json_error($error_msg);
        }
    }
    
    private function proxy_check_availability($backend_url, $post_data) {
        $codes = sanitize_text_field($post_data['codes']);
        $url = $backend_url . '?action=checkAvailability&codes=' . urlencode($codes);
        $response = wp_remote_get($url, array('timeout' => 30));
        
        if (is_wp_error($response)) {
            error_log('LRP: Failed to check availability - ' . $response->get_error_message());
            wp_send_json_error('Failed to check availability: ' . $response->get_error_message());
        }
        
        $response_code = wp_remote_retrieve_response_code($response);
        if ($response_code !== 200) {
            error_log('LRP: Check availability API returned status ' . $response_code);
            wp_send_json_error('Backend returned status ' . $response_code);
        }
        
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            error_log('LRP: Invalid JSON response from check availability API: ' . $body);
            wp_send_json_error('Invalid response from backend');
        }
        
        wp_send_json_success($data);
    }
    
    private function proxy_delivery_price($backend_url, $post_data) {
        $area = sanitize_text_field($post_data['area']);
        
        // Clear cache flag for testing
        $clear_cache = isset($post_data['clear_cache']) && $post_data['clear_cache'] === 'true';
        if ($clear_cache) {
            delete_transient('lrp_delivery_areas');
            delete_transient('lrp_delivery_price_' . md5($area));
            error_log('LRP: Cleared delivery cache for debugging');
        }
        
        $url = $backend_url . '?action=deliveryPrice&area=' . urlencode($area);
        $response = wp_remote_get($url, array('timeout' => 30));
        
        if (is_wp_error($response)) {
            error_log('LRP: Failed to get delivery price - ' . $response->get_error_message());
            wp_send_json_error('Failed to get delivery price: ' . $response->get_error_message());
        }
        
        $response_code = wp_remote_retrieve_response_code($response);
        if ($response_code !== 200) {
            error_log('LRP: Delivery price API returned status ' . $response_code);
            wp_send_json_error('Backend returned status ' . $response_code);
        }
        
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            error_log('LRP: Invalid JSON response from delivery price API: ' . $body);
            wp_send_json_error('Invalid response from backend');
        }
        
        error_log('LRP: Delivery price response for area "' . $area . '": ' . $body);
        wp_send_json_success($data);
    }
    
    private function proxy_delivery_areas($backend_url) {
        // Check cache first (3 hours = 10800 seconds)
        $cache_key = 'lrp_delivery_areas';
        $cached_data = get_transient($cache_key);
        
        if ($cached_data !== false) {
            wp_send_json_success($cached_data);
            return;
        }
        
        $url = $backend_url . '?action=deliveryAreas';
        $response = wp_remote_get($url, array('timeout' => 30));
        
        if (is_wp_error($response)) {
            error_log('LRP: Failed to get delivery areas - ' . $response->get_error_message());
            wp_send_json_error('Failed to get delivery areas: ' . $response->get_error_message());
        }
        
        $response_code = wp_remote_retrieve_response_code($response);
        if ($response_code !== 200) {
            error_log('LRP: Delivery areas API returned status ' . $response_code);
            wp_send_json_error('Backend returned status ' . $response_code);
        }
        
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            error_log('LRP: Invalid JSON response from delivery areas API: ' . $body);
            wp_send_json_error('Invalid response from backend');
        }
        
        // Cache for 3 hours
        set_transient($cache_key, $data, 3 * HOUR_IN_SECONDS);
        
        wp_send_json_success($data);
    }
    
    private function proxy_validate_promo($backend_url, $post_data) {
        $code = sanitize_text_field($post_data['code']);
        
        // Check cache first (1 hour = 3600 seconds)
        $cache_key = 'lrp_promo_' . md5($code);
        $cached_data = get_transient($cache_key);
        
        if ($cached_data !== false) {
            wp_send_json_success($cached_data);
            return;
        }
        
        $url = $backend_url . '?action=validatePromo&code=' . urlencode($code);
        $response = wp_remote_get($url, array('timeout' => 30));
        
        if (is_wp_error($response)) {
            error_log('LRP: Failed to validate promo code - ' . $response->get_error_message());
            wp_send_json_error('Failed to validate promo code: ' . $response->get_error_message());
        }
        
        $response_code = wp_remote_retrieve_response_code($response);
        if ($response_code !== 200) {
            error_log('LRP: Validate promo API returned status ' . $response_code);
            wp_send_json_error('Backend returned status ' . $response_code);
        }
        
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            error_log('LRP: Invalid JSON response from validate promo API: ' . $body);
            wp_send_json_error('Invalid response from backend');
        }
        
        // Cache for 1 hour
        set_transient($cache_key, $data, HOUR_IN_SECONDS);
        
        wp_send_json_success($data);
    }
    
    private function proxy_process_order($backend_url, $api_key, $post_data) {
        $order_data = json_decode(stripslashes($post_data['order_data']), true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            error_log('LRP: Invalid order data JSON: ' . $post_data['order_data']);
            wp_send_json_error('Invalid order data');
        }
        
        // Add API key as a query parameter
        $url = $backend_url . '?apiKey=' . urlencode($api_key);
        
        $response = wp_remote_post($url, array(
            'method' => 'POST',
            'timeout' => 45,
            'body' => json_encode($order_data),
            'headers' => array(
                'Content-Type' => 'application/json'
            )
        ));
        
        if (is_wp_error($response)) {
            error_log('LRP: Failed to process order - ' . $response->get_error_message());
            wp_send_json_error('Failed to process order: ' . $response->get_error_message());
        }
        
        $response_code = wp_remote_retrieve_response_code($response);
        if ($response_code !== 200) {
            error_log('LRP: Process order API returned status ' . $response_code);
            wp_send_json_error('Backend returned status ' . $response_code);
        }
        
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            error_log('LRP: Invalid JSON response from process order API: ' . $body);
            wp_send_json_error('Invalid response from backend');
        }
        
        error_log('LRP: Order processing response: ' . $body);
        wp_send_json_success($data);
    }
    
    public function add_admin_menu() {
        add_options_page(
            'Little Readers Settings',
            'Little Readers',
            'manage_options',
            'little-readers-settings',
            array($this, 'admin_page')
        );
    }
    
    public function admin_page() {
        if (isset($_POST['submit'])) {
            update_option('lrp_backend_url', sanitize_url($_POST['backend_url']));
            update_option('lrp_api_key', sanitize_text_field($_POST['api_key']));
            echo '<div class="notice notice-success"><p>Settings saved!</p></div>';
        }
        
        $backend_url = get_option('lrp_backend_url', '');
        $api_key = get_option('lrp_api_key', 'LRU_WebApp_Key_2025');
        
        ?>
        <div class="wrap">
            <h1>Little Readers Settings</h1>
            <form method="post" action="">
                <table class="form-table">
                    <tr>
                        <th scope="row">Backend URL</th>
                        <td>
                            <input type="url" name="backend_url" value="<?php echo esc_attr($backend_url); ?>" class="regular-text" required />
                            <p class="description">Enter the Google Apps Script web app URL</p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">API Key</th>
                        <td>
                            <input type="text" name="api_key" value="<?php echo esc_attr($api_key); ?>" class="regular-text" />
                            <p class="description">API key for the backend service</p>
                        </td>
                    </tr>
                </table>
                <?php submit_button(); ?>
            </form>
        </div>
        <?php
    }
    
    public function activate() {
        // Create options with default values
        add_option('lrp_backend_url', '');
        add_option('lrp_api_key', 'LRU_WebApp_Key_2025');
    }
    
    public function deactivate() {
        // Clean up transients
        delete_transient('lrp_delivery_areas');
        
        // Clean up promo code caches (this is a simplified approach)
        global $wpdb;
        $wpdb->query("DELETE FROM {$wpdb->options} WHERE option_name LIKE '_transient_lrp_promo_%'");
        $wpdb->query("DELETE FROM {$wpdb->options} WHERE option_name LIKE '_transient_timeout_lrp_promo_%'");
    }
}

// Initialize the plugin
new LittleReadersPlugin();