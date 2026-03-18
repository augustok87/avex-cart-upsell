/**
 * Fix: Publish all products to the Online Store sales channel
 * and re-upload missing images.
 *
 * Usage: SHOPIFY_TOKEN=shpat_... node scripts/fix-publish-products.mjs
 */

const STORE = 'cautiva-bsas.myshopify.com';
const TOKEN = process.env.SHOPIFY_TOKEN;
const API_VERSION = '2024-10';
const ENDPOINT = `https://${STORE}/admin/api/${API_VERSION}/graphql.json`;

if (!TOKEN) {
  console.error('Set SHOPIFY_TOKEN env var');
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

  const json = await res.json();
  if (json.errors) {
    throw new Error(JSON.stringify(json.errors, null, 2));
  }
  return json.data;
}

async function main() {
  // 1. Find the Online Store publication
  console.log('Finding Online Store publication...');
  const pubData = await graphql(`{
    publications(first: 10) {
      edges {
        node {
          id
          name
          catalog { id title }
        }
      }
    }
  }`);

  const publications = pubData.publications.edges.map((e) => e.node);
  console.log('Publications found:');
  for (const pub of publications) {
    console.log(`  - ${pub.name || pub.catalog?.title || 'unnamed'} (${pub.id})`);
  }

  const onlineStorePub = publications.find(
    (p) =>
      (p.name || '').toLowerCase().includes('online store') ||
      (p.catalog?.title || '').toLowerCase().includes('online store')
  );

  if (!onlineStorePub) {
    console.error('Could not find Online Store publication. Using first publication.');
  }

  const publicationId = onlineStorePub?.id || publications[0]?.id;
  console.log(`\nUsing publication: ${publicationId}\n`);

  // 2. Get all products
  const prodData = await graphql(`{
    products(first: 50) {
      edges {
        node {
          id
          title
          featuredMedia { id }
        }
      }
    }
  }`);

  const products = prodData.products.edges.map((e) => e.node);
  console.log(`Found ${products.length} products\n`);

  // 3. Publish each product
  for (const product of products) {
    console.log(`Publishing: ${product.title}`);
    try {
      const result = await graphql(`
        mutation publishProduct($id: ID!, $input: [PublicationInput!]!) {
          publishablePublish(id: $id, input: $input) {
            publishable { ... on Product { id title } }
            userErrors { field message }
          }
        }
      `, {
        id: product.id,
        input: [{ publicationId }],
      });

      const errors = result.publishablePublish.userErrors;
      if (errors.length) {
        console.log(`  Errors: ${JSON.stringify(errors)}`);
      } else {
        console.log('  Published!');
      }
    } catch (err) {
      console.log(`  Error: ${err.message}`);
    }
  }

  // 4. Fix missing image for Ergonomic Desk Lamp
  const lamp = products.find((p) => p.title === 'Ergonomic Desk Lamp');
  if (lamp && !lamp.featuredMedia) {
    console.log('\nRe-uploading image for Ergonomic Desk Lamp...');
    try {
      await graphql(`
        mutation addMedia($productId: ID!, $media: [CreateMediaInput!]!) {
          productCreateMedia(productId: $productId, media: $media) {
            media { id }
            mediaUserErrors { field message }
          }
        }
      `, {
        productId: lamp.id,
        media: [{
          originalSource: 'https://images.unsplash.com/photo-1534073737927-85f1ebff1f5d?w=800&h=800&fit=crop',
          mediaContentType: 'IMAGE',
          alt: 'Ergonomic Desk Lamp',
        }],
      });
      console.log('  Image uploaded!');
    } catch (err) {
      console.log(`  Image error: ${err.message}`);
    }
  }

  // 5. Also publish collections
  console.log('\nPublishing collections...');
  const collData = await graphql(`{
    collections(first: 10) {
      edges { node { id title } }
    }
  }`);

  for (const { node } of collData.collections.edges) {
    console.log(`Publishing collection: ${node.title}`);
    try {
      await graphql(`
        mutation publishCollection($id: ID!, $input: [PublicationInput!]!) {
          publishablePublish(id: $id, input: $input) {
            publishable { ... on Collection { id title } }
            userErrors { field message }
          }
        }
      `, {
        id: node.id,
        input: [{ publicationId }],
      });
      console.log('  Published!');
    } catch (err) {
      console.log(`  Error: ${err.message}`);
    }
  }

  console.log('\nDone! Products and collections should now be visible on the storefront.');
}

main().catch(console.error);
