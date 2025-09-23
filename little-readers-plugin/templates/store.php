<div class="lrp-container">
    <section class="lrp-hero-section" aria-label="Welcome to Little Readers UG">
        <div class="lrp-hero-headline" tabindex="0">Little Readers UG Bookstore</div>
        <div class="lrp-hero-subtitle">Discover Affordable Pre-Loved Children's Books with Little Readers UG</div>
        <div class="lrp-hero-desc">
            Fill your child's library with magical stories that spark imagination and build a lifelong love of reading. Each book is unique—there's only one copy! Discover new treasures daily, but remember: once a story is claimed, it's gone. If you don't find the perfect book today, check back tomorrow. Our shelves are always changing. Happy reading!
        </div>
        <div class="lrp-yellow-bar" aria-hidden="true"></div>
        <a href="https://wa.me/256771675754" class="lrp-wa-contact-btn" target="_blank" title="Contact us on WhatsApp" aria-label="Contact us on WhatsApp">
            <svg aria-hidden="true" viewBox="0 0 32 32" fill="currentColor">
                <path d="M16.004 2.998c-7.17 0-13 5.833-13 13 0 2.294.625 4.519 1.797 6.477l-1.906 6.958a1.001 1.001 0 0 0 1.23 1.229l6.94-1.895a12.898 12.898 0 0 0 5.939 1.43h.003c7.168 0 13-5.833 13-13s-5.832-13-13-13zm0 23.999c-1.829 0-3.623-.471-5.21-1.367a1 1 0 0 0-.673-.104l-5.223 1.426 1.435-5.236a1 1 0 0 0-.104-.674 10.899 10.899 0 0 1-1.226-5.044c0-6.065 4.934-11 11-11s11 4.935 11 11-4.935 11-11 11zm6.206-7.553c-.339-.17-2.001-.985-2.31-1.098-.309-.114-.535-.17-.76.171s-.87 1.098-1.067 1.324c-.195.227-.39.255-.729.085-.339-.17-1.434-.528-2.73-1.68-1.009-.899-1.693-2.011-1.893-2.349-.195-.339-.021-.522.148-.691.154-.153.339-.396.509-.594.17-.198.227-.34.339-.567.113-.227.057-.426-.028-.595-.085-.17-.76-1.833-1.039-2.515-.273-.657-.55-.567-.76-.577-.197-.009-.426-.011-.655-.011a1.261 1.261 0 0 0-.915.426c-.312.34-1.189 1.162-1.189 2.835 0 1.672 1.219 3.286 1.389 3.513.17.227 2.401 3.672 5.822 4.901.814.281 1.449.449 1.943.575.816.208 1.56.179 2.146.109.655-.078 2.001-.819 2.283-1.61.282-.792.282-1.47.197-1.61-.085-.142-.312-.227-.65-.397z"></path>
            </svg>
            Contact us on WhatsApp
        </a>
    </section>
    
    <div class="lrp-status-bar" id="lrpStatusBar" role="alert" aria-live="assertive">
        ⚠️ Some books in your cart are no longer available: <span id="lrpStatusBarDetails"></span>
    </div>
    
    <div class="lrp-filters" aria-label="Book filters">
        <div class="lrp-filter-group">
            <label for="lrpCategoryFilter">Category</label>
            <select id="lrpCategoryFilter">
                <option value="">All Categories</option>
                <option value="Picture Books">Picture Books</option>
                <option value="Early Readers">Early Readers</option>
                <option value="Chapter Books">Chapter Books</option>
                <option value="Activity Books">Activity Books</option>
                <option value="Educational Books">Educational Books</option>
                <option value="Young Adult Fiction">Young Adult Fiction</option>
            </select>
        </div>
        <div class="lrp-filter-group">
            <label for="lrpAgeFilter">Age Group</label>
            <select id="lrpAgeFilter">
                <option value="">All Ages</option>
                <option value="0-3 years">0-3 years</option>
                <option value="4-6 years">4-6 years</option>
                <option value="7-9 years">7-9 years</option>
                <option value="10-15 years">10-15 years</option>
                <option value="16+ years">16+ years</option>
            </select>
        </div>
        <div class="lrp-filter-group">
            <label for="lrpPriceFilter">Price Range</label>
            <select id="lrpPriceFilter">
                <option value="">All Prices</option>
                <option value="0-10000">Under 10,000 UGX</option>
                <option value="10000-20000">10,000 - 20,000 UGX</option>
                <option value="20000+">Above 20,000 UGX</option>
            </select>
        </div>
        <div class="lrp-filter-group">
            <label for="lrpSearchBox">Search</label>
            <input type="text" id="lrpSearchBox" placeholder="Search books..." autocomplete="off" />
        </div>
        <button type="button" class="lrp-reset-filters-btn" id="lrpResetFiltersBtn" aria-label="Reset filters">Reset Filters</button>
    </div>
    
    <div class="lrp-loading" id="lrpLoadingSpinner" aria-live="polite">
        <div class="lrp-spinner" aria-hidden="true"></div>
        <p style="color:var(--green);font-size:1.1em;">Loading amazing books...</p>
    </div>
    
    <div class="lrp-books-grid" id="lrpBooksGrid" role="list">
        <!-- Books will be loaded here -->
    </div>
</div>

<button class="lrp-cart" id="lrpCart" aria-label="View cart" tabindex="0">
    🛒 Cart <span class="lrp-cart-count" id="lrpCartCount" aria-live="polite">0</span>
</button>

<div class="lrp-checkout-modal" id="lrpCheckoutModal" aria-modal="true" role="dialog" aria-label="Checkout Modal">
    <div class="lrp-checkout-content">
        <button class="lrp-close-modal" id="lrpCloseModalBtn" aria-label="Close checkout modal">&times;</button>
        <div class="lrp-checkout-header">
            <h2>🛒 Complete Your Order</h2>
            <p>You're just one step away from amazing books!</p>
        </div>
        <div class="lrp-cart-items" id="lrpCartItems">
            <!-- Cart items will be shown here -->
        </div>
        <form id="lrpOrderForm" autocomplete="off" novalidate>
            <div class="lrp-form-group">
                <label for="lrpCustomerName">Full Name*</label>
                <input type="text" id="lrpCustomerName" required aria-required="true" autocomplete="name">
            </div>
            <div class="lrp-form-group">
                <label for="lrpCustomerPhone">Phone Number * (Uganda only)</label>
                <input type="tel" id="lrpCustomerPhone" value="+256" required pattern="^\+256\d{9}$" maxlength="13" autocomplete="tel" style="letter-spacing:1.5px;">
                <small style="color:#ad3333;">Format: +2567XXXXXXXX</small>
            </div>
            <div class="lrp-form-group">
                <label for="lrpDeliveryArea">Delivery Area *</label>
                <input type="text" id="lrpDeliveryArea" list="lrpAreasList" placeholder="Start typing area (e.g. Ntinda, Kira, etc)" autocomplete="off" required aria-required="true" />
                <datalist id="lrpAreasList"></datalist>
                <div id="lrpAreaFeeMsg" style="margin-top:7px;color:#ad8507;font-weight:bold;"></div>
                <div id="lrpAreaErrorMsg" style="margin-top:4px;color:#ad3333;"></div>
            </div>
            <div class="lrp-form-group">
                <label for="lrpDeliveryNotes">Delivery Address/Pickup Notes</label>
                <textarea id="lrpDeliveryNotes" rows="2" placeholder="Please provide detailed delivery address or pickup arrangements"></textarea>
            </div>
            <div class="lrp-form-group" id="lrpPromoCodeGroup">
                <label for="lrpPromoCode">Promo Code</label>
                <div id="lrpPromoInputContainer" style="display:flex;gap:10px;">
                    <input type="text" id="lrpPromoCode" placeholder="Enter promo code" style="flex-grow:1;">
                    <button type="button" id="lrpApplyPromoBtn" style="background:var(--green);color:white;border:none;border-radius:7px;padding:0 15px;cursor:pointer;">Apply</button>
                </div>
                <div id="lrpPromoErrorMsg" style="margin-top:4px;color:#ad3333;"></div>
                <div id="lrpPromoAppliedContainer" class="lrp-promo-applied-msg" style="display:none;">
                    <span id="lrpPromoInfoText" class="lrp-promo-info"></span>
                    <button type="button" class="lrp-promo-remove-btn" id="lrpRemovePromoBtn">Remove</button>
                </div>
            </div>
            <div class="lrp-order-summary" aria-label="Order summary">
                <h3>Order Summary</h3>
                <div class="lrp-summary-row">
                    <span>Books Subtotal:</span>
                    <span id="lrpSubtotal">0 UGX</span>
                </div>
                <div id="lrpDiscountRow" class="lrp-summary-row discount-row" style="display:none;">
                    <span>Discount:</span>
                    <span id="lrpDiscountAmount">0 UGX</span>
                </div>
                <div class="lrp-summary-row">
                    <span>Delivery Fee:</span>
                    <span id="lrpDeliveryFee">Not selected</span>
                </div>
                <div class="lrp-summary-row total">
                    <span>Total Amount:</span>
                    <span id="lrpTotalAmount">0 UGX</span>
                </div>
            </div>
            <button type="submit" class="lrp-submit-order">Place Order</button>
        </form>
        <div class="lrp-success-message" id="lrpSuccessMessage" role="status" aria-live="polite"></div>
        <div style="text-align:center;margin-top:13px;">
            <a href="https://wa.me/256771675754" class="lrp-wa-contact-btn" target="_blank" title="Contact us on WhatsApp" aria-label="Chat with us on WhatsApp">
                <svg aria-hidden="true" viewBox="0 0 32 32" fill="currentColor">
                    <path d="M16.004 2.998c-7.17 0-13 5.833-13 13 0 2.294.625 4.519 1.797 6.477l-1.906 6.958a1.001 1.001 0 0 0 1.23 1.229l6.94-1.895a12.898 12.898 0 0 0 5.939 1.43h.003c7.168 0 13-5.833 13-13s-5.832-13-13-13zm0 23.999c-1.829 0-3.623-.471-5.21-1.367a1 1 0 0 0-.673-.104l-5.223 1.426 1.435-5.236a1 1 0 0 0-.104-.674 10.899 10.899 0 0 1-1.226-5.044c0-6.065 4.934-11 11-11s11 4.935 11 11-4.935 11-11 11zm6.206-7.553c-.339-.17-2.001-.985-2.31-1.098-.309-.114-.535-.17-.76.171s-.87 1.098-1.067 1.324c-.195.227-.39.255-.729.085-.339-.17-1.434-.528-2.73-1.68-1.009-.899-1.693-2.011-1.893-2.349-.195-.339-.021-.522.148-.691.154-.153.339-.396.509-.594.17-.198.227-.34.339-.567.113-.227.057-.426-.028-.595-.085-.17-.76-1.833-1.039-2.515-.273-.657-.55-.567-.76-.577-.197-.009-.426-.011-.655-.011a1.261 1.261 0 0 0-.915.426c-.312.34-1.189 1.162-1.189 2.835 0 1.672 1.219 3.286 1.389 3.513.17.227 2.401 3.672 5.822 4.901.814.281 1.449.449 1.943.575.816.208 1.56.179 2.146.109.655-.078 2.001-.819 2.283-1.61.282-.792.282-1.47.197-1.61-.085-.142-.312-.227-.65-.397z"></path>
                </svg>
                Chat with us on WhatsApp
            </a>
        </div>
    </div>
</div>