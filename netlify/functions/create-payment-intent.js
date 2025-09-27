const Stripe = require('stripe');

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

// Package catalog for server-side validation (all amounts in cents)
const PACKAGE_CATALOG = {
  classic: {
    name: 'Classic Autumn Package',
    basePrice: 36000, // $360
    options: {
      delivery: {
        week1: 0,
        week2: 0,
        week3: 0,
        week4: 0,
      },
      addons: {
        none: 0,
        'setup-service': 9000, // $90 extra
        // 'corn-stalks': 3500, // $35 extra
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
      addons: {
        none: 0,
        scarecrow: 7500,  // $75 extra
        lighting: 12500,  // $125 extra
        maintenance: 10000, // $100 extra
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
    const { packageId, customizations } = JSON.parse(event.body);

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

    const paymentIntent = await stripe.paymentIntents.create({
      amount: validation.totalPrice,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: {
        packageId,
        packageName: PACKAGE_CATALOG[packageId].name,
        customizations: JSON.stringify(customizations),
        totalPrice: (validation.totalPrice / 100).toString(), // store in dollars
      },
    });

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
