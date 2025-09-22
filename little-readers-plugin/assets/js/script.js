/**
 * Little Readers UG Bookstore Plugin JavaScript
 * WordPress adapted version
 */

jQuery(document).ready(function($) {
    let books = [];
    let cart = [];
    let deliveryAreasList = [];
    let selectedDeliveryFee = null;
    let lastFocusedElement = null;
    let activePromo = null; // { code: string, discount: number }

    // Global functions for onclick handlers and event listeners
    window.lrpAddToCart = function(bookCode, evt) {
        const book = books.find(b => b.code === bookCode);
        if (!book || !book.available) {
            alert('Sorry, this book is no longer available!');
            return;
        }
        if (cart.find(item => item.code === bookCode)) {
            alert('This book is already in your cart!');
            return;
        }
        cart.push(book);
        updateCartCount(true);
        saveCart();
        if (evt && evt.target) {
            evt.target.innerHTML = '✅ Added!';
            evt.target.disabled = true;
            setTimeout(() => {
                evt.target.innerHTML = 'Add to Cart';
                evt.target.disabled = false;
            }, 1000);
        }
    };

    window.lrpOpenCheckout = function() {
        if (cart.length === 0) {
            alert('Your cart is empty! Add some books first.');
            return;
        }
        updateCartDisplay();
        const modal = document.getElementById('lrpCheckoutModal');
        if (modal) {
            modal.style.display = 'block';
            document.body.style.overflow = 'hidden';
            lastFocusedElement = document.activeElement;
            resetOrderForm();
            trapFocus(modal);
            validateCartBooks();
        }
    };

    window.lrpCloseCheckout = function() {
        const modal = document.getElementById('lrpCheckoutModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
            hideStatusBar();
            if (lastFocusedElement) lastFocusedElement.focus();
        }
    };

    window.lrpRemoveFromCart = function(index) {
        cart.splice(index, 1);
        updateCartCount(true);
        saveCart();
        updateCartDisplay();
        if (cart.length === 0) lrpCloseCheckout();
    };

    window.lrpResetFilters = function() {
        const categoryFilter = document.getElementById('lrpCategoryFilter');
        const ageFilter = document.getElementById('lrpAgeFilter');
        const priceFilter = document.getElementById('lrpPriceFilter');
        const searchBox = document.getElementById('lrpSearchBox');
        
        if (categoryFilter) categoryFilter.value = '';
        if (ageFilter) ageFilter.value = '';
        if (priceFilter) priceFilter.value = '';
        if (searchBox) searchBox.value = '';
        displayBooks(books);
    };

    // Initialize plugin
    initializePlugin();

    function initializePlugin() {
        loadBooks();
        setupEventListeners();
        loadDeliveryAreas();
        loadCart();
        setupPhoneInput();
    }

    function setupPhoneInput() {
        const phoneInput = document.getElementById('lrpCustomerPhone');
        if (phoneInput) {
            phoneInput.addEventListener('input', function() {
                if (!phoneInput.value.startsWith('+256')) {
                    phoneInput.value = '+256';
                }
                phoneInput.value = '+256' + phoneInput.value.substring(4).replace(/\D/g, '');
                phoneInput.value = phoneInput.value.substring(0, 13);
            });
        }
    }

    function saveCart() {
        localStorage.setItem('littleReadersCart', JSON.stringify(cart));
    }

    function loadCart() {
        try {
            const data = localStorage.getItem('littleReadersCart');
            if (data) cart = JSON.parse(data);
            updateCartCount();
        } catch (e) { cart = []; }
    }

    function loadBooks() {
        const grid = document.getElementById('lrpBooksGrid');
        const loading = document.getElementById('lrpLoadingSpinner');
        if (loading) loading.style.display = 'block';
        if (grid) grid.innerHTML = '';

        console.log('LRP: Loading books from backend...');

        $.ajax({
            url: lrp_ajax.ajax_url,
            type: 'POST',
            data: {
                action: 'lrp_api_proxy',
                api_action: 'getBooks',
                nonce: lrp_ajax.nonce
            },
            success: function(response) {
                console.log('LRP: Books API response:', response);
                if (response.success) {
                    books = response.data;
                    console.log('LRP: Loaded', books.length, 'books');
                    displayBooks(books);
                    validateCartBooks();
                } else {
                    console.error('LRP: Failed to load books:', response.data);
                    if (grid) grid.innerHTML = '<p style="text-align:center; padding:50px;">Error loading books: ' + (response.data || 'Unknown error') + '</p>';
                }
                if (loading) loading.style.display = 'none';
            },
            error: function(xhr, status, error) {
                console.error('LRP: AJAX error loading books:', status, error, xhr.responseText);
                if (grid) grid.innerHTML = '<p style="text-align:center; padding:50px;">Error loading books. Please check console and refresh the page.</p>';
                if (loading) loading.style.display = 'none';
            }
        });
    }

    function displayBooks(booksToDisplay) {
        const grid = document.getElementById('lrpBooksGrid');
        if (!grid) return;
        
        grid.innerHTML = '';
        if (booksToDisplay.length === 0) {
            grid.innerHTML = `
                <div style="text-align:center; padding:60px; font-size:1.15em;color:#7a7a7a;">
                    No books available or matching your filters.<br>
                    <button type="button" class="lrp-reset-filters-btn" onclick="lrpResetFilters()">Reset Filters</button>
                </div>`;
            return;
        }
        booksToDisplay.forEach(book => {
            const bookCard = createBookCard(book);
            grid.appendChild(bookCard);
        });
    }

    function createBookCard(book) {
        const card = document.createElement('div');
        card.className = `lrp-book-card${!book.available ? ' sold-out' : ''}`;
        card.setAttribute('role', 'listitem');
        card.setAttribute('tabindex', '0');
        card.setAttribute('aria-label', `${book.title} by ${book.author}${book.available ? '' : ', unavailable'}`);

        let badge = '';
        if (!book.available) {
            if (book.status === 'reserved') {
                badge = `<div class="lrp-reserved-badge" title="Reserved by another customer. May become available soon.">RESERVED</div>`;
            } else if (book.status === 'sold') {
                badge = `<div class="lrp-sold-badge" title="This book has been sold.">SOLD</div>`;
            } else {
                badge = `<div class="lrp-unavailable-badge">UNAVAILABLE</div>`;
            }
        }

        card.innerHTML = `
            ${badge}
            <img src="${book.image}" alt="${escapeHTML(book.title)} book cover" class="lrp-book-image" loading="lazy"
                style="background:#f8f8f5;object-fit:contain;display:block;"
                onerror="this.src='https://via.placeholder.com/280x350?text=Book+Cover'" />
            <div class="lrp-book-info">
                <div class="lrp-book-title">${escapeHTML(book.title)}</div>
                <div class="lrp-book-author">by ${escapeHTML(book.author)}</div>
                <div class="lrp-book-category">${escapeHTML(book.category)}</div>
                <div class="lrp-book-price">UGX ${book.price ? Number(book.price).toLocaleString() : 'N/A'}</div>
                <div class="lrp-book-code">Code: ${escapeHTML(book.code)}</div>
                ${book.available ? `<button type="button" class="lrp-add-to-cart" onclick="lrpAddToCart('${escapeHTML(book.code)}', event)" aria-label="Add ${escapeHTML(book.title)} to cart">Add to Cart</button>` : ''}
            </div>
        `;
        return card;
    }

    function escapeHTML(str) {
        return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[m]);
    }

    function updateCartCount(animate = false) {
        const cartCount = document.getElementById('lrpCartCount');
        if (cartCount) {
            cartCount.textContent = cart.length;
            if (animate) {
                cartCount.classList.remove('cart-animate');
                void cartCount.offsetWidth;
                cartCount.classList.add('cart-animate');
            }
        }
        saveCart();
    }

    function trapFocus(element) {
        var focusableEls = element.querySelectorAll('a, button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])');
        var firstFocusableEl = focusableEls[0];
        var lastFocusableEl = focusableEls[focusableEls.length - 1];
        element.addEventListener('keydown', function(e) {
            if (e.key === 'Tab') {
                if (e.shiftKey) {
                    if (document.activeElement === firstFocusableEl) { e.preventDefault(); lastFocusableEl.focus(); }
                } else {
                    if (document.activeElement === lastFocusableEl) { e.preventDefault(); firstFocusableEl.focus(); }
                }
            }
            if (e.key === 'Escape') { lrpCloseCheckout(); }
        });
        if (firstFocusableEl) firstFocusableEl.focus();
    }

    function updateCartDisplay() {
        const cartItemsDiv = document.getElementById('lrpCartItems');
        if (!cartItemsDiv) return;
        
        cartItemsDiv.innerHTML = '<h3>Your Books:</h3>';
        let subtotal = 0;
        cart.forEach((book, index) => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'lrp-cart-item';
            const priceText = `UGX ${Number(book.price || 0).toLocaleString()}`;
            itemDiv.innerHTML = `
                <div>
                    <strong>${escapeHTML(book.title)}</strong><br>
                    <small>${escapeHTML(book.author)} - ${priceText}</small>
                </div>
                <button type="button" class="lrp-remove-item" onclick="lrpRemoveFromCart(${index})" aria-label="Remove ${escapeHTML(book.title)} from cart">Remove</button>
            `;
            cartItemsDiv.appendChild(itemDiv);
            subtotal += (book.price || 0);
        });
        updateOrderSummary(subtotal);
    }

    function updateOrderSummary(subtotal) {
        const subtotalEl = document.getElementById('lrpSubtotal');
        if (subtotalEl) subtotalEl.textContent = `UGX ${subtotal.toLocaleString()}`;
        
        const discountRow = document.getElementById('lrpDiscountRow');
        const discountAmountEl = document.getElementById('lrpDiscountAmount');
        
        let discountedSubtotal = subtotal;
        if (activePromo && activePromo.discount > 0) {
            const discountAmount = Math.round(subtotal * activePromo.discount);
            discountedSubtotal = subtotal - discountAmount;
            if (discountAmountEl) discountAmountEl.textContent = `- UGX ${discountAmount.toLocaleString()}`;
            if (discountRow) discountRow.style.display = 'flex';
        } else {
            if (discountRow) discountRow.style.display = 'none';
        }

        const deliveryFeeEl = document.getElementById('lrpDeliveryFee');
        const totalAmountEl = document.getElementById('lrpTotalAmount');
        
        if (selectedDeliveryFee === null) {
            if (deliveryFeeEl) deliveryFeeEl.textContent = 'Not selected';
            if (totalAmountEl) totalAmountEl.textContent = `UGX ${discountedSubtotal.toLocaleString()}`;
            return;
        }

        let finalDeliveryFee = selectedDeliveryFee;
        if (discountedSubtotal >= 300000 && selectedDeliveryFee > 0) {
            if (deliveryFeeEl) deliveryFeeEl.innerHTML = `<del>UGX ${selectedDeliveryFee.toLocaleString()}</del> FREE! 🎉`;
            finalDeliveryFee = 0;
        } else {
            if (deliveryFeeEl) deliveryFeeEl.textContent = selectedDeliveryFee === 0 ? 'FREE' : `UGX ${selectedDeliveryFee.toLocaleString()}`;
        }

        const total = discountedSubtotal + finalDeliveryFee;
        if (totalAmountEl) totalAmountEl.textContent = `UGX ${total.toLocaleString()}`;
    }

    function validatePromoCode() {
        const input = document.getElementById('lrpPromoCode');
        const code = (input ? input.value || '' : '').trim().toUpperCase();
        const errorMsg = document.getElementById('lrpPromoErrorMsg');
        const applyBtn = document.getElementById('lrpApplyPromoBtn');
        
        if (!code) {
            if (errorMsg) errorMsg.textContent = "Please enter a promo code.";
            return;
        }

        if (applyBtn) {
            applyBtn.textContent = "Checking...";
            applyBtn.disabled = true;
        }

        console.log('LRP: Validating promo code:', code);

        $.ajax({
            url: lrp_ajax.ajax_url,
            type: 'POST',
            data: {
                action: 'lrp_api_proxy',
                api_action: 'validatePromo',
                code: code,
                nonce: lrp_ajax.nonce
            },
            success: function(response) {
                console.log('LRP: Promo validation response:', response);
                console.log('LRP: Response data structure:', JSON.stringify(response, null, 2));
                
                if (response.success && response.data) {
                    if (response.data.valid) {
                        activePromo = { code: response.data.code, discount: response.data.discount };
                        if (errorMsg) errorMsg.textContent = "";
                        const promoInputContainer = document.getElementById('lrpPromoInputContainer');
                        const promoInfoText = document.getElementById('lrpPromoInfoText');
                        const promoAppliedContainer = document.getElementById('lrpPromoAppliedContainer');
                        
                        if (promoInputContainer) promoInputContainer.style.display = 'none';
                        if (promoInfoText) promoInfoText.textContent = `${response.data.code} (${Math.round(response.data.discount * 100)}% off) Applied!`;
                        if (promoAppliedContainer) promoAppliedContainer.style.display = 'flex';
                        console.log('LRP: Promo code applied successfully:', activePromo);
                    } else {
                        activePromo = null;
                        console.log('LRP: Promo code invalid:', response.data);
                        if (errorMsg) errorMsg.textContent = "Invalid or expired promo code.";
                    }
                } else {
                    activePromo = null;
                    console.error('LRP: Unexpected promo validation response structure:', response);
                    if (errorMsg) errorMsg.textContent = "Error validating promo code.";
                }
                updateOrderSummary(cart.reduce((sum, b) => sum + (b.price || 0), 0));
                if (applyBtn) {
                    applyBtn.textContent = "Apply";
                    applyBtn.disabled = false;
                }
            },
            error: function(xhr, status, error) {
                console.error('LRP: AJAX error validating promo code:', status, error, xhr.responseText);
                if (errorMsg) errorMsg.textContent = "Error validating code. Please try again.";
                if (applyBtn) {
                    applyBtn.textContent = "Apply";
                    applyBtn.disabled = false;
                }
            }
        });
    }
    
    function removePromo() {
        activePromo = null;
        const promoCode = document.getElementById('lrpPromoCode');
        const promoInputContainer = document.getElementById('lrpPromoInputContainer');
        const promoAppliedContainer = document.getElementById('lrpPromoAppliedContainer');
        const promoErrorMsg = document.getElementById('lrpPromoErrorMsg');
        
        if (promoCode) promoCode.value = '';
        if (promoInputContainer) promoInputContainer.style.display = 'flex';
        if (promoAppliedContainer) promoAppliedContainer.style.display = 'none';
        if (promoErrorMsg) promoErrorMsg.textContent = '';
        updateOrderSummary(cart.reduce((sum, b) => sum + (b.price || 0), 0));
    }

    function setupEventListeners() {
        const orderForm = document.getElementById('lrpOrderForm');
        if (orderForm) {
            orderForm.addEventListener('submit', function(e) {
                e.preventDefault();
                submitOrder();
            });
        }

        const categoryFilter = document.getElementById('lrpCategoryFilter');
        if (categoryFilter) categoryFilter.addEventListener('change', filterBooks);

        const ageFilter = document.getElementById('lrpAgeFilter');
        if (ageFilter) ageFilter.addEventListener('change', filterBooks);

        const priceFilter = document.getElementById('lrpPriceFilter');
        if (priceFilter) priceFilter.addEventListener('change', filterBooks);

        const searchBox = document.getElementById('lrpSearchBox');
        if (searchBox) searchBox.addEventListener('input', filterBooks);

        const resetFiltersBtn = document.getElementById('lrpResetFiltersBtn');
        if (resetFiltersBtn) resetFiltersBtn.addEventListener('click', function() { lrpResetFilters(); });

        const closeModalBtn = document.getElementById('lrpCloseModalBtn');
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', lrpCloseCheckout);
            closeModalBtn.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' || e.key === ' ') lrpCloseCheckout();
            });
        }

        const applyPromoBtn = document.getElementById('lrpApplyPromoBtn');
        if (applyPromoBtn) applyPromoBtn.addEventListener('click', validatePromoCode);

        const removePromoBtn = document.getElementById('lrpRemovePromoBtn');
        if (removePromoBtn) removePromoBtn.addEventListener('click', removePromo);

        const promoCode = document.getElementById('lrpPromoCode');
        if (promoCode) {
            promoCode.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    validatePromoCode();
                }
            });
        }

        const deliveryArea = document.getElementById('lrpDeliveryArea');
        if (deliveryArea) deliveryArea.addEventListener('input', onDeliveryAreaInput);

        const cart = document.getElementById('lrpCart');
        if (cart) cart.addEventListener('click', lrpOpenCheckout);

        // Click outside modal to close
        $(document).on('click', function(event) {
            const modal = document.getElementById('lrpCheckoutModal');
            if (event.target === modal) {
                lrpCloseCheckout();
            }
        });
    }

    function filterBooks() {
        const category = document.getElementById('lrpCategoryFilter')?.value || '';
        const ageGroup = document.getElementById('lrpAgeFilter')?.value || '';
        const priceRange = document.getElementById('lrpPriceFilter')?.value || '';
        const searchTerm = (document.getElementById('lrpSearchBox')?.value || '').toLowerCase();
        
        const filtered = books.filter(book => 
            (!category || book.category === category) &&
            (!ageGroup || book.ageGroup === ageGroup) &&
            (!priceRange || (
                (priceRange === '0-10000' && book.price < 10000) ||
                (priceRange === '10000-20000' && book.price >= 10000 && book.price <= 20000) ||
                (priceRange === '20000+' && book.price > 20000)
            )) &&
            (!searchTerm || book.title.toLowerCase().includes(searchTerm) || book.author.toLowerCase().includes(searchTerm))
        );
        displayBooks(filtered);
    }

    function loadDeliveryAreas() {
        $.ajax({
            url: lrp_ajax.ajax_url,
            type: 'POST',
            data: {
                action: 'lrp_api_proxy',
                api_action: 'deliveryAreas',
                nonce: lrp_ajax.nonce
            },
            success: function(response) {
                if (response.success) {
                    deliveryAreasList = response.data;
                    const datalist = document.getElementById('lrpAreasList');
                    if (datalist) {
                        datalist.innerHTML = '';
                        response.data.forEach(area => {
                            const opt = document.createElement('option');
                            opt.value = area;
                            datalist.appendChild(opt);
                        });
                    }
                }
            }
        });
    }

    function onDeliveryAreaInput() {
        const areaInput = document.getElementById('lrpDeliveryArea');
        const area = areaInput ? areaInput.value.trim() : '';
        const areaFeeMsg = document.getElementById('lrpAreaFeeMsg');
        const areaErrorMsg = document.getElementById('lrpAreaErrorMsg');

        if (!area) {
            if (areaFeeMsg) areaFeeMsg.textContent = '';
            if (areaErrorMsg) areaErrorMsg.textContent = '';
            selectedDeliveryFee = null;
            if (areaInput) areaInput.classList.remove('error');
        } else {
            console.log('LRP: Checking delivery price for area:', area);
            
            $.ajax({
                url: lrp_ajax.ajax_url,
                type: 'POST',
                data: {
                    action: 'lrp_api_proxy',
                    api_action: 'deliveryPrice',
                    area: area,
                    nonce: lrp_ajax.nonce
                },
                success: function(response) {
                    console.log('LRP: Delivery price response:', response);
                    if (response.success && response.data.found) {
                        selectedDeliveryFee = Number(response.data.price || 0);
                        if (areaFeeMsg) areaFeeMsg.textContent = `Delivery to ${response.data.matched}: UGX ${Number(response.data.price).toLocaleString()}`;
                        if (areaErrorMsg) areaErrorMsg.textContent = '';
                        if (areaInput) areaInput.classList.remove('error');
                    } else {
                        selectedDeliveryFee = null;
                        if (areaFeeMsg) areaFeeMsg.textContent = '';
                        if (areaErrorMsg) areaErrorMsg.textContent = "Sorry, we don't deliver to this area.";
                        if (areaInput) areaInput.classList.add('error');
                    }
                    updateOrderSummary(cart.reduce((sum, b) => sum + (b.price||0), 0));
                },
                error: function(xhr, status, error) {
                    console.error('LRP: AJAX error checking delivery price:', status, error, xhr.responseText);
                    selectedDeliveryFee = null;
                    if (areaFeeMsg) areaFeeMsg.textContent = '';
                    if (areaErrorMsg) areaErrorMsg.textContent = "Error checking delivery area. Please try again.";
                    if (areaInput) areaInput.classList.add('error');
                }
            });
        }
    }

    function validateCartBooks() {
        if (cart.length === 0) return;
        const codes = cart.map(b => b.code);
        
        console.log('LRP: Validating cart books:', codes);
        
        $.ajax({
            url: lrp_ajax.ajax_url,
            type: 'POST',
            data: {
                action: 'lrp_api_proxy',
                api_action: 'checkAvailability',
                codes: codes.join(','),
                nonce: lrp_ajax.nonce
            },
            success: function(response) {
                console.log('LRP: Cart validation response:', response);
                if (response.success) {
                    const result = response.data;
                    const unavailable = codes.filter(code => !result[code] || !result[code].available)
                                           .map(code => ({ code, status: result[code] ? result[code].status : 'unavailable' }));
                    if (unavailable.length > 0) {
                        showStatusBar(unavailable);
                        cart = cart.filter(b => !unavailable.find(u => u.code === b.code));
                        updateCartCount(true);
                        saveCart();
                        updateCartDisplay();
                    } else {
                        hideStatusBar();
                    }
                }
            },
            error: function(xhr, status, error) {
                console.error('LRP: AJAX error validating cart books:', status, error, xhr.responseText);
            }
        });
    }

    function showStatusBar(unavailableBooks) {
        const bar = document.getElementById('lrpStatusBar');
        const details = document.getElementById('lrpStatusBarDetails');
        if (bar) bar.style.display = 'block';
        if (details) details.textContent = unavailableBooks.map(b => `${b.code} (${b.status.toUpperCase()})`).join(', ');
    }

    function hideStatusBar() {
        const bar = document.getElementById('lrpStatusBar');
        const details = document.getElementById('lrpStatusBarDetails');
        if (bar) bar.style.display = 'none';
        if (details) details.textContent = '';
    }

    function resetOrderForm() {
        const form = document.getElementById('lrpOrderForm');
        if (form) form.reset();
        
        const phoneInput = document.getElementById('lrpCustomerPhone');
        if (phoneInput) phoneInput.value = '+256';
        
        // Keep delivery area and fee if they were already selected
        const areaInput = document.getElementById('lrpDeliveryArea');
        const currentArea = areaInput ? areaInput.value : '';
        const currentFee = selectedDeliveryFee;
        
        // Reset promo code only
        activePromo = null;
        
        const promoInputContainer = document.getElementById('lrpPromoInputContainer');
        const promoAppliedContainer = document.getElementById('lrpPromoAppliedContainer');
        const successMessage = document.getElementById('lrpSuccessMessage');
        
        if (promoInputContainer) promoInputContainer.style.display = 'flex';
        if (promoAppliedContainer) promoAppliedContainer.style.display = 'none';
        if (successMessage) successMessage.style.display = 'none';
        
        // Restore delivery area and fee if they were set
        if (currentArea && currentFee !== null) {
            if (areaInput) areaInput.value = currentArea;
            selectedDeliveryFee = currentFee;
        }
        
        updateOrderSummary(cart.reduce((sum, b) => sum + (b.price || 0), 0));
    }

    function submitOrder() {
        // Clear previous errors
        $('.lrp-form-group input.error, .lrp-form-group textarea.error').removeClass('error');
        let valid = true;

        const name = document.getElementById('lrpCustomerName');
        const phone = document.getElementById('lrpCustomerPhone');
        const area = document.getElementById('lrpDeliveryArea');

        if (!name || !name.value.trim()) { 
            if (name) name.classList.add('error'); 
            valid = false; 
        }
        if (!phone || !phone.value.match(/^\+256\d{9}$/)) { 
            if (phone) phone.classList.add('error'); 
            valid = false; 
        }
        if (!area || !area.value.trim() || selectedDeliveryFee === null) { 
            if (area) area.classList.add('error'); 
            valid = false; 
        }
        
        if (!valid) {
            alert('Please fill in all required fields and select a valid delivery area.');
            return;
        }
        
        if (cart.length === 0) {
            alert('Your cart is empty!');
            return;
        }

        const notes = document.getElementById('lrpDeliveryNotes')?.value || '';
        const promoCode = activePromo ? activePromo.code : '';

        continueSubmitOrder(
            name.value.trim(),
            phone.value.trim(),
            notes,
            area.value.trim(),
            promoCode
        );
    }

    function continueSubmitOrder(name, phone, notes, area, promoCode) {
        const codes = cart.map(b => b.code);
        const submitBtn = document.querySelector('.lrp-submit-order');
        
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Processing...';
        }

        // First check availability
        console.log('LRP: Final availability check before order submission for codes:', codes);
        
        $.ajax({
            url: lrp_ajax.ajax_url,
            type: 'POST',
            data: {
                action: 'lrp_api_proxy',
                api_action: 'checkAvailability',
                codes: codes.join(','),
                nonce: lrp_ajax.nonce
            },
            success: function(response) {
                console.log('LRP: Final availability check response:', response);
                if (response.success) {
                    const availabilityResult = response.data;
                    const unavailable = codes.filter(code => !availabilityResult[code] || !availabilityResult[code].available)
                                             .map(code => ({ code, status: availabilityResult[code] ? availabilityResult[code].status : 'unavailable' }));
                    
                    if (unavailable.length > 0) {
                        showStatusBar(unavailable);
                        cart = cart.filter(b => !unavailable.find(u => u.code === b.code));
                        updateCartCount(true);
                        saveCart();
                        updateCartDisplay();
                        alert('Some books in your cart are no longer available and have been removed.');
                        if (submitBtn) {
                            submitBtn.disabled = false;
                            submitBtn.textContent = 'Place Order';
                        }
                        return;
                    }
                    
                    hideStatusBar();
                    const orderData = { 
                        customerName: name, 
                        customerPhone: phone, 
                        deliveryArea: area, 
                        deliveryNotes: notes, 
                        books: cart, 
                        promoCode: promoCode 
                    };
                    
                    console.log('LRP: Submitting order with data:', orderData);
                    console.log('LRP: Selected delivery fee:', selectedDeliveryFee);
                    console.log('LRP: Active promo:', activePromo);
                    
                    // Process the order
                    $.ajax({
                        url: lrp_ajax.ajax_url,
                        type: 'POST',
                        data: {
                            action: 'lrp_api_proxy',
                            api_action: 'processOrder',
                            order_data: JSON.stringify(orderData),
                            nonce: lrp_ajax.nonce
                        },
                        success: function(orderResponse) {
                            console.log('LRP: Order submission response:', orderResponse);
                            if (orderResponse.success && orderResponse.data && orderResponse.data.success) {
                                const orderForm = document.getElementById('lrpOrderForm');
                                const successMessage = document.getElementById('lrpSuccessMessage');
                                
                                if (orderForm) orderForm.style.display = 'none';
                                if (successMessage) {
                                    successMessage.innerHTML = `
                                        <h3>✅ Order Submitted Successfully!</h3>
                                        <p><strong>Order ID: ${orderResponse.data.orderId}</strong></p>
                                        <p>Check your SMS for payment details.</p>
                                        <p>Your books are reserved for 24 hours.</p>`;
                                    successMessage.style.display = 'block';
                                }
                                
                                cart = [];
                                updateCartCount(true);
                                saveCart();
                                setTimeout(() => {
                                    lrpCloseCheckout();
                                    loadBooks(); 
                                }, 7000);
                            } else {
                                console.error('LRP: Order submission failed:', orderResponse);
                                const errorMsg = orderResponse.data?.error || orderResponse.message || 'Unknown error';
                                alert('Failed to submit order: ' + errorMsg);
                                if (submitBtn) {
                                    submitBtn.disabled = false;
                                    submitBtn.textContent = 'Place Order';
                                }
                            }
                        },
                        error: function(xhr, status, error) {
                            console.error('LRP: AJAX error submitting order:', status, error, xhr.responseText);
                            alert('Error submitting order. Please try again.');
                            if (submitBtn) {
                                submitBtn.disabled = false;
                                submitBtn.textContent = 'Place Order';
                            }
                        }
                    });
                }
            },
            error: function(xhr, status, error) {
                console.error('LRP: AJAX error in final availability check:', status, error, xhr.responseText);
                alert('Error checking book availability. Please try again.');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Place Order';
                }
            }
        });
    }
});