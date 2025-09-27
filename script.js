// Initialize Stripe (will be set after fetching config)
let stripe;
let elements;
let clientSecret;

// Map HTML field names to server expected format
function mapFieldName(fieldName, packageId) {
    const fieldMapping = {
        'classic': {
            'color-scheme': 'colorScheme',
            'delivery-date': 'delivery',
            'add-ons': 'addons'
        },
        'premium': {
            'style-theme': 'theme',
            'setup-service': 'setup',
            'premium-add-ons': 'premiumAddons'
        }
    };
    
    return fieldMapping[packageId][fieldName] || fieldName;
}

// Smooth scroll to section
function scrollToSection(sectionId) {
    const element = document.getElementById(sectionId);
    if (element) {
        element.scrollIntoView({ 
            behavior: 'smooth',
            block: 'start'
        });
    }
}

// Change main gallery image
function changeMainImage(thumbnail, packageId) {
    const mainImage = document.querySelector(`[data-package-id="${packageId}"] .gallery-main img`);
    if (mainImage && thumbnail) {
        mainImage.src = thumbnail.src;
        mainImage.alt = thumbnail.alt;
        
        // Update thumbnail selection state
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
        if (packageId === 'classic') {
            button.innerHTML = '<i class="fas fa-shopping-cart"></i> Buy Now';
        } else {
            button.innerHTML = '<i class="fas fa-shopping-cart"></i> Buy Now';
        }
        button.onclick = () => showCustomization(packageId);
    }
}

// Calculate total price based on all selections and update display
function calculateTotalPrice(packageId, basePrice) {
    let total = basePrice;
    
    // Get add-on selections for both classic and premium
    if (packageId === 'classic') {
        const addOnSelect = document.getElementById('add-ons-classic');
        if (addOnSelect && addOnSelect.value) {
            switch (addOnSelect.value) {
                case 'extra-mums':
                    total += 25;
                    break;
                case 'corn-stalks':
                    total += 35;
                    break;
                case 'setup-service':
                    total += 50;
                    break;
            }
        }
    } else if (packageId === 'premium') {
        const addOnSelect = document.getElementById('premium-add-ons');
        if (addOnSelect && addOnSelect.value) {
            switch (addOnSelect.value) {
                case 'scarecrow':
                    total += 75;
                    break;
                case 'lighting':
                    total += 125;
                    break;
                case 'maintenance':
                    total += 100;
                    break;
            }
        }
    }
    
    return total;
}

// Update the total price display in real-time
function updateTotalPriceDisplay(packageId, basePrice) {
    const total = calculateTotalPrice(packageId, basePrice);
    const totalDisplay = document.getElementById(`total-${packageId}`);
    if (totalDisplay) {
        totalDisplay.textContent = `$${total.toFixed(2)}`;
        // Add animation to highlight the change
        totalDisplay.style.transform = 'scale(1.1)';
        setTimeout(() => {
            totalDisplay.style.transform = 'scale(1)';
        }, 200);
    }
}

// Add event listeners to dropdowns for dynamic price updates
function initializePriceUpdates() {
    const classicDropdowns = document.querySelectorAll('#customization-classic .dropdown');
    const premiumDropdowns = document.querySelectorAll('#customization-premium .dropdown');
    
    classicDropdowns.forEach(dropdown => {
        dropdown.addEventListener('change', () => updateTotalPriceDisplay('classic', 299));
    });
    
    premiumDropdowns.forEach(dropdown => {
        dropdown.addEventListener('change', () => updateTotalPriceDisplay('premium', 549));
    });
}

// Proceed to Stripe checkout
async function proceedToCheckout(packageId, basePrice) {
    // Validate customization selections
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
    
    // Gather order data
    const orderData = {
        packageId: packageId,
        packageName: packageId === 'classic' ? 'Classic Autumn Package' : 'Premium Harvest Package',
        basePrice: basePrice,
        totalPrice: totalPrice,
        customizations: {}
    };
    
    // Collect customization values with proper mapping
    requiredFields.forEach(field => {
        const fieldName = field.id.replace(`-${packageId}`, '');
        const mappedFieldName = mapFieldName(fieldName, packageId);
        orderData.customizations[mappedFieldName] = field.value;
    });
    
    // Show checkout modal
    await showCheckoutModal(orderData);
}

// Show Stripe checkout modal
async function showCheckoutModal(orderData) {
    const modal = document.getElementById('checkout-modal');
    modal.style.display = 'flex';
    
    try {
        // Check if Stripe is initialized
        if (!stripe) {
            throw new Error('Stripe not initialized. Please refresh the page and try again.');
        }
        
        // Create payment intent on your server (server calculates price)
        const response = await fetch('/.netlify/functions/create-payment-intent', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                packageId: orderData.packageId,
                customizations: orderData.customizations
            }),
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to create payment intent');
        }
        
        const { client_secret, amount } = await response.json();
        clientSecret = client_secret;
        
        // Display server-validated amount in modal
        const modalHeader = document.querySelector('.modal-header h3');
        if (modalHeader) {
            modalHeader.innerHTML = `Complete Your Order - <span style="color: #D2691E;">$${(amount / 100).toFixed(2)}</span>`;
        }
        
        // Initialize Stripe Elements
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
        
        // Handle form submission (remove existing listener to prevent duplicates)
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
    
    if (!stripe || !elements) {
        return;
    }
    
    setLoading(true);
    
    const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
            return_url: window.location.origin + '/success.html',
        },
        redirect: 'if_required'
    });
    
    if (error) {
        if (error.type === "card_error" || error.type === "validation_error") {
            showMessage(error.message);
        } else {
            showMessage("An unexpected error occurred.");
        }
    } else {
        // Payment succeeded
        showMessage("Payment successful! Thank you for your order. We'll contact you soon to schedule delivery.");
        setTimeout(() => {
            closeCheckout();
            // Reset all forms
            resetForms();
        }, 3000);
    }
    
    setLoading(false);
}

// Close checkout modal
function closeCheckout() {
    const modal = document.getElementById('checkout-modal');
    modal.style.display = 'none';
    
    // Clean up Stripe elements properly
    if (elements) {
        // Clear the payment element container
        const paymentElement = document.getElementById('payment-element');
        if (paymentElement) {
            paymentElement.innerHTML = '';
        }
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
    
    setTimeout(() => {
        messageContainer.style.display = 'none';
    }, 5000);
}

// Create message container if it doesn't exist
function createMessageContainer() {
    const container = document.createElement('div');
    container.id = 'payment-message';
    container.style.cssText = `
        margin-top: 15px;
        padding: 10px;
        border-radius: 5px;
        background-color: #f8f9fa;
        border: 1px solid #dee2e6;
        color: #495057;
        text-align: center;
        display: none;
    `;
    document.getElementById('payment-element').parentNode.appendChild(container);
    return container;
}

// Reset all forms
function resetForms() {
    // Reset customization panels
    document.querySelectorAll('.customization-panel').forEach(panel => {
        panel.style.display = 'none';
    });
    
    // Reset all dropdowns
    document.querySelectorAll('.dropdown').forEach(dropdown => {
        dropdown.value = '';
        dropdown.style.borderColor = '#DEB887';
    });
    
    // Reset buy buttons
    const classicBtn = document.querySelector('[data-package-id="classic"] .package-buy-btn');
    const premiumBtn = document.querySelector('[data-package-id="premium"] .package-buy-btn');
    
    if (classicBtn) {
        classicBtn.innerHTML = '<i class="fas fa-shopping-cart"></i> Buy Now';
        classicBtn.onclick = () => showCustomization('classic');
    }
    
    if (premiumBtn) {
        premiumBtn.innerHTML = '<i class="fas fa-shopping-cart"></i> Buy Now';
        premiumBtn.onclick = () => showCustomization('premium');
    }
}

// Handle contact form submission (Formspree integration)
function handleContactForm(event) {
    // Don't prevent default - let Formspree handle the submission
    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData);
    
    // Simple form validation
    if (!data.name || !data.email || !data.budget || !data.description) {
        event.preventDefault();
        alert('Please fill in all required fields.');
        return;
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
        event.preventDefault();
        alert('Please enter a valid email address.');
        return;
    }
    
    // Show loading state
    const submitButton = event.target.querySelector('button[type="submit"]');
    const originalText = submitButton.innerHTML;
    
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
    submitButton.disabled = true;
    
    // Let Formspree handle the actual submission
    // The form will redirect or show a thank you page
}

// Navbar scroll effect
function handleNavbarScroll() {
    const navbar = document.querySelector('.navbar');
    if (window.scrollY > 100) {
        navbar.style.background = 'rgba(255, 248, 220, 0.98)';
    } else {
        navbar.style.background = 'rgba(255, 248, 220, 0.95)';
    }
}

// Intersection Observer for scroll animations
function initScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);
    
    // Observe elements that should animate on scroll
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
    // Initialize Stripe first
    await initializeStripe();
    
    // Initialize price updates for dropdowns
    initializePriceUpdates();
    
    // Initialize scroll animations
    initScrollAnimations();
    
    // Add scroll event listener for navbar
    window.addEventListener('scroll', handleNavbarScroll);
    
    // Add contact form event listener
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', handleContactForm);
    }
    
    // Close modal when clicking outside
    window.addEventListener('click', function(event) {
        const modal = document.getElementById('checkout-modal');
        if (event.target === modal) {
            closeCheckout();
        }
    });
    
    // Close modal with Escape key
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            closeCheckout();
        }
    });
    
    // Add smooth scrolling to all anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
});

// Simple API simulation for when no backend is available
async function fallbackPaymentHandler(orderData) {
    return new Promise((resolve) => {
        setTimeout(() => {
            // Simulate successful payment
            resolve({
                success: true,
                message: "Payment processed successfully! (Demo mode)"
            });
        }, 2000);
    });
}

// Check if we're in development mode and adjust Stripe key accordingly
if (window.location.hostname === 'localhost' || window.location.hostname.includes('repl')) {
    // Use test keys for development
    console.log('Development mode detected - using test Stripe keys');
}