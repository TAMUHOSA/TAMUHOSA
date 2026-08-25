// TAMU HOSA - content-driven page renderer.
// Reads content/site.json + content/pages.json and builds the whole page from them,
// so every page is really just data. The officer CMS (admin/) edits those two files.
(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function setMeta(name, content, attr) {
    if (!content) return;
    var selector = 'meta[' + (attr || 'name') + '="' + name + '"]';
    var meta = document.querySelector(selector);
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute(attr || 'name', name);
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', content);
  }

  function rootPrefix() {
    // membership/*.html pages need ../ in front of every root-relative asset/link.
    return location.pathname.indexOf('/membership/') !== -1 ? '../' : '';
  }

  function resolveHref(href) {
    if (!href) return '#';
    if (/^(https?:|mailto:|#)/.test(href)) return href;
    return rootPrefix() + href;
  }

  function currentSlug() {
    var params = new URLSearchParams(location.search);
    if (params.get('slug')) return params.get('slug');
    var path = location.pathname.replace(/^.*\/TAMUHOSA\//, '').replace(/^\//, '');
    if (path === '' || path === 'index.html') return 'home';
    return null; // matched by path instead
  }

  function findPage(pages) {
    var slug = currentSlug();
    var path = location.pathname;
    if (slug) {
      var bySlug = pages.filter(function (p) { return p.slug === slug; })[0];
      if (bySlug) return bySlug;
    }
    return pages.filter(function (p) { return path.indexOf(p.path) !== -1; })[0] || pages[0];
  }

  function applyColors(colors) {
    var cssVarMap = {
      maroon: '--maroon', maroonDark: '--maroon-dark', maroonDeep: '--maroon-deep',
      navy: '--navy', navyDark: '--navy-dark',
      ink: '--ink', cream: '--cream', paper: '--paper', warmWhite: '--warm-white',
      gray: '--gray', grayLight: '--gray-light', border: '--border', borderStrong: '--border-strong'
    };
    var lines = Object.keys(colors).map(function (k) {
      return cssVarMap[k] ? cssVarMap[k] + ': ' + colors[k] + ';' : '';
    });
    var style = document.createElement('style');
    style.id = 'hosa-color-overrides';
    style.textContent = ':root{' + lines.join('') + '}';
    document.head.appendChild(style);
  }

  function brandMarkSvg() {
    return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M12 3.6L21 20H3L12 3.6Z" stroke="#ffffff" stroke-width="1.8" stroke-linejoin="round"/>' +
      '<circle cx="12" cy="14.4" r="1.5" fill="#ffffff"/></svg>';
  }

  function renderHeader(site) {
    var rp = rootPrefix();
    var navItems = (site.nav || []).map(function (item) {
      if (item.dropdown) {
        var children = item.dropdown.map(function (c) {
          return '<a href="' + esc(resolveHref(c.href)) + '">' + esc(c.label) + '</a>';
        }).join('');
        return '<li class="has-dropdown"><details>' +
          '<summary class="dropdown-toggle">' + esc(item.label) + ' <span>&#9662;</span></summary>' +
          '<div class="dropdown-menu">' + children + '</div>' +
          '</details></li>';
      }
      return '<li><a href="' + esc(resolveHref(item.href)) + '"' + (item.cta ? ' class="nav-cta"' : '') + '>' + esc(item.label) + '</a></li>';
    }).join('');

    return '<header class="site-header"><div class="nav-wrap">' +
      '<a href="' + esc(rp + 'index.html') + '" class="brand">' +
      '<span class="brand-mark" aria-hidden="true">' + brandMarkSvg() + '</span>' +
      '<span>' + esc(site.brand.name) + '<span class="affiliation">' + esc(site.brand.affiliation) + '</span></span>' +
      '</a>' +
      '<nav>' +
      '<button class="nav-toggle-mobile" aria-label="Toggle menu" aria-expanded="false" aria-controls="primary-nav">&#9776;</button>' +
      '<ul id="primary-nav">' + navItems + '</ul>' +
      '</nav></div></header>';
  }

  function renderFooter(site) {
    var cols = (site.footer.columns || []).map(function (col) {
      var links = col.links.map(function (l) {
        return '<a href="' + esc(resolveHref(l.href)) + '">' + esc(l.label) + '</a>';
      }).join('<br>');
      return '<div><strong style="color:white;">' + esc(col.heading) + '</strong><br>' + links + '</div>';
    }).join('');

    return '<footer class="site-footer"><div class="footer-wrap">' +
      '<div class="brand-col"><strong style="color:white;">' + esc(site.brand.name) + '</strong>' +
      '<p style="max-width:320px;font-size:0.9rem;">' + esc(site.footer.tagline) + '</p></div>' +
      cols +
      '</div><div class="footer-bottom">' + esc(site.footer.copyright) + '</div></footer>';
  }

  var blockRenderers = {
    heroBig: function (b) {
      var buttons = (b.buttons || []).map(function (btn) {
        var cls = btn.style === 'outline' ? 'btn btn-outline' : 'btn';
        return '<a href="' + esc(resolveHref(btn.href)) + '" class="' + cls + '">' + esc(btn.label) + '</a>';
      }).join('');
      return '<section class="hero"><div class="hero-inner"><div class="hero-text">' +
        '<div class="hero-kicker">' + esc(b.kicker) + '</div>' +
        '<h1>' + esc(b.heading) + '</h1>' +
        '<p>' + esc(b.lede) + '</p>' +
        '<div class="hero-buttons">' + buttons + '</div>' +
        '</div></div></section>';
    },
    pageHero: function (b) {
      return '<section class="page-hero"><h1>' + esc(b.heading) + '</h1><p>' + esc(b.lede) + '</p></section>';
    },
    cardGrid: function (b) {
      var isInfo = b.layout === 'info';
      var cards = (b.cards || []).map(function (c) {
        var pinClass = c.pillar === 'teal' ? ' pillar-teal' : (c.pillar === 'maroon' ? ' pillar-maroon' : '');
        var inner = '<span class="tag">' + esc(c.tag) + '</span><h3>' + esc(c.title) + '</h3>' +
          (c.body ? '<p>' + esc(c.body) + '</p>' : '');
        if (c.link) {
          return '<a href="' + esc(resolveHref(c.link)) + '" class="card' + pinClass + '"' +
            (/^https?:/.test(c.link) ? ' target="_blank" rel="noopener"' : '') + '>' + inner + '</a>';
        }
        return '<div class="card' + pinClass + '">' + inner + '</div>';
      }).join('');
      return '<section' + (b.alt ? ' class="alt"' : '') + '><div class="container">' +
        (b.eyebrow ? '<span class="eyebrow-tag">' + esc(b.eyebrow) + '</span>' : '') +
        (b.title ? '<h2 class="section-title">' + esc(b.title) + '</h2>' : '') +
        (b.lede ? '<p class="section-lede">' + esc(b.lede) + '</p>' : '') +
        '<div class="' + (isInfo ? 'contact-info-grid' : 'grid') + '">' + cards + '</div>' +
        (b.note ? '<p class="check-back-note">' + esc(b.note) + '</p>' : '') +
        '</div></section>';
    },
    ctaButtons: function (b) {
      var buttons = (b.buttons || []).map(function (btn) {
        return '<a href="' + esc(resolveHref(btn.href)) + '" class="btn btn-solid">' + esc(btn.label) + '</a>';
      }).join('');
      return '<section' + (b.alt ? ' class="alt"' : '') + '><div class="container" style="text-align:center;">' +
        (b.eyebrow ? '<span class="eyebrow-tag">' + esc(b.eyebrow) + '</span>' : '') +
        (b.title ? '<h2 class="section-title">' + esc(b.title) + '</h2>' : '') +
        (b.lede ? '<p class="section-lede">' + esc(b.lede) + '</p>' : '') +
        '<div class="hero-buttons" style="justify-content:center;">' + buttons + '</div>' +
        '</div></section>';
    },
    eventList: function (b) {
      var rows = (b.events || []).map(function (ev) {
        return '<div class="event-row"><div class="date-stamp"><span class="month">' + esc(ev.month) + '</span><span class="day">' + esc(ev.day) + '</span></div>' +
          '<div class="event-body"><h3>' + esc(ev.title) + '</h3>' +
          '<div class="meta">' + esc(ev.meta) + '</div>' +
          '<p>' + esc(ev.body) + '</p></div></div>';
      }).join('');
      return '<section><div class="container">' +
        (b.eyebrow ? '<span class="eyebrow-tag">' + esc(b.eyebrow) + '</span>' : '') +
        (b.title ? '<h2 class="section-title">' + esc(b.title) + '</h2>' : '') +
        (b.lede ? '<p class="section-lede">' + esc(b.lede) + '</p>' : '') +
        rows +
        (b.note ? '<p class="check-back-note">' + esc(b.note) + '</p>' : '') +
        '</div></section>';
    },
    faqList: function (b) {
      var items = (b.items || []).map(function (f) {
        return '<details class="faq-item"><summary>' + esc(f.q) + '</summary>' +
          '<div class="faq-answer">' + esc(f.a) + '</div></details>';
      }).join('');
      return '<section><div class="container">' +
        (b.eyebrow ? '<span class="eyebrow-tag">' + esc(b.eyebrow) + '</span>' : '') +
        (b.title ? '<h2 class="section-title">' + esc(b.title) + '</h2>' : '') +
        '<div style="max-width:760px;margin:0 auto;">' + items + '</div>' +
        '</div></section>';
    },
    officerGrid: function (b) {
      var cards = (b.officers || []).map(function (o) {
        var photo = o.photo
          ? '<img src="' + esc(resolveHref(o.photo)) + '" alt="' + esc(o.name) + '">'
          : '<span class="initials">' + esc(o.initials) + '</span>';
        return '<div class="officer-card"><div class="officer-photo">' + photo + '</div>' +
          '<div class="info"><h3>' + esc(o.name) + '</h3><div class="role">' + esc(o.role) + '</div></div></div>';
      }).join('');
      return '<section><div class="container"><div class="grid">' + cards + '</div></div></section>';
    },
    paragraph: function (b) {
      return '<section><div class="container"><p class="check-back-note">' + esc(b.text) + '</p></div></section>';
    }
  };

  function renderSections(sections) {
    return (sections || []).map(function (block) {
      var fn = blockRenderers[block.type];
      return fn ? fn(block) : '';
    }).join('');
  }

  function setupInteractivity() {
    var mobileToggle = document.querySelector('.nav-toggle-mobile');
    var navList = document.querySelector('nav ul');
    if (mobileToggle && navList) {
      mobileToggle.addEventListener('click', function () {
        var open = navList.classList.toggle('open');
        mobileToggle.setAttribute('aria-expanded', String(open));
      });
    }
    document.addEventListener('click', function (e) {
      document.querySelectorAll('.has-dropdown details[open]').forEach(function (d) {
        if (!d.contains(e.target)) d.removeAttribute('open');
      });
    });
    var header = document.querySelector('.site-header');
    if (header) {
      var setScrolled = function () { header.classList.toggle('scrolled', window.scrollY > 8); };
      setScrolled();
      window.addEventListener('scroll', setScrolled, { passive: true });
    }
    var revealTargets = document.querySelectorAll('.card, .officer-card, .event-row');
    var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (revealTargets.length && !prefersReducedMotion && 'IntersectionObserver' in window) {
      revealTargets.forEach(function (el) { el.classList.add('reveal-fade'); });
      var groups = new Map();
      revealTargets.forEach(function (el) {
        var parent = el.parentElement;
        var index = groups.has(parent) ? groups.get(parent) : 0;
        el.style.transitionDelay = Math.min(index * 70, 350) + 'ms';
        groups.set(parent, index + 1);
      });
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
      revealTargets.forEach(function (el) { observer.observe(el); });
    }
  }

  function boot() {
    var rp = rootPrefix();
    Promise.all([
      fetch(rp + 'content/site.json').then(function (r) { return r.json(); }),
      fetch(rp + 'content/pages.json').then(function (r) { return r.json(); })
    ]).then(function (results) {
      var site = results[0];
      var pages = results[1].pages;
      var page = findPage(pages);
      if (!page) { document.getElementById('app').innerHTML = '<p style="padding:60px;text-align:center;">Page not found.</p>'; return; }

      applyColors(site.colors);
      if (page.title) document.title = page.title;
      setMeta('description', page.metaDescription);
      setMeta('og:title', page.title, 'property');
      setMeta('og:description', page.metaDescription, 'property');
      setMeta('og:type', 'website', 'property');
      if (site.siteUrl) {
        var canonicalUrl = site.siteUrl.replace(/\/$/, '') + '/' + (page.path || '');
        setMeta('og:url', canonicalUrl, 'property');
        var link = document.querySelector('link[rel="canonical"]');
        if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.appendChild(link); }
        link.setAttribute('href', canonicalUrl);
      }

      var app = document.getElementById('app');
      app.innerHTML =
        '<a href="#main-content" class="skip-link">Skip to main content</a>' +
        renderHeader(site) +
        '<main id="main-content">' + renderSections(page.sections) + '</main>' +
        renderFooter(site);

      setupInteractivity();
    }).catch(function (err) {
      document.getElementById('app').innerHTML = '<p style="padding:60px;text-align:center;">Could not load site content. ' + esc(err.message) + '</p>';
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
