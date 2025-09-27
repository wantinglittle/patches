// Initialize Stripe (will be set after fetching config)
let stripe;
let elements;
let clientSecret;

// Map HTML field names to server expected format
function mapFieldName(fieldName, packageId) {
    const fieldMapping = {
        'classic': {
            'delivery-date': 'delivery',
            'setup': 'setup'
        },
        'premium': {
            'delivery-date': 'delivery', 
            'setup': 'setup'
        },
        'grand': {
            'delivery-date': 'delivery',
            'setup': 'setup'
        }
    };
    return (fieldMapping[packageId] && fieldMapping[packageId][fieldName]) || fieldName;
}

// Smooth scroll to section
function scrollToSection(sectionId) {
    const element = document.getElementById(sectionId);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// Change main gallery image
function changeMainImage(thumbnail, packageId) {
    const mainImage = document.querySelector(`[data-package-id="${packageId}"] .gallery-main img`);
    if (mainImage && thumbnail) {
        mainImage.src = thumbnail.src;
        mainImage.alt = thumbnail.alt;
        const thumbnails = document.querySelectorAll(`[data-package-id="${packageId}"] .gallery-thumbnails img`);
        thumbnails.forEach(thumb => thumb.style.opacity = '1');
        thumbnail.style.opacity = '0.7';
    }
}

// Show customization panel
function showCustomization(packageId) {
    const panel = document.getElementById(`customization-${packageId}`);
    const button = document.querySelector(`[data-package-id="${packageId}"] .package-buy-btn`);
    if (panel && button) {
        if (panel.style.display === 'none' || !panel.style.display) {
            panel.style.display = 'block';
            button.innerHTML = '<i class="fas fa-times"></i> Hide Options';
            button.onclick = () => hideCustomization(packageId);
        }
    }
}

// Hide customization panel
function hideCustomization(packageId) {
    const panel = document.getElementById(`customization-${packageId}`);
    const button = document.querySelector(`[data-package-id="${packageId}"] .package-buy-btn`);
    if (panel && button) {
        panel.style.display = 'none';
        button.innerHTML = '<i class="fas fa-shopping-cart"></i> Buy Now';
        button.onclick = () => showCustomization(packageId);
    }
}

// Calculate total price based on selections
function calculateTotalPrice(packageId, basePrice) {
    let total = basePrice;
    const setupSelect = document.getElementById(`setup-${packageId}`);
    if (setupSelect && setupSelect.value) {
        // All packages charge $90 for setup service
        if ((packageId === 'classic' && setupSelect.value === 'setup-service') ||
            (packageId === 'premium' && setupSelect.value === 'full-setup') ||
            (packageId === 'grand' && setupSelect.value === 'full-setup')) {
            total += 90;
        }
    }
    return total;
}

// Update total price display
function updateTotalPriceDisplay(packageId, basePrice) {
    const total = calculateTotalPrice(packageId, basePrice);
    const totalDisplay = document.getElementById(`total-${packageId}`);
    if (totalDisplay) {
        totalDisplay.textContent = `$${total.toFixed(2)}`;
        totalDisplay.style.transform = 'scale(1.1)';
        setTimeout(() => { totalDisplay.style.transform = 'scale(1)'; }, 200);
    }
}

// Add event listeners for dynamic price updates
function initializePriceUpdates() {
    const classicDropdowns = document.querySelectorAll('#customization-classic .dropdown');
    classicDropdowns.forEach(dropdown => {
        dropdown.addEventListener('change', () => updateTotalPriceDisplay('classic', 360));
    });

    const premiumDropdowns = document.querySelectorAll('#customization-premium .dropdown');
    premiumDropdowns.forEach(dropdown => {
        dropdown.addEventListener('change', () => updateTotalPriceDisplay('premium', 625));
    });

    const grandDropdowns = document.querySelectorAll('#customization-grand .dropdown');
    grandDropdowns.forEach(dropdown => {
        dropdown.addEventListener('change', () => updateTotalPriceDisplay('grand', 895));
    });

    // Ensure premium setup option updates total
    const premiumSetup = document.getElementById('setup-premium');
    if (premiumSetup) {
        premiumSetup.addEventListener('change', () => updateTotalPriceDisplay('premium', 625));
    }

    // Ensure grand setup option updates total
    const grandSetup = document.getElementById('setup-grand');
    if (grandSetup) {
        grandSetup.addEventListener('change', () => updateTotalPriceDisplay('grand', 895));
    }
}

// Proceed to customer info collection
async function proceedToCheckout(packageId, basePrice) {
    const requiredFields = document.querySelectorAll(`#customization-${packageId} .dropdown`);
    let allFieldsSelected = true;
    requiredFields.forEach(field => {
        if (!field.value) {
            allFieldsSelected = false;
            field.style.borderColor = '#F44336';
        } else {
            field.style.borderColor = '#DEB887';
        }
    });
    if (!allFieldsSelected) {
        alert('Please select all customization options before proceeding to checkout.');
        return;
    }

    const totalPrice = calculateTotalPrice(packageId, basePrice);

    const orderData = {
        packageId: packageId,
        packageName: packageId === 'classic' ? 'Classic Autumn Package' : 
                     packageId === 'premium' ? 'Premium Harvest Package' : 'Grand Patch Package',
        basePrice: basePrice,
        totalPrice: totalPrice,
        customizations: {}
    };

    requiredFields.forEach(field => {
        const fieldName = field.id.replace(`-${packageId}`, '');
        const mappedFieldName = mapFieldName(fieldName, packageId);
        orderData.customizations[mappedFieldName] = field.value;
    });

    // Store order data globally and show customer info modal
    window.currentOrderData = orderData;
    showCustomerInfoModal(orderData);
}

// Show customer information modal
function showCustomerInfoModal(orderData) {
    // Try immediate access first
    let modal = document.getElementById('customer-info-modal');
    
    if (modal) {
        setupCustomerModal(modal, orderData);
        return;
    }
    
    // If not found, wait for DOM and try again
    setTimeout(() => {
        modal = document.getElementById('customer-info-modal');
        if (modal) {
            setupCustomerModal(modal, orderData);
        } else {
            // Fallback: Create the modal dynamically if it doesn't exist
            createCustomerModal(orderData);
        }
    }, 100);
}

// Create customer modal dynamically if it doesn't exist
function createCustomerModal(orderData) {
    const modalHTML = `
        <div id="customer-info-modal" class="modal" style="display: flex;">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Delivery Information</h3>
                    <span class="close" onclick="closeCustomerInfo()">&times;</span>
                </div>
                <div class="modal-body">
                    <form id="customer-info-form" class="customer-info-form">
                        <div class="form-row">
                            <div class="form-group">
                                <label for="customer-name">Full Name *</label>
                                <input type="text" id="customer-name" name="customerName" required>
                            </div>
                            <div class="form-group">
                                <label for="customer-email">Email Address *</label>
                                <input type="email" id="customer-email" name="customerEmail" required>
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label for="customer-phone">Phone Number *</label>
                                <input type="tel" id="customer-phone" name="customerPhone" required>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label for="delivery-address">Delivery Address *</label>
                            <input type="text" id="delivery-address" name="deliveryAddress" placeholder="Street Address" required>
                        </div>
                        
                        <div class="form-row three-cols">
                            <div class="form-group">
                                <label for="delivery-city">City *</label>
                                <input type="text" id="delivery-city" name="deliveryCity" required>
                            </div>
                            <div class="form-group">
                                <label for="delivery-state">State *</label>
                                <input type="text" id="delivery-state" name="deliveryState" value="CO" required>
                            </div>
                            <div class="form-group">
                                <label for="delivery-zip">ZIP Code *</label>
                                <input type="text" id="delivery-zip" name="deliveryZip" pattern="[0-9]{5}" required>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label for="delivery-notes">Delivery Instructions (Optional)</label>
                            <textarea id="delivery-notes" name="deliveryNotes" rows="3" placeholder="Any special instructions for delivery or setup..."></textarea>
                        </div>
                        
                        <div class="order-summary">
                            <h4>Order Summary</h4>
                            <div id="order-summary-content"></div>
                        </div>
                        
                        <button type="button" id="proceed-to-payment" class="btn btn-primary">
                            <i class="fas fa-credit-card"></i> Proceed to Payment
                        </button>
                    </form>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modal = document.getElementById('customer-info-modal');
    setupCustomerModal(modal, orderData);
}

// Set up the customer modal content and display
function setupCustomerModal(modal, orderData) {
    modal.style.display = 'flex';
    
    // Populate order summary
    const summaryContent = document.getElementById('order-summary-content');
    if (!summaryContent) {
        console.error('Order summary content element not found');
        alert('Error: Order summary not available. Please refresh the page and try again.');
        return;
    }
    const deliveryText = orderData.customizations.delivery === 'week1' ? 'Week of October 6th, 2025' :
                        orderData.customizations.delivery === 'week2' ? 'Week of October 13th, 2025' :
                        orderData.customizations.delivery === 'week3' ? 'Week of October 20th, 2025' :
                        'Week of October 27th, 2025';
    
    const setupText = orderData.customizations.setup === 'full-setup' || orderData.customizations.setup === 'setup-service' ? 
                     'Professional Setup (+$90)' : 'DIY Delivery Only';
    
    summaryContent.innerHTML = `
        <div class="summary-line"><strong>${orderData.packageName}</strong></div>
        <div class="summary-line">Delivery: ${deliveryText}</div>
        <div class="summary-line">Setup: ${setupText}</div>
        <div class="summary-total"><strong>Total: $${orderData.totalPrice.toFixed(2)}</strong></div>
    `;
    
    // Set up the proceed to payment button
    const proceedButton = document.getElementById('proceed-to-payment');
    proceedButton.onclick = async function() {
        if (validateCustomerForm()) {
            const customerData = collectCustomerData();
            const completeOrderData = {
                ...orderData,
                customer: customerData
            };
            closeCustomerInfo();
            await showCheckoutModal(completeOrderData);
        }
    };
}

// Close customer info modal
function closeCustomerInfo() {
    const modal = document.getElementById('customer-info-modal');
    modal.style.display = 'none';
}

// Validate customer information form
function validateCustomerForm() {
    const requiredFields = [
        'customer-name', 'customer-email', 'customer-phone',
        'delivery-address', 'delivery-city', 'delivery-state', 'delivery-zip'
    ];
    
    let allValid = true;
    requiredFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (!field.value.trim()) {
            field.style.borderColor = '#F44336';
            allValid = false;
        } else {
            field.style.borderColor = '#DEB887';
        }
    });
    
    if (!allValid) {
        alert('Please fill out all required fields.');
    }
    
    return allValid;
}

// Collect customer data from form
function collectCustomerData() {
    return {
        name: document.getElementById('customer-name').value.trim(),
        email: document.getElementById('customer-email').value.trim(),
        phone: document.getElementById('customer-phone').value.trim(),
        address: {
            street: document.getElementById('delivery-address').value.trim(),
            city: document.getElementById('delivery-city').value.trim(),
            state: document.getElementById('delivery-state').value.trim(),
            zip: document.getElementById('delivery-zip').value.trim()
        },
        deliveryNotes: document.getElementById('delivery-notes').value.trim()
    };
}

// Show Stripe checkout modal
async function showCheckoutModal(orderData) {
    const modal = document.getElementById('checkout-modal');
    modal.style.display = 'flex';

    try {
        if (!stripe) throw new Error('Stripe not initialized. Please refresh the page.');

        // Debug: Log what we're sending to the server
        console.log('Sending to server:', { 
            packageId: orderData.packageId, 
            customizations: orderData.customizations,
            customer: orderData.customer
        });
        
        const response = await fetch('/.netlify/functions/create-payment-intent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                packageId: orderData.packageId, 
                customizations: orderData.customizations,
                customer: orderData.customer
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Server error:', errorData);
            throw new Error(errorData.message || 'Failed to create payment intent');
        }

        const { client_secret, amount } = await response.json();
        clientSecret = client_secret;

        const modalHeader = document.querySelector('.modal-header h3');
        if (modalHeader) {
            modalHeader.innerHTML = `Complete Your Order - <span style="color: #D2691E;">$${(amount / 100).toFixed(2)}</span>`;
        }

        elements = stripe.elements({
            clientSecret: clientSecret,
            appearance: {
                theme: 'stripe',
                variables: {
                    colorPrimary: '#D2691E',
                    colorBackground: '#ffffff',
                    colorText: '#3E2723',
                    colorDanger: '#F44336',
                    fontFamily: 'Inter, sans-serif',
                    spacingUnit: '6px',
                    borderRadius: '10px'
                }
            }
        });

        const paymentElement = elements.create('payment');
        paymentElement.mount('#payment-element');

        const submitButton = document.getElementById('submit-payment');
        submitButton.removeEventListener('click', handleSubmit);
        submitButton.addEventListener('click', handleSubmit);

    } catch (error) {
        console.error('Error:', error);
        alert(`Failed to initialize checkout: ${error.message}. Please try again.`);
        closeCheckout();
    }
}

// Handle payment submission
async function handleSubmit(event) {
    event.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);

    const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: window.location.origin + '/success.html' },
        redirect: 'if_required'
    });

    if (error) {
        if (error.type === "card_error" || error.type === "validation_error") {
            showMessage(error.message);
        } else {
            showMessage("An unexpected error occurred.");
        }
    } else {
        showMessage("Payment successful! Thank you for your order. We'll contact you soon.");
        setTimeout(() => {
            closeCheckout();
            resetForms();
        }, 3000);
    }

    setLoading(false);
}

// Close checkout modal
function closeCheckout() {
    const modal = document.getElementById('checkout-modal');
    modal.style.display = 'none';

    if (elements) {
        const paymentElement = document.getElementById('payment-element');
        if (paymentElement) paymentElement.innerHTML = '';
        elements = null;
    }
    clientSecret = null;
}

// Set loading state
function setLoading(isLoading) {
    const submitButton = document.getElementById('submit-payment');
    const buttonText = document.getElementById('button-text');
    const spinner = document.getElementById('spinner');

    if (isLoading) {
        submitButton.disabled = true;
        buttonText.style.display = 'none';
        spinner.style.display = 'block';
    } else {
        submitButton.disabled = false;
        buttonText.style.display = 'block';
        spinner.style.display = 'none';
    }
}

// Show message
function showMessage(messageText) {
    const messageContainer = document.getElementById('payment-message') || createMessageContainer();
    messageContainer.textContent = messageText;
    messageContainer.style.display = 'block';
    setTimeout(() => { messageContainer.style.display = 'none'; }, 5000);
}

// Create message container
function createMessageContainer() {
    const container = document.createElement('div');
    container.id = 'payment-message';
    container.style.cssText = "margin-top: 15px; padding: 10px; border-radius: 5px; background-color: #f8f9fa; border: 1px solid #dee2e6; color: #495057; text-align: center; display: none;";
    document.getElementById('payment-element').parentNode.appendChild(container);
    return container;
}

// Reset all forms
function resetForms() {
    document.querySelectorAll('.customization-panel').forEach(panel => panel.style.display = 'none');
    document.querySelectorAll('.dropdown').forEach(dropdown => {
        dropdown.value = '';
        dropdown.style.borderColor = '#DEB887';
    });

    const classicBtn = document.querySelector('[data-package-id="classic"] .package-buy-btn');
    const premiumBtn = document.querySelector('[data-package-id="premium"] .package-buy-btn');
    if (classicBtn) { classicBtn.innerHTML = '<i class="fas fa-shopping-cart"></i> Buy Now'; classicBtn.onclick = () => showCustomization('classic'); }
    if (premiumBtn) { premiumBtn.innerHTML = '<i class="fas fa-shopping-cart"></i> Buy Now'; premiumBtn.onclick = () => showCustomization('premium'); }
}

// Handle contact form submission
function handleContactForm(event) {
    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData);

    if (!data.name || !data.email || !data.budget || !data.description) {
        event.preventDefault();
        alert('Please fill in all required fields.');
        return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
        event.preventDefault();
        alert('Please enter a valid email address.');
        return;
    }

    const submitButton = event.target.querySelector('button[type="submit"]');
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
    submitButton.disabled = true;
}

// Navbar scroll effect
function handleNavbarScroll() {
    const navbar = document.querySelector('.navbar');
    navbar.style.background = window.scrollY > 100 ? 'rgba(255, 248, 220, 0.98)' : 'rgba(255, 248, 220, 0.95)';
}

// Intersection Observer for scroll animations
function initScrollAnimations() {
    const observerOptions = { threshold: 0.1, rootMargin: '0px 0px -50px 0px' };
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    document.querySelectorAll('.package-card, .gallery-item, .section-header').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
        observer.observe(el);
    });
}

// Initialize Stripe with config from server
async function initializeStripe() {
    try {
        const response = await fetch('/.netlify/functions/stripe-config');
        const config = await response.json();
        if (config.publicKey) {
            stripe = Stripe(config.publicKey);
            console.log('Stripe initialized successfully');
        } else {
            console.error('No Stripe public key found in config');
        }
    } catch (error) {
        console.error('Failed to initialize Stripe:', error);
    }
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', async function() {
    await initializeStripe();
    initializePriceUpdates();
    initScrollAnimations();
    window.addEventListener('scroll', handleNavbarScroll);

    const contactForm = document.getElementById('contactForm');
    if (contactForm) contactForm.addEventListener('submit', handleContactForm);

    window.addEventListener('click', function(event) {
        const modal = document.getElementById('checkout-modal');
        if (event.target === modal) closeCheckout();
    });

    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') closeCheckout();
    });

    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });
});
