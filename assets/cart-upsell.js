/**
 * Cart Upsell Recommendations
 *
 * Fetches product recommendations for the first cart item via the
 * Shopify Recommendations API, with a collection-based fallback
 * for stores that lack purchase history. Subscribes to Dawn's
 * pub/sub cart events to stay in sync.
 */

class CartUpsell extends HTMLElement {
  #abortController = null;
  #unsubscribe = null;
  #grid = null;
  #loading = null;
  #empty = null;
  #productId = null;
  #cartProductIds = new Set();
  #limit = 4;
  #cachedRecommendations = null;

  connectedCallback() {
    this.#grid = this.querySelector('[data-upsell-grid]');
    this.#loading = this.querySelector('[data-upsell-loading]');
    this.#empty = this.querySelector('[data-upsell-empty]');

    if (!this.#grid || !this.#loading || !this.#empty) return;

    this.#productId = Number(this.dataset.productId) || null;
    this.#limit = Number(this.dataset.limit) || 4;
    this.#cartProductIds = this.#parseCartProductIds(this.dataset.cartProductIds);

    if (typeof subscribe === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
      this.#unsubscribe = subscribe(PUB_SUB_EVENTS.cartUpdate, this.#onCartUpdate.bind(this));
    }

    if (this.#productId) {
      this.#fetchRecommendations();
    }
  }

  disconnectedCallback() {
    this.#unsubscribe?.();
    this.#abortController?.abort();
  }

  async #onCartUpdate(event) {
    const cart = event?.cartData;
    if (!cart?.items) return;

    if (cart.item_count === 0) {
      this.hidden = true;
      return;
    }

    this.hidden = false;
    const newProductId = cart.items[0].product_id;
    const newCartProductIds = new Set(cart.items.map((item) => item.product_id));
    const sourceChanged = newProductId !== this.#productId;
    const exclusionsChanged = !this.#setsEqual(newCartProductIds, this.#cartProductIds);

    this.#productId = newProductId;
    this.#cartProductIds = newCartProductIds;

    if (sourceChanged) {
      this.#cachedRecommendations = null;
      await this.#fetchRecommendations();
    } else if (exclusionsChanged) {
      this.#renderFromCache();
    }
  }

  async #fetchRecommendations() {
    this.#abortController?.abort();
    this.#abortController = new AbortController();
    const { signal } = this.#abortController;

    this.#setLoading(true);

    const fetchLimit = Math.min(this.#limit + this.#cartProductIds.size + 2, 10);

    try {
      const products = await this.#fetchFromRecommendationsApi(this.#productId, fetchLimit, signal);

      if (products.length > 0) {
        this.#cachedRecommendations = products;
        this.#setLoading(false);
        this.#renderFromCache();
        return;
      }

      // Fallback to collection when recommendations API has no data (cold-start stores)
      const fallbackProducts = await this.#fetchFromCollectionApi(fetchLimit, signal);
      this.#cachedRecommendations = fallbackProducts;
      this.#setLoading(false);
      this.#renderFromCache();
    } catch (error) {
      if (error.name !== 'AbortError') {
        this.#setLoading(false);
        this.#renderEmpty();
      }
    }
  }

  async #fetchFromRecommendationsApi(productId, limit, signal) {
    const url = `/recommendations/products.json?product_id=${productId}&limit=${limit}&intent=related`;
    const response = await fetch(url, { signal });

    if (!response.ok) return [];

    const data = await response.json();
    return Array.isArray(data?.products) ? data.products : [];
  }

  async #fetchFromCollectionApi(limit, signal) {
    const collectionHandle = this.dataset.fallbackCollection || 'all';
    const url = `/collections/${collectionHandle}/products.json?limit=${limit}`;
    const response = await fetch(url, { signal });

    if (!response.ok) return [];

    const data = await response.json();
    return Array.isArray(data?.products) ? data.products : [];
  }

  #renderFromCache() {
    if (!this.#cachedRecommendations) return;

    const filtered = this.#cachedRecommendations
      .filter((product) => !this.#cartProductIds.has(product.id))
      .slice(0, this.#limit);

    if (filtered.length === 0) {
      this.#renderEmpty();
    } else {
      this.#renderProducts(filtered);
    }
  }

  #renderProducts(products) {
    this.#empty.hidden = true;
    this.#grid.replaceChildren(...products.map((product) => this.#buildCard(product)));
  }

  #renderEmpty() {
    this.#grid.replaceChildren();
    this.#empty.hidden = false;
  }

  #buildCard(product) {
    const variant = product.variants?.[0];
    const card = document.createElement('div');
    card.classList.add('cart-upsell__card');
    card.setAttribute('role', 'listitem');

    card.append(this.#buildCardImage(product), this.#buildCardInfo(product, variant));

    return card;
  }

  #buildCardImage(product) {
    const link = document.createElement('a');
    link.href = product.url;
    link.classList.add('cart-upsell__image-link');
    link.setAttribute('aria-label', product.title);

    const imageUrl = this.#extractImageUrl(product);
    if (imageUrl) {
      const img = document.createElement('img');
      img.src = this.#resizedImageUrl(imageUrl, 400);
      img.alt = product.title;
      img.loading = 'lazy';
      img.width = 400;
      img.height = 400;
      link.append(img);
    }

    return link;
  }

  #buildCardInfo(product, variant) {
    const info = document.createElement('div');
    info.classList.add('cart-upsell__info');

    const titleLink = document.createElement('a');
    titleLink.href = product.url;
    titleLink.classList.add('cart-upsell__title');
    titleLink.textContent = product.title;

    info.append(titleLink);

    if (variant) {
      info.append(this.#buildPriceDisplay(variant));

      const addButton = document.createElement('button');
      addButton.type = 'button';
      addButton.classList.add('cart-upsell__atc', 'button', 'button--secondary');
      addButton.textContent = 'Add to cart';
      addButton.addEventListener('click', () => this.#addToCart(variant.id, addButton));
      info.append(addButton);
    }

    return info;
  }

  #buildPriceDisplay(variant) {
    const priceWrap = document.createElement('div');
    priceWrap.classList.add('cart-upsell__price');

    const currentPrice = document.createElement('span');
    currentPrice.textContent = this.#formatMoney(variant.price);

    const hasComparePrice = variant.compare_at_price && variant.compare_at_price > variant.price;
    if (hasComparePrice) {
      currentPrice.classList.add('cart-upsell__price--sale');
      const comparePrice = document.createElement('s');
      comparePrice.classList.add('cart-upsell__price--compare');
      comparePrice.textContent = this.#formatMoney(variant.compare_at_price);
      priceWrap.append(currentPrice, comparePrice);
    } else {
      priceWrap.append(currentPrice);
    }

    return priceWrap;
  }

  async #addToCart(variantId, button) {
    this.#setButtonState(button, { text: 'Adding…', disabled: true });

    try {
      const addResponse = await fetch(routes.cart_add_url, {
        ...fetchConfig(),
        body: JSON.stringify({ id: variantId, quantity: 1 }),
      });

      if (!addResponse.ok) {
        this.#setButtonState(button, { text: 'Error', disabled: true, resetAfterMs: 2000 });
        return;
      }

      const cartResponse = await fetch(`${routes.cart_url}.js`);
      if (!cartResponse.ok) {
        this.#setButtonState(button, { text: 'Error', disabled: true, resetAfterMs: 2000 });
        return;
      }

      const cartData = await cartResponse.json();
      publish(PUB_SUB_EVENTS.cartUpdate, { source: 'cart-upsell', cartData });

      this.#setButtonState(button, { text: 'Added!', disabled: true, resetAfterMs: 1500 });
    } catch {
      this.#setButtonState(button, { text: 'Error', disabled: true, resetAfterMs: 2000 });
    }
  }

  #setLoading(isVisible) {
    this.#loading.hidden = !isVisible;
    this.#loading.setAttribute('aria-hidden', String(!isVisible));
  }

  #setButtonState(button, { text, disabled, resetAfterMs = 0 }) {
    if (!button.dataset.originalText) {
      button.dataset.originalText = button.textContent;
    }
    button.textContent = text;
    button.disabled = disabled;

    if (resetAfterMs > 0) {
      setTimeout(() => {
        button.textContent = button.dataset.originalText;
        button.disabled = false;
      }, resetAfterMs);
    }
  }

  #formatMoney(cents) {
    return new Intl.NumberFormat(Shopify.locale || 'en-US', {
      style: 'currency',
      currency: Shopify.currency?.active || 'USD',
    }).format(cents / 100);
  }

  // Handles all Shopify product JSON shapes: recommendations API returns
  // featured_image as a string, collections API may return an object or array.
  #extractImageUrl(product) {
    if (typeof product.featured_image === 'string' && product.featured_image) {
      return product.featured_image;
    }
    if (product.featured_image?.src) {
      return product.featured_image.src;
    }
    if (Array.isArray(product.images) && product.images.length > 0) {
      const firstImage = product.images[0];
      return typeof firstImage === 'string' ? firstImage : firstImage?.src || '';
    }
    return '';
  }

  // Modern Shopify CDN uses ?width= instead of the legacy _SIZEx suffix
  #resizedImageUrl(originalUrl, width) {
    if (!originalUrl) return '';
    try {
      const url = new URL(originalUrl);
      url.searchParams.set('width', String(width));
      return url.toString();
    } catch {
      return originalUrl;
    }
  }

  #parseCartProductIds(rawValue) {
    if (!rawValue) return new Set();
    return new Set(rawValue.split(',').filter(Boolean).map(Number));
  }

  #setsEqual(setA, setB) {
    if (setA.size !== setB.size) return false;
    for (const value of setA) {
      if (!setB.has(value)) return false;
    }
    return true;
  }
}

customElements.define('cart-upsell', CartUpsell);
