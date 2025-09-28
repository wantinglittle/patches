const Stripe = require('stripe');

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

// Package catalog for server-side validation (all amounts in cents)
const PACKAGE_CATALOG = {
  classic: {
    name: 'Classic Autumn Package',
    basePrice: 25000, // $250
    options: {
      delivery: {
        week1: 0,
        week2: 0,
        week3: 0,
        week4: 0,
      },
      setup: {
        'none': 0,
        'setup-service': 9000, // $90 extra
      },
      zone: {
        zone1: 0, // Free delivery
        zone2: 3500, // $35 delivery
        zone3: 8500, // $85 delivery
      },
    },
  },
  premium: {
    name: 'Premium Harvest Package',
    basePrice: 62500, // $625
    options: {
      delivery: {
        week1: 0,
        week2: 0,
        week3: 0,
        week4: 0,
      },
      setup: {
        'delivery-only': 0,
        'full-setup': 9000, // $90 extra
      },
      zone: {
        zone1: 0, // Free delivery
        zone2: 3500, // $35 delivery
        zone3: 8500, // $85 delivery
      },
    },
  },
  grand: {
    name: 'Grand Patch Package',
    basePrice: 89500, // $895
    options: {
      delivery: {
        week1: 0,
        week2: 0,
        week3: 0,
        week4: 0,
      },
      setup: {
        'delivery-only': 0,
        'full-setup': 9000, // $90 extra
      },
      zone: {
        zone1: 0, // Free delivery
        zone2: 3500, // $35 delivery
        zone3: 8500, // $85 delivery
      },
    },
  },
};

// Validate and calculate price server-side
function validateAndCalculatePrice(packageId, customizations) {
  const packageInfo = PACKAGE_CATALOG[packageId];
  if (!packageInfo) {
    return { isValid: false, totalPrice: 0, error: 'Invalid package ID' };
  }

  let totalPrice = packageInfo.basePrice;

  try {
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
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
    const { packageId, customizations, customer } = JSON.parse(event.body);
    
    // Debug: Log what we received from frontend
    console.log('Server received:', { packageId, customizations, customer });

    if (!packageId || !customizations) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields: packageId and customizations' }),
      };
    }

    const validation = validateAndCalculatePrice(packageId, customizations);
    if (!validation.isValid) {
      console.log('Package validation failed:', validation.error);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Invalid package configuration',
          message: validation.error,
        }),
      };
    }

    console.log(`Creating payment intent for ${packageId}, amount: ${validation.totalPrice}`);

    // Create comprehensive order metadata
    const metadata = {
      packageId,
      packageName: PACKAGE_CATALOG[packageId].name,
      customizations: JSON.stringify(customizations),
      totalPrice: (validation.totalPrice / 100).toString(), // store in dollars
    };

    // Add customer information to metadata if provided
    if (customer) {
      metadata.customerName = customer.name || '';
      metadata.customerEmail = customer.email || '';
      metadata.customerPhone = customer.phone || '';
      if (customer.address) {
        metadata.deliveryAddress = `${customer.address.street}, ${customer.address.city}, ${customer.address.state} ${customer.address.zip}`;
      }
      metadata.deliveryNotes = customer.deliveryNotes || '';
      
      // Create readable delivery info
      const deliveryText = customizations.delivery === 'week1' ? 'Week of October 6th, 2025' :
                          customizations.delivery === 'week2' ? 'Week of October 13th, 2025' :
                          customizations.delivery === 'week3' ? 'Week of October 20th, 2025' :
                          'Week of October 27th, 2025';
      
      const setupText = customizations.setup === 'full-setup' || customizations.setup === 'setup-service' ? 
                       'Professional Setup (+$90)' : 'DIY Delivery Only';
                       
      const zoneText = customizations.zone === 'zone1' ? 'Zone 1 (Free Delivery)' :
                       customizations.zone === 'zone2' ? 'Zone 2 ($35 Delivery)' :
                       customizations.zone === 'zone3' ? 'Zone 3 ($85 Delivery)' : 'Zone not specified';
      
      metadata.deliveryDate = deliveryText;
      metadata.setupOption = setupText;
      metadata.deliveryZone = zoneText;
    }

    const paymentIntentData = {
      amount: validation.totalPrice,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata,
    };

    // Add receipt email if customer email is provided
    if (customer && customer.email) {
      paymentIntentData.receipt_email = customer.email;
    }

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentData);

    console.log(`Payment intent created: ${paymentIntent.id} for $${validation.totalPrice / 100}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        client_secret: paymentIntent.client_secret,
        amount: validation.totalPrice, // still in cents
      }),
    };
  } catch (error) {
    console.error('Error creating payment intent:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to create payment intent',
        message: error.message,
      }),
    };
  }
};
