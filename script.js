// =========================
// Gallery Thumbnail Function
// =========================
function changeMainImage(imgElement, packageId) {
    const mainImage = document.querySelector(`#customization-${packageId} ~ .package-gallery .gallery-main img`) || 
                      document.querySelector(`.package-card[data-package-id="${packageId}"] .gallery-main img`);
    if (mainImage) {
        mainImage.src = imgElement.src;
    }
}

// =========================
// Scroll to Section
// =========================
function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
    }
}

// =========================
// Show/Hide Customization Panel
// =========================
function showCustomization(packageId) {
    const panel = document.getElementById(`customization-${packageId}`);
    if (panel) {
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    }
}

// =========================
// Total Price Calculation
// =========================

// Base package prices
const basePrices = {
    classic: 360,
    premium: 625
};

// Add-on prices
const addOnPrices = {
    classic: { 'setup-service': 90 },
    premium: { 'full-setup': 90 }
};

// Update total price display
function updateTotalPrice(packageId) {
    let total = basePrices[packageId];
    let selectedAddOn;

    if (packageId === 'classic') {
        selectedAddOn = document.getElementById('add-ons-classic').value;
    } else if (packageId === 'premium') {
        selectedAddOn = document.getElementById('setup-service-premium').value;
    }

    if (selectedAddOn && addOnPrices[packageId][selectedAddOn]) {
        total += addOnPrices[packageId][selectedAddOn];
    }

    const totalDisplay = document.getElementById(`total-${packageId}`);
    if (totalDisplay) {
        totalDisplay.textContent = `$${total.toFixed(2)}`;
        // Optional animation
        totalDisplay.style.transform = 'scale(1.1)';
        setTimeout(() => totalDisplay.style.transform = 'scale(1)', 200);
    }
}

// =========================
// Proceed to Checkout Placeholder
// =========================
function proceedToCheckout(packageId, baseAmount) {
    // Calculate total including add-ons
    let total = baseAmount;

    if (packageId === 'classic') {
        const selected = document.getElementById('add-ons-classic').value;
        if (selected === 'setup-service') total += 90;
    } else if (packageId === 'premium') {
        const selected = document.getElementById('setup-service-premium').value;
        if (selected === 'full-setup') total += 90;
    }

    alert(`Proceeding to checkout for ${packageId} package. Total: $${total.toFixed(2)}`);
    // Here you would trigger Stripe checkout or your payment logic
}

// =========================
// Initialize Event Listeners
// =========================
document.addEventListener('DOMContentLoaded', () => {
    // Classic add-on
    const classicDropdown = document.getElementById('add-ons-classic');
    if (classicDropdown) {
        classicDropdown.addEventListener('change', () => updateTotalPrice('classic'));
    }

    // Premium add-on
    const premiumDropdown = document.getElementById('setup-service-premium');
    if (premiumDropdown) {
        premiumDropdown.addEventListener('change', () => updateTotalPrice('premium'));
    }

    // Initialize totals
    updateTotalPrice('classic');
    updateTotalPrice('premium');
});
