# Delivery product feed

`delivery-products.xml` is a Google Merchant Center feed for products linked from
the live Wix `/delivery` catalogue. Landing-page URLs follow the current catalogue,
including canonical `https://shop.theoystercart.com/products/<slug>/` pages and any
remaining Wix-hosted product pages.

The builder reads public Wix-backed product snapshots for titles, images, prices,
actual option combinations and availability. The advertised price must match a
verified combination; paid sauce bundles are not silently added to the base price.
Existing numeric listing IDs are preserved for Google continuity. The field name
`ecwidId` is retained in product snapshots as an identifier only: this job makes
no Ecwid requests. Unknown prices, stock states, or external destinations fail
validation before either output is replaced.

The workflow refreshes every six hours, independently of website updates. Google
fetches on its own schedule. Workshops, reservations and other items outside the
delivery catalogue are excluded. No customer data or credentials are read, and the
builder does not modify products, inventory, orders or checkout.

Failures remain visible in GitHub Actions and retain the previous valid feed.
This uses the published storefront snapshot, not a real-time inventory feed.
Refresh the storefront snapshot when changing catalogue prices or availability.

Rollback: restore the previous builder and feed together, or pause this Merchant
Center source and disable the named workflow. The Wix website and checkout do
not require a release for feed maintenance.
