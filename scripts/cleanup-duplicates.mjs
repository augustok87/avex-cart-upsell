/**
 * Remove duplicate products and collections from failed seed runs.
 * Keeps only the latest set (from the successful run).
 */

const STORE = 'cautiva-bsas.myshopify.com';
const TOKEN = process.env.SHOPIFY_TOKEN;
const API_VERSION = '2024-10';
const ENDPOINT = `https://${STORE}/admin/api/${API_VERSION}/graphql.json`;

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
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

// IDs to KEEP (from the successful run)
const KEEP_PRODUCTS = new Set([
  'gid://shopify/Product/9143414096122',
  'gid://shopify/Product/9143414259962',
  'gid://shopify/Product/9143414292730',
  'gid://shopify/Product/9143414325498',
  'gid://shopify/Product/9143414423802',
  'gid://shopify/Product/9143414456570',
  'gid://shopify/Product/9143414522106',
  'gid://shopify/Product/9143414554874',
]);

const KEEP_COLLECTIONS = new Set([
  'gid://shopify/Collection/465257824506',
  'gid://shopify/Collection/465257857274',
]);

async function main() {
  // Get all products
  const prodData = await graphql(`{
    products(first: 50) {
      edges { node { id title } }
    }
  }`);

  for (const { node } of prodData.products.edges) {
    if (!KEEP_PRODUCTS.has(node.id)) {
      console.log(`Deleting product: ${node.title} (${node.id})`);
      await graphql(`mutation { productDelete(input: { id: "${node.id}" }) { deletedProductId } }`);
    }
  }

  // Get all collections
  const collData = await graphql(`{
    collections(first: 50) {
      edges { node { id title } }
    }
  }`);

  for (const { node } of collData.collections.edges) {
    if (!KEEP_COLLECTIONS.has(node.id)) {
      console.log(`Deleting collection: ${node.title} (${node.id})`);
      await graphql(`mutation { collectionDelete(input: { id: "${node.id}" }) { deletedCollectionId } }`);
    }
  }

  console.log('Cleanup done.');
}

main().catch(console.error);
