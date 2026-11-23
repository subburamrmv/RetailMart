# RetailMate Firestore Security Specification

## 1. Data Invariants
1. A user can only read or write their own `/users/{userId}` document. Listing `/users` is strictly denied.
2. Every business-owned document under `/businesses/{businessId}/...` belongs to a parent `Business` document where `ownerId` is immutable and `memberUids` (max 25 UIDs) authorizes access.
3. `inventory_movements` and `audit_logs` are immutable append-only ledgers (updates and deletes are denied).
4. Completed `sales` cannot be deleted; reversals and returns are recorded through status transitions (`COMPLETED` -> `PARTIALLY_RETURNED` | `RETURNED` | `CANCELLED`), and `CANCELLED` is terminal.
5. `createdAt` and `updatedAt` timestamps must match `request.time`.
6. Document IDs must match `^[a-zA-Z0-9_\-]+$` (max 128 chars).

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated read/write**: Any request with `request.auth == null` to `/businesses/biz_1/sales/sale_1` -> `PERMISSION_DENIED`.
2. **Unverified email write**: Authenticated user with `email_verified: false` creating a product -> `PERMISSION_DENIED`.
3. **Cross-tenant business read**: User B (`uid_b`) attempting `get` or `list` on Business A's `/businesses/biz_a/products` -> `PERMISSION_DENIED`.
4. **Privilege escalation on Business**: A `CASHIER` attempting to update `memberRoles` or `ownerId` on `/businesses/biz_a` -> `PERMISSION_DENIED`.
5. **Shadow field injection**: Sending `isAdmin: true` or `ghostField: "x"` in a `Product` or `Sale` create payload -> `PERMISSION_DENIED`.
6. **ID Poisoning**: Creating a document with a 300-character or path-traversal ID (`../admin`) -> `PERMISSION_DENIED`.
7. **Timestamp forgery**: Sending a past `createdAt` instead of `request.time` -> `PERMISSION_DENIED`.
8. **Deleting completed financial record**: Attempting `delete` on `/businesses/biz_a/sales/sale_1` or `/businesses/biz_a/inventory_movements/mov_1` -> `PERMISSION_DENIED`.
9. **Terminal state bypass**: Attempting to update a `CANCELLED` sale back to `COMPLETED` -> `PERMISSION_DENIED`.
10. **Cashier unauthorized settings/expense mutation**: A `CASHIER` attempting to delete products or change business tax settings -> `PERMISSION_DENIED`.
11. **Orphaned subcollection write**: Creating a `sale` under a non-existent `businessId` -> `PERMISSION_DENIED`.
12. **Blanket query scraping**: Running `collection(db, 'businesses/biz_a/customers')` without matching `memberUids` / `ownerId` membership -> `PERMISSION_DENIED`.
