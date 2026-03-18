/**
 * Cart Upsell Recommendations — Web Component
 *
 * Fetches product recommendations based on the first cart item
 * using the Shopify Recommendations API. Re-renders automatically
 * when the cart changes. Excludes products already in the cart.
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
    this.#productId = Number(this.dataset.productId);
    this.#limit = Number(this.dataset.limit) || 4;
    this.#cartProductIds = new Set(
      this.dataset.cartProductIds.split(',').filter(Boolean).map(Number)
    );

    this.#unsubscribe = subscribe(
      PUB_SUB_EVENTS.cartUpdate,
      this.#onCartUpdate.bind(this)
    );

    this.#fetchRecommendations();
  }

  disconnectedCallback() {
    this.#unsubscribe?.();
    this.#abortController?.abort();
  }

  async #onCartUpdate(event) {
    const cart = event.cartData;
    if (!cart?.items) return;

    if (cart.item_count === 0) {
      this.hidden = true;
      return;
    }

    this.hidden = false;
    const newProductId = cart.items[0].product_id;
    const newIds = new Set(cart.items.map((item) => item.product_id));
    const sourceChanged = newProductId !== this.#productId;
    const exclusionsChanged = !this.#setsEqual(newIds, this.#cartProductIds);

    this.#productId = newProductId;
    this.#cartProductIds = newIds;

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

    this.#setLoading(true);

    const fetchLimit = Math.min(this.#limit + this.#cartProductIds.size + 2, 10);
    const url = `${routes.root_url}recommendations/products.json?product_id=${this.#productId}&limit=${fetchLimit}&intent=related`;

    try {
      const response = await fetch(url, { signal: this.#abortController.signal });

      if (!response.ok) {
        this.#renderEmpty();
        return;
      }

      const { products } = await response.json();
      this.#cachedRecommendations = products;
      this.#renderFromCache();
    } catch (error) {
      if (error.name !== 'AbortError') this.#renderEmpty();
    } finally {
      this.#setLoading(false);
    }
  }

  #renderFromCache() {
    if (!this.#cachedRecommendations) return;

    const filtered = this.#cachedRecommendations
      .filter((p) => !this.#cartProductIds.has(p.id))
      .slice(0, this.#limit);

    if (filtered.length === 0) {
      this.#renderEmpty();
    } else {
      this.#renderProducts(filtered);
    }
  }

  #renderProducts(products) {
    this.#empty.hidden = true;
    this.#grid.replaceChildren(...products.map((p) => this.#buildCard(p)));
  }

  #renderEmpty() {
    this.#grid.replaceChildren();
    this.#empty.hidden = false;
  }

  #buildCard(product) {
    const variant = product.variants[0];
    const onSale = variant.compare_at_price && variant.compare_at_price > variant.price;

    const card = document.createElement('div');
    card.classList.add('cart-upsell__card');
    card.setAttribute('role', 'listitem');

    // Image
    const imageLink = document.createElement('a');
    imageLink.href = product.url;
    imageLink.classList.add('cart-upsell__image-link');
    imageLink.setAttribute('aria-label', product.title);

    if (product.featured_image) {
      const img = document.createElement('img');
      img.src = this.#imageUrl(product.featured_image, '400x');
      img.alt = product.title;
      img.loading = 'lazy';
      img.width = 400;
      img.height = 400;
      imageLink.append(img);
    }

    // Info
    const info = document.createElement('div');
    info.classList.add('cart-upsell__info');

    const title = document.createElement('a');
    title.href = product.url;
    title.classList.add('cart-upsell__title');
    title.textContent = product.title;

    const priceWrap = document.createElement('div');
    priceWrap.classList.add('cart-upsell__price');

    const currentPrice = document.createElement('span');
    currentPrice.textContent = this.#money(variant.price);

    if (onSale) {
      currentPrice.classList.add('cart-upsell__price--sale');
      const comparePrice = document.createElement('s');
      comparePrice.classList.add('cart-upsell__price--compare');
      comparePrice.textContent = this.#money(variant.compare_at_price);
      priceWrap.append(currentPrice, comparePrice);
    } else {
      priceWrap.append(currentPrice);
    }

    // Add to cart button
    const button = document.createElement('button');
    button.type = 'button';
    button.classList.add('cart-upsell__atc', 'button', 'button--secondary');
    button.textContent = 'Add to cart';
    button.addEventListener('click', () => this.#addToCart(variant.id, button));

    info.append(title, priceWrap, button);
    card.append(imageLink, info);

    return card;
  }

  async #addToCart(variantId, button) {
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = 'Adding…';

    try {
      await fetch(routes.cart_add_url, {
        ...fetchConfig(),
        body: JSON.stringify({ id: variantId, quantity: 1 }),
      });

      const cartResponse = await fetch(`${routes.cart_url}.js`);
      const cartData = await cartResponse.json();

      publish(PUB_SUB_EVENTS.cartUpdate, {
        source: 'cart-upsell',
        cartData,
      });

      button.textContent = 'Added!';
      setTimeout(() => {
        button.disabled = false;
        button.textContent = originalText;
      }, 1500);
    } catch {
      button.textContent = 'Error';
      setTimeout(() => {
        button.disabled = false;
        button.textContent = originalText;
      }, 2000);
    }
  }

  #setLoading(on) {
    this.#loading.hidden = !on;
    this.#loading.setAttribute('aria-hidden', String(!on));
  }

  #money(cents) {
    return new Intl.NumberFormat(Shopify.locale || 'en-US', {
      style: 'currency',
      currency: Shopify.currency?.active || 'USD',
    }).format(cents / 100);
  }

  #imageUrl(url, size) {
    if (!url) return '';
    return url.replace(/(\.\w+)(\?|$)/, `_${size}$1$2`);
  }

  #setsEqual(a, b) {
    if (a.size !== b.size) return false;
    for (const v of a) {
      if (!b.has(v)) return false;
    }
    return true;
  }
}

customElements.define('cart-upsell', CartUpsell);
