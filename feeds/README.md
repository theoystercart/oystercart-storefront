# Delivery product feed

`delivery-products.xml` is a Google Merchant Center feed for the products actually
linked from the live Wix `/delivery` catalogue. Every landing-page link uses the
canonical `https://www.theoystercart.com/products/<slug>` route.

The builder reads public Wix product data for titles, images and default option
prices, and the generated Ecwid feed for stock availability. IDs match numeric
Ecwid IDs already discovered by Google to avoid deliberately creating new identities.
It excludes workshops, tickets, memberships and other products outside `/delivery`.
No customer data or credentials are read. It does not modify either product system.

The workflow refreshes every six hours. Google fetches on its own daily schedule.
Any missing product, invalid price, unexpected URL or incompatible source price
aborts publication and retains the previous valid feed. Failures appear in GitHub
Actions; this is not a real-time inventory integration. Review affected feed entries
after changing product-page option pricing logic.

Rollback: pause/remove this Merchant Center source and disable the named workflow.
Existing automatic Google discovery remains independently configured. Website
assets and the Wix site require no rollback.
