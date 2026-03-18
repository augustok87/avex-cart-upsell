/**
 * Seed cautiva-bsas store with sample products + collections
 * for testing the Cart Upsell Recommendations feature.
 *
 * Usage: node scripts/seed-products.mjs
 */

const STORE = 'cautiva-bsas.myshopify.com';
const TOKEN = process.env.SHOPIFY_TOKEN;
const API_VERSION = '2024-10';
const ENDPOINT = `https://${STORE}/admin/api/${API_VERSION}/graphql.json`;

if (!TOKEN) {
  console.error('Set SHOPIFY_TOKEN env var (shpat_...)');
  process.exit(1);
}

async function graphql(query, variables = {}) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  const json = await res.json();
  if (json.errors) {
    throw new Error(JSON.stringify(json.errors, null, 2));
  }
  return json.data;
}

// --- Collections ---

async function createCollection(title, description) {
  const data = await graphql(`
    mutation collectionCreate($input: CollectionInput!) {
      collectionCreate(input: $input) {
        collection { id title }
        userErrors { field message }
      }
    }
  `, {
    input: {
      title,
      descriptionHtml: description,
      ruleSet: null,
    },
  });

  const result = data.collectionCreate;
  if (result.userErrors.length) {
    console.error(`Collection "${title}" errors:`, result.userErrors);
    return null;
  }
  console.log(`Created collection: ${result.collection.title} (${result.collection.id})`);
  return result.collection.id;
}

// --- Products ---

async function createProduct(product) {
  const data = await graphql(`
    mutation productCreate($product: ProductCreateInput!, $media: [CreateMediaInput!]) {
      productCreate(product: $product, media: $media) {
        product { id title }
        userErrors { field message }
      }
    }
  `, {
    product: {
      title: product.title,
      descriptionHtml: product.description,
      vendor: product.vendor,
      productType: product.productType,
      tags: product.tags,
      status: 'ACTIVE',
    },
    media: product.imageUrl
      ? [{ originalSource: product.imageUrl, mediaContentType: 'IMAGE', alt: product.title }]
      : [],
  });

  const result = data.productCreate;
  if (result.userErrors.length) {
    console.error(`Product "${product.title}" errors:`, result.userErrors);
    return null;
  }
  console.log(`Created product: ${result.product.title} (${result.product.id})`);
  return result.product.id;
}

async function setProductPrice(productId, price, compareAtPrice = null) {
  // Get the default variant
  const data = await graphql(`
    query getVariants($id: ID!) {
      product(id: $id) {
        variants(first: 1) {
          edges { node { id } }
        }
      }
    }
  `, { id: productId });

  const variantId = data.product.variants.edges[0]?.node.id;
  if (!variantId) return;

  await graphql(`
    mutation variantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        productVariants { id }
        userErrors { field message }
      }
    }
  `, {
    productId,
    variants: [{
      id: variantId,
      price: price.toString(),
      ...(compareAtPrice ? { compareAtPrice: compareAtPrice.toString() } : {}),
    }],
  });
  console.log(`  Set price: $${price}${compareAtPrice ? ` (was $${compareAtPrice})` : ''}`);
}

async function addProductToCollection(collectionId, productId) {
  await graphql(`
    mutation addToCollection($id: ID!, $products: [ID!]!) {
      collectionAddProductsV2(id: $id, productIds: $products) {
        job { id }
        userErrors { field message }
      }
    }
  `, {
    id: collectionId,
    products: [productId],
  });
}

// --- Product data ---
// Using picsum.photos for placeholder images (random, royalty-free)

const PRODUCTS = [
  {
    title: 'Ergonomic Desk Lamp',
    description: '<p>Adjustable LED desk lamp with warm and cool light modes. Perfect for late-night work sessions.</p>',
    vendor: 'Cautiva Home',
    productType: 'Lighting',
    tags: ['office', 'lighting', 'desk-accessories', 'ergonomic'],
    price: 49.99,
    compareAtPrice: 69.99,
    collection: 'office',
    imageUrl: 'https://images.unsplash.com/photo-1507473885765-e6ed057ab6fe?w=800&h=800&fit=crop',
  },
  {
    title: 'Bamboo Monitor Stand',
    description: '<p>Elevate your screen to eye level with this sustainable bamboo monitor riser. Includes hidden cable management.</p>',
    vendor: 'Cautiva Home',
    productType: 'Furniture',
    tags: ['office', 'desk-accessories', 'sustainable', 'organization'],
    price: 59.99,
    collection: 'office',
    imageUrl: 'https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=800&h=800&fit=crop',
  },
  {
    title: 'Wireless Charging Pad',
    description: '<p>Sleek 15W fast wireless charger compatible with all Qi-enabled devices. Minimalist matte finish.</p>',
    vendor: 'Cautiva Tech',
    productType: 'Accessories',
    tags: ['tech', 'charging', 'desk-accessories', 'wireless'],
    price: 29.99,
    collection: 'tech',
    imageUrl: 'https://images.unsplash.com/photo-1622445275576-721325763afe?w=800&h=800&fit=crop',
  },
  {
    title: 'Noise-Canceling Headphones',
    description: '<p>Premium over-ear headphones with active noise cancellation. 30-hour battery life.</p>',
    vendor: 'Cautiva Tech',
    productType: 'Audio',
    tags: ['tech', 'audio', 'wireless', 'noise-canceling'],
    price: 149.99,
    compareAtPrice: 199.99,
    collection: 'tech',
    imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&h=800&fit=crop',
  },
  {
    title: 'Leather Desk Mat',
    description: '<p>Full-size vegan leather desk mat with anti-slip base. Protects your desk and adds style.</p>',
    vendor: 'Cautiva Home',
    productType: 'Accessories',
    tags: ['office', 'desk-accessories', 'leather', 'organization'],
    price: 39.99,
    collection: 'office',
    imageUrl: 'https://images.unsplash.com/photo-1593062096033-9a26b09da705?w=800&h=800&fit=crop',
  },
  {
    title: 'USB-C Hub 7-in-1',
    description: '<p>Expand your laptop with HDMI, USB-A, SD card, and more. Aluminum body dissipates heat.</p>',
    vendor: 'Cautiva Tech',
    productType: 'Accessories',
    tags: ['tech', 'desk-accessories', 'usb', 'connectivity'],
    price: 44.99,
    collection: 'tech',
    imageUrl: 'https://images.unsplash.com/photo-1625842268584-8f3296236761?w=800&h=800&fit=crop',
  },
  {
    title: 'Ceramic Coffee Mug Set',
    description: '<p>Set of 2 handcrafted ceramic mugs. Microwave and dishwasher safe. 12 oz capacity.</p>',
    vendor: 'Cautiva Home',
    productType: 'Drinkware',
    tags: ['office', 'kitchen', 'ceramic', 'gift-idea'],
    price: 24.99,
    collection: 'office',
    imageUrl: 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=800&h=800&fit=crop',
  },
  {
    title: 'Mechanical Keyboard',
    description: '<p>Compact 75% layout mechanical keyboard with hot-swappable switches. RGB backlight.</p>',
    vendor: 'Cautiva Tech',
    productType: 'Input Devices',
    tags: ['tech', 'desk-accessories', 'keyboard', 'mechanical'],
    price: 89.99,
    compareAtPrice: 119.99,
    collection: 'tech',
    imageUrl: 'https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=800&h=800&fit=crop',
  },
];

// --- Main ---

async function main() {
  console.log('Seeding cautiva-bsas store...\n');

  // Create collections
  const officeCollectionId = await createCollection(
    'Office Essentials',
    'Everything you need for a productive workspace.'
  );
  const techCollectionId = await createCollection(
    'Tech Accessories',
    'Upgrade your setup with the latest tech gear.'
  );

  const collectionMap = {
    office: officeCollectionId,
    tech: techCollectionId,
  };

  console.log('');

  // Create products
  for (const product of PRODUCTS) {
    const productId = await createProduct(product);
    if (!productId) continue;

    await setProductPrice(productId, product.price, product.compareAtPrice);

    const collectionId = collectionMap[product.collection];
    if (collectionId) {
      await addProductToCollection(collectionId, productId);
      console.log(`  Added to collection: ${product.collection}`);
    }

    console.log('');
  }

  console.log('Done! Products seeded successfully.');
}

main().catch(console.error);
