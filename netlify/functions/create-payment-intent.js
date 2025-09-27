const Stripe = require('stripe');

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

// Package catalog for server-side validation (matches HTML dropdown values)
const PACKAGE_CATALOG = {
  'classic': {
    name: 'Classic Autumn Package',
    basePrice: 29900, // $299 in cents
    options: {
      colorScheme: {
        'traditional': 0,
        'elegant': 0,
        'rustic': 0
      },
      delivery: {
        'weekend': 0,
        'next-week': 0,
        'custom': 0
      },
      addons: {
        'none': 0,
        'extra-mums': 2500, // $25 extra
        'corn-stalks': 3500, // $35 extra
        'setup-service': 5000 // $50 extra
      }
    }
  },
  'premium': {
    name: 'Premium Harvest Package',
    basePrice: 54900, // $549 in cents
    options: {
      theme: {
        'elegant': 0,
        'farmhouse': 0,
        'modern': 0
      },
      setup: {
        'full-setup': 0,
        'delivery-only': 0,
        'diy-guide': 0
      },
      premiumAddons: {
        'none': 0,
        'scarecrow': 7500, // $75 extra
        'lighting': 12500, // $125 extra
        'maintenance': 10000 // $100 extra
      }
    }
  }
};

// Validate and calculate price server-side
function validateAndCalculatePrice(packageId, customizations) {
  const packageInfo = PACKAGE_CATALOG[packageId];
  if (!packageInfo) {
    return { isValid: false, totalPrice: 0, error: 'Invalid package ID' };
  }

  let totalPrice = packageInfo.basePrice;
  
  try {
    // Validate and add option prices
    for (const [optionType, selectedOption] of Object.entries(customizations)) {
      const optionPrices = packageInfo.options[optionType];
      if (!optionPrices) {
        return { isValid: false, totalPrice: 0, error: `Invalid option type: ${optionType}` };
      }
      
      const optionPrice = optionPrices[selectedOption];
      if (optionPrice === undefined) {
        return { isValid: false, totalPrice: 0, error: `Invalid option value: ${selectedOption} for ${optionType}` };
      }
      
      totalPrice += optionPrice;
    }
    
    return { isValid: true, totalPrice };
  } catch (error) {
    return { isValid: false, totalPrice: 0, error: 'Invalid customization format' };
  }
}

exports.handler = async (event, context) => {
  // Handle CORS for all requests
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const { packageId, customizations } = JSON.parse(event.body);
    
    // Validate input
    if (!packageId || !customizations) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Missing required fields: packageId and customizations' 
        })
      };
    }
    
    // Validate package and calculate price server-side
    const validation = validateAndCalculatePrice(packageId, customizations);
    if (!validation.isValid) {
      console.log('Package validation failed:', validation.error);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Invalid package configuration',
          message: validation.error 
        })
      };
    }
    
    console.log('Creating payment intent for package:', packageId, 'amount:', validation.totalPrice);
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount: validation.totalPrice,
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        packageId,
        packageName: PACKAGE_CATALOG[packageId].name,
        customizations: JSON.stringify(customizations),
        totalPrice: (validation.totalPrice / 100).toString() // Store in dollars for readability
      },
    });

    console.log('Payment intent created successfully:', paymentIntent.id, 'for $' + (validation.totalPrice / 100));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        client_secret: paymentIntent.client_secret,
        amount: validation.totalPrice // Send back validated amount for display
      })
    };
  } catch (error) {
    console.error('Error creating payment intent:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to create payment intent',
        message: error.message 
      })
    };
  }
};