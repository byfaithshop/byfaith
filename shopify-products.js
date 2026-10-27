/* by faith – live products from Shopify
   Fills any element with data-shopify-collection="..." with product cards
   pulled from shop.byfaith.shop each time the page loads.
   If Shopify can't be reached, the cards already in the page stay as they are. */
(function () {
  var STORE = 'https://shop.byfaith.shop';

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Tidy titles like "The Light Has Come!!" or "Into Our Longing Hearts..."
  function cleanTitle(t) {
    return String(t).replace(/!{2,}/g, '!').replace(/\.{2,}\s*$/, '').trim();
  }

  // Use the first line of the Shopify description (before Printify's ".: details")
  function shortDesc(html) {
    var d = document.createElement('div');
    d.innerHTML = html || '';
    var t = (d.textContent || '').replace(/\s+/g, ' ').trim();
    t = t.split(/\s*\.:\s*/)[0].trim();
    if (t.length > 130) t = t.slice(0, 127).replace(/\s+\S*$/, '') + '…';
    return t;
  }

  function lowestPrice(p) {
    var prices = p.variants
      .filter(function (v) { return v.available !== false; })
      .map(function (v) { return parseFloat(v.price); })
      .filter(function (n) { return !isNaN(n); });
    if (!prices.length) return null;
    return Math.min.apply(null, prices);
  }

  function card(p, label) {
    var url = STORE + '/products/' + encodeURIComponent(p.handle);
    var title = cleanTitle(p.title);
    var img = p.images[0].src;
    img += (img.indexOf('?') > -1 ? '&' : '?') + 'width=800';
    var price = lowestPrice(p);
    var desc = shortDesc(p.body_html);
    return '<article class="product">' +
      '<a class="ph" href="' + url + '" aria-label="Buy ' + esc(title) + '">' +
      '<img src="' + esc(img) + '" alt="' + esc(title) + ' greeting card" loading="lazy"></a>' +
      '<div class="info"><div class="cat">' + esc(label) + '</div>' +
      '<h3>' + esc(title) + '</h3>' +
      (desc ? '<p>' + esc(desc) + '</p>' : '') +
      '<div class="row">' +
      (price !== null ? '<span class="price">From $' + price.toFixed(2) + '</span>' : '<span></span>') +
      '<a class="buy" href="' + url + '">Buy now →</a></div></div></article>';
  }

  function getJSON(url) {
    return fetch(url, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    });
  }

  // Load a Shopify collection. If it doesn't exist or is empty,
  // optionally fall back to every product in the store.
  function load(handle, fallbackAll) {
    return getJSON(STORE + '/collections/' + handle + '/products.json?limit=250')
      .then(function (d) { return d.products || []; })
      .catch(function () { return []; })
      .then(function (list) {
        if (list.length || !fallbackAll) return list;
        return getJSON(STORE + '/products.json?limit=250').then(function (d) { return d.products || []; });
      });
  }

  var cache = {};
  document.querySelectorAll('[data-shopify-collection]').forEach(function (box) {
    var handle = box.getAttribute('data-shopify-collection');
    var fallbackAll = box.getAttribute('data-fallback') === 'all';
    var label = box.getAttribute('data-label') || 'by faith';
    var limit = parseInt(box.getAttribute('data-limit') || '0', 10);
    var key = handle + '|' + fallbackAll;
    cache[key] = cache[key] || load(handle, fallbackAll);
    cache[key].then(function (products) {
      var ready = products.filter(function (p) { return p.images && p.images.length; });
      if (limit) ready = ready.slice(0, limit);
      if (!ready.length) return; // keep whatever is already on the page
      // Keep any "Coming soon" cards that aren't in Shopify yet
      var keep = Array.prototype.slice.call(box.querySelectorAll('[data-keep]')).map(function (el) { return el.outerHTML; });
      box.innerHTML = ready.map(function (p) { return card(p, label); }).join('') + keep.join('');
    }).catch(function () { /* leave the page as is */ });
  });
})();
